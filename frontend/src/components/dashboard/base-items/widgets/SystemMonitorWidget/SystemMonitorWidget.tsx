import { ArrowDownward, ArrowUpward, ErrorOutline } from '@mui/icons-material';
import { Box, Button, CircularProgress, Grid2 as Grid, IconButton, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';

import { DiskUsageBar } from './DiskUsageWidget';
import { GaugeWidget } from './GaugeWidget';
import { DashApi } from '../../../../../api/dash-api';
import { useIsMobile } from '../../../../../hooks/useIsMobile';
import { COLORS } from '../../../../../theme/styles';
import { theme } from '../../../../../theme/theme';
import { convertSecondsToUptime, formatBytes } from '../../../../../utils/utils';
import { CenteredModal } from '../../../../modals/CenteredModal';

// Gauge types for configuration
export type GaugeType = 'cpu' | 'temp' | 'ram' | 'network' | 'none';

interface SystemMonitorWidgetProps {
    config?: {
        temperatureUnit?: string;
        gauges?: GaugeType[];
        networkInterface?: string;
        dualWidgetPosition?: 'top' | 'bottom';
    };
}

export const SystemMonitorWidget = ({ config }: SystemMonitorWidgetProps) => {
    const [systemInformation, setSystemInformation] = useState<any>();
    const [memoryInformation, setMemoryInformation] = useState<any>(0);
    const [diskInformation, setDiskInformation] = useState<any>();
    const [networkInformation, setNetworkInformation] = useState<{
        downloadSpeed: number;
        uploadSpeed: number;
        interfaceSpeed?: number; // Network interface speed in Mbps
        iface?: string; // Track the current interface
    }>({
        downloadSpeed: 0,
        uploadSpeed: 0
    });
    const [openSystemModal, setOpenSystemModal] = useState(false);
    const [isFahrenheit, setIsFahrenheit] = useState(config?.temperatureUnit !== 'celsius');
    const [errorMessage, setErrorMessage] = useState<string | null>('null');
    const [isLoading, setIsLoading] = useState(false);

    // Default gauges if not specified in config
    const selectedGauges = config?.gauges || ['cpu', 'temp', 'ram'];

    // Filter out 'none' option from selected gauges
    const visibleGauges = selectedGauges.filter(gauge => gauge !== 'none');

    const isMobile = useIsMobile();

    // Determine if we're inside a dual widget and adjust positioning
    const isDualWidget = config?.dualWidgetPosition !== undefined;
    const isBottomWidget = config?.dualWidgetPosition === 'bottom';

    // Default styles for the info button
    const infoButtonStyles = {
        position: 'absolute',
        top: -5,
        left: -5,
        zIndex: 99
    };

    // Adjust styles when in a dual widget
    if (isDualWidget) {
        // For top widget in dual, default style is fine
        // For bottom widget in dual, adjust the top position
        if (isBottomWidget) {
            infoButtonStyles.top = 0;
        }
    }

    // Helper function to format space dynamically (GB or TB)
    const formatSpace = (space: number): string => {
        return space >= 1000 ? `${(space / 1000).toFixed(2)} TB` : `${space.toFixed(2)} GB`;
    };

    // Helper function to convert temperature based on unit
    const formatTemperature = (tempCelsius: number): number => {
        if (isFahrenheit) {
            return Math.round((tempCelsius * 9/5) + 32);
        }
        return Math.round(tempCelsius);
    };

    // Helper function to format network speed with appropriate units (KB/s or MB/s)
    const formatNetworkSpeed = (bytesPerSecond: number): { value: number; unit: string; normalizedValue: number; display: string } => {
        // Handle undefined or null values
        if (bytesPerSecond === undefined || bytesPerSecond === null) {
            return { value: 0, unit: 'KB/s', normalizedValue: 0, display: '  0 KB' };
        }

        // Calculate normalized value in Mbps - ensure tiny values still show up on gauge
        const mbps = bytesPerSecond * 8 / 1000000; // Convert to Mbps

        // If there's any activity at all, ensure it shows at least 1% on the gauge
        // This makes even tiny network activity visible
        const normalizedMbps = bytesPerSecond > 0 ? Math.max(mbps, 30) : 0;

        let value = 0;
        let unit = '';
        let display = '';

        // If less than 1000 KB/s, show in KB/s
        if (bytesPerSecond < 1000 * 1024) {
            value = Math.round(bytesPerSecond / 1024); // Convert to KB/s
            unit = 'KB/s';
            // Pad the number to 3 characters and add the unit without /s
            display = value.toString().padStart(3, ' ') + ' KB';
        } else {
            // Otherwise show in MB/s
            value = Math.round(bytesPerSecond / (1024 * 1024));
            unit = 'MB/s';
            // Pad the number to 3 characters and add the unit without /s
            display = value.toString().padStart(3, ' ') + ' MB';
        }

        return { value, unit, normalizedValue: normalizedMbps, display };
    };

    const formatNumberForDisplay = (num: number): string => {
        // Pad numbers to a minimum width of 3 characters to prevent layout shifts
        return Math.round(num).toString().padStart(3, ' ');
    };

    const getRamPercentage = (systemData: any) => {
        let totalPercentage = 0;

        if (systemData?.memory?.total && systemData?.memory?.active) {
            totalPercentage = Math.round((systemData.memory.active / systemData.memory.total) * 100);
        }
        setMemoryInformation(totalPercentage);
    };

    const getNetworkInformation = (systemData: any) => {
        if (systemData?.network) {
            const currentIface = systemData.network.iface;

            // Use provided interface speed or default to 1000 Mbps (1 Gbps)
            const interfaceSpeed = systemData.network.speed || 1000;

            setNetworkInformation({
                downloadSpeed: systemData.network.rx_sec,
                uploadSpeed: systemData.network.tx_sec,
                interfaceSpeed: interfaceSpeed,
                iface: currentIface
            });
        } else {
            // Only log once if there's no network data
            if (networkInformation.iface) {
                setNetworkInformation({
                    downloadSpeed: 0,
                    uploadSpeed: 0,
                    iface: undefined
                });
            }
        }
    };

    const getMainDiskInfo = async (systemData: any) => {
        try {
            const disks = systemData?.disk;

            if (!disks || !disks.length) {
                throw new Error('No disks found');
            }
            // Filter out network shares or unwanted mounts (e.g., "//network-share")
            const validDisks = disks.filter((disk: { fs: string; }) => !disk.fs.startsWith('//'));

            if (!validDisks.length) {
                throw new Error('No valid disks found');
            }

            // Find the main disk (largest storage space)
            const systemVolumeDisk = validDisks.find((disk: { mount: string; }) => disk.mount === '/System/Volumes/Data');

            // If found, use it. Otherwise, pick the largest disk.
            const mainDisk = systemVolumeDisk ?? validDisks.reduce((prev: { size: number; }, current: { size: number; }) =>
                current.size > prev.size ? current : prev
            );

            // Get total and used space in GB
            const totalSpaceGB = (mainDisk.size / 1e9)?.toFixed(0); // Convert bytes to GB
            const usedSpaceGB = (mainDisk.used / 1e9)?.toFixed(0); // Convert bytes to GB

            setDiskInformation({
                mount: mainDisk.mount,
                totalSpace: totalSpaceGB,
                usedSpace: usedSpaceGB,
                usedPercentage: mainDisk.use
            });

            return {
                mount: mainDisk.mount,
                totalSpace: totalSpaceGB,
                usedSpace: usedSpaceGB,
            };
        } catch (err) {
            console.error('Error getting disk info:', err);
            return null;
        }
    };

    // Render a specific gauge based on type
    const renderGauge = (gaugeType: GaugeType, scale: number = 1) => {
        // Pre-calculate network values outside the switch statement
        const downloadSpeed = formatNetworkSpeed(networkInformation.downloadSpeed);
        const uploadSpeed = formatNetworkSpeed(networkInformation.uploadSpeed);

        // Get interface speed in Mbps (already in correct units)
        const interfaceSpeed = networkInformation.interfaceSpeed || 1000; // Default to 1 Gbps (in Mbps)

        switch (gaugeType) {
        case 'cpu':
            return <GaugeWidget
                title='CPU'
                value={systemInformation?.cpu?.currentLoad ? Math.round(systemInformation?.cpu?.currentLoad) : 0}
                isDualWidget={isDualWidget}
            />;
        case 'temp':
            return <GaugeWidget
                title='TEMP'
                value={systemInformation?.cpu?.main ? formatTemperature(systemInformation?.cpu?.main) : 0}
                temperature
                isFahrenheit={isFahrenheit}
                isDualWidget={isDualWidget}
            />;
        case 'ram':
            return <GaugeWidget
                title='RAM'
                value={memoryInformation}
                isDualWidget={isDualWidget}
            />;
        case 'network':
            return (
                <Box position='relative'>
                    <GaugeWidget
                        title='NET'
                        value={downloadSpeed.normalizedValue} // Use normalized value (MB/s) for the gauge fill
                        total={interfaceSpeed}
                        isDualWidget={isDualWidget}
                        customContent={
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '70%', // Use most of the gauge height
                                pt: 0.5,
                                ml: { xs: 10.75, md: 6.75 }
                            }}>
                                {/* Container for both rows with fixed width icon column */}
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '24px 60px', // Fixed widths for both columns
                                    width: '85%',
                                    gap: 0.2,
                                    alignItems: 'center'
                                }}>
                                    {/* Upload row */}
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        width: '24px', // Fixed width
                                    }}>
                                        <ArrowUpward sx={{
                                            color: 'text.primary',
                                            fontSize: {
                                                xs: isDualWidget ? 11 : 13,
                                                sm: 14,
                                                md: 17,
                                                lg: 17,
                                                xl: 18
                                            }
                                        }} />
                                    </Box>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        width: '100%',
                                        minWidth: '40px' // Minimum width to prevent resizing
                                    }}>
                                        <Typography
                                            fontWeight='medium'
                                            sx={{
                                                width: '100%',
                                                fontSize: {
                                                    xs: isDualWidget ? 8 : 10,
                                                    sm: 10,
                                                    md: 12,
                                                    lg: 12,
                                                    xl: 14
                                                },
                                                lineHeight: 1.2,
                                                whiteSpace: 'nowrap',
                                                display: 'block',
                                                textAlign: 'left'
                                            }}
                                        >
                                            {uploadSpeed.display}
                                        </Typography>
                                    </Box>

                                    {/* Download row */}
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        width: '24px', // Fixed width
                                    }}>
                                        <ArrowDownward sx={{
                                            color: 'text.primary',
                                            fontSize: {
                                                xs: isDualWidget ? 11 : 13,
                                                sm: 14,
                                                md: 17,
                                                lg: 17,
                                                xl: 18
                                            }
                                        }} />
                                    </Box>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        width: '100%',
                                        minWidth: '40px' // Minimum width to prevent resizing
                                    }}>
                                        <Typography
                                            fontWeight='medium'
                                            sx={{
                                                width: '100%',
                                                fontSize: {
                                                    xs: isDualWidget ? 8 : 10,
                                                    sm: 10,
                                                    md: 12,
                                                    lg: 12,
                                                    xl: 14
                                                },
                                                lineHeight: 1.2,
                                                whiteSpace: 'nowrap',
                                                display: 'block',
                                                textAlign: 'left'
                                            }}
                                        >
                                            {downloadSpeed.display}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        }
                    />
                </Box>
            );
        default:
            return null;
        }
    };

    // Function to fetch system information
    const fetchSystemInfo = async () => {
        try {
            setIsLoading(true);
            const res = await DashApi.getSystemInformation(config?.networkInterface);
            setSystemInformation(res);
            getRamPercentage(res);
            getNetworkInformation(res);
            getMainDiskInfo(res);
            // Clear any previous errors on successful data fetch
            setErrorMessage(null);
            setIsLoading(false);
        } catch (err: any) {
            setIsLoading(false);
            // Handle API rate limit errors
            if (err?.response?.status === 429 && err?.response?.data?.error_source === 'labdash_api') {
                console.error(`Lab-Dash API rate limit: ${err.response?.data?.message}`);
                setErrorMessage(`API Rate limit: ${err.response?.data?.message}`);
            } else if (err?.response?.status >= 400) {
                // Handle other API errors
                const message = err?.response?.data?.message || 'Error fetching system data';
                console.error(`API error: ${message}`);
                setErrorMessage(`API error: ${message}`);
            } else if (err?.message) {
                // Handle network or other errors
                console.error(`Error: ${err.message}`);
                setErrorMessage(`Error: ${err.message}`);
            } else {
                setErrorMessage('An unknown error occurred');
            }
        }
    };

    useEffect(() => {
        // Update temperature unit preference from config
        setIsFahrenheit(config?.temperatureUnit !== 'celsius');

        // Immediately fetch data with the current settings
        fetchSystemInfo();

        // Fetch system info every 5 seconds
        const interval = setInterval(() => {
            // Only fetch if there's no error
            if (!errorMessage) {
                fetchSystemInfo();
            }
        }, 5000); // 5000 ms = 5 seconds

        // Clean up the interval when component unmounts or dependencies change
        return () => {
            clearInterval(interval);
        };
    }, [config?.temperatureUnit, config?.networkInterface]);

    // Determine layout styles based on dual widget position
    const containerStyles = {
        width: '100%',
        justifyContent: 'center',
        mt: isDualWidget ? -2 : -1 // Less top margin in dual widget
    };

    // Set gap between gauges based on dual widget status and screen size
    const gapSize = isDualWidget
        ? (isMobile ? 0.5 : 1)  // Smaller gap in dual widget, especially on mobile
        : 2;                    // Normal gap otherwise

    // If there's an error, show full-screen error message
    if (errorMessage) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2
            }}>
                <Typography variant='subtitle1' align='center' sx={{ mb: 1 }}>
                    {errorMessage}
                </Typography>
                <Button
                    variant='contained'
                    color='primary'
                    onClick={fetchSystemInfo}
                    disabled={isLoading}
                    sx={{ mt: 2 }}
                >
                    {isLoading ? 'Retrying...' : 'Retry'}
                </Button>
            </Box>
        );
    }

    // Loading state
    if (isLoading && !systemInformation) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant='body2' sx={{ mb: 2 }}>Loading system data...</Typography>
                    <CircularProgress size={30} />
                </Box>
            </Box>
        );
    }

    return (
        <Grid container gap={0} sx={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
            <div
                onPointerDownCapture={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <IconButton
                    sx={infoButtonStyles}
                    onClick={() => setOpenSystemModal(true)}
                >
                    <IoInformationCircleOutline style={{ color: theme.palette.text.primary, fontSize: '1.5rem' }}/>
                </IconButton>
            </div>

            <Grid container
                gap={gapSize}
                sx={containerStyles}
                flexWrap='nowrap' // Key change: force gauges to stay on one line
                justifyContent='center'
                alignItems='center'
            >
                {visibleGauges.map((gaugeType, index) => (
                    <Grid key={index} sx={{
                        // Reduce size when in dual widget to fit better
                        transform: isDualWidget ? 'scale(0.9)' : 'none',
                        // Center each gauge properly
                        display: 'flex',
                        justifyContent: 'center',
                        // Add negative margin when in dual widget to bring gauges closer
                        ...(isDualWidget && isMobile ? { mx: -0.5 } : {})
                    }}>
                        {renderGauge(gaugeType)}
                    </Grid>
                ))}
            </Grid>
            <Box p={1} width={'92%'} mt={isDualWidget ? -2 : -1}>
                <DiskUsageBar totalSpace={diskInformation?.totalSpace ? diskInformation?.totalSpace : 0} usedSpace={diskInformation?.usedSpace ? diskInformation?.usedSpace : 0} usedPercentage={diskInformation?.usedPercentage ? diskInformation?.usedPercentage : 0}/>
            </Box>
            <CenteredModal open={openSystemModal} handleClose={() => setOpenSystemModal(false)} title='System Information' width={isMobile ? '90vw' :'30vw'} height='60vh'>
                <Box component={Paper} p={2} sx={{ backgroundColor: COLORS.GRAY }} elevation={0}>
                    <Typography><b>Processor:</b> {systemInformation?.cpu?.physicalCores} Core {systemInformation?.cpu?.manufacturer} {systemInformation?.cpu?.brand}</Typography>
                    <Typography><b>Architecture:</b> {systemInformation?.system?.arch} </Typography>
                    <Typography><b>Memory:</b> {`${systemInformation?.memory?.totalInstalled} GB`} </Typography>
                    <Typography><b>OS:</b> {systemInformation?.system?.distro} {systemInformation?.system?.codename} {systemInformation?.system?.release}</Typography>
                    <Typography><b>Kernel:</b> {systemInformation?.system?.kernel}</Typography>
                    <Typography><b>Uptime:</b> {convertSecondsToUptime(systemInformation?.system?.uptime)}</Typography>
                    <Typography><b>CPU Temperature:</b> {systemInformation?.cpu?.main ? formatTemperature(systemInformation?.cpu?.main) : 0}°{isFahrenheit ? 'F' : 'C'}</Typography>
                    <Typography><b>Disk Mount:</b> {diskInformation?.mount}</Typography>
                    <Typography><b>Disk Usage:</b> {`${diskInformation?.usedPercentage?.toFixed(0)}%`}</Typography>
                    <Typography><b>Disk Total:</b> {`${diskInformation?.totalSpace} GB`}</Typography>
                    {systemInformation?.network && (
                        <>
                            <Typography><b>Network Interface:</b> {systemInformation.network.iface}</Typography>
                            <Typography>
                                <b>Upload Speed:</b> {formatNetworkSpeed(systemInformation.network.tx_sec).value} {formatNetworkSpeed(systemInformation.network.tx_sec).unit}
                            </Typography>
                            <Typography>
                                <b>Download Speed:</b> {formatNetworkSpeed(systemInformation.network.rx_sec).value} {formatNetworkSpeed(systemInformation.network.rx_sec).unit}
                            </Typography>
                        </>
                    )}
                </Box>
            </CenteredModal>
        </Grid>
    );
};
