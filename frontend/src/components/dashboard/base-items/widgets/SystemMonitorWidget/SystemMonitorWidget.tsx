import { ArrowDownward, ArrowUpward } from '@mui/icons-material';
import { Box, Grid2 as Grid, IconButton, Paper, Typography } from '@mui/material';
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

    // Default gauges if not specified in config
    const selectedGauges = config?.gauges || ['cpu', 'temp', 'ram'];

    // Filter out 'none' option from selected gauges
    const visibleGauges = selectedGauges.filter(gauge => gauge !== 'none');

    const isMobile = useIsMobile();

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
    const formatNetworkSpeed = (bytesPerSecond: number): { value: number; unit: string; normalizedValue: number } => {
        // Handle undefined or null values
        if (bytesPerSecond === undefined || bytesPerSecond === null) {
            return { value: 0, unit: 'KB/s', normalizedValue: 0 };
        }

        // If less than 1 MB/s, show in KB/s
        if (bytesPerSecond < 1024 * 1024) {
            return {
                value: Math.round(bytesPerSecond / 1024), // Convert to KB/s for display
                unit: 'KB/s',
                normalizedValue: bytesPerSecond / (1024 * 1024) // Always normalize to MB/s for gauge fill
            };
        }

        // Otherwise show in MB/s
        return {
            value: Math.round(bytesPerSecond / (1024 * 1024) * 10) / 10, // Convert to MB/s with 1 decimal for display
            unit: 'MB/s',
            normalizedValue: bytesPerSecond / (1024 * 1024) // Normalize to MB/s for gauge fill
        };
    };

    // Format number for display (add K suffix for thousands)
    const formatNumberForDisplay = (num: number): string => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
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
        } catch (error) {
            console.error('Error getting disk info:', error);
            return null;
        }
    };

    // Render a specific gauge based on type
    const renderGauge = (gaugeType: GaugeType) => {
        // Pre-calculate network values outside the switch statement
        const downloadSpeed = formatNetworkSpeed(networkInformation.downloadSpeed);
        const uploadSpeed = formatNetworkSpeed(networkInformation.uploadSpeed);

        // Calculate dynamic maximum value for network gauge
        const interfaceSpeed = networkInformation.interfaceSpeed || 1000; // Default to 1 Gbps
        const maxSpeedMBs = interfaceSpeed / 8; // Convert to MB/s
        const dynamicMax = maxSpeedMBs > 100
            ? Math.max(1, downloadSpeed.normalizedValue * 10) // Scale for better visualization on fast networks
            : maxSpeedMBs;

        switch (gaugeType) {
        case 'cpu':
            return <GaugeWidget
                title='CPU'
                value={systemInformation?.cpu?.currentLoad ? Math.round(systemInformation?.cpu?.currentLoad) : 0}
            />;
        case 'temp':
            return <GaugeWidget
                title='TEMP'
                value={systemInformation?.cpu?.main ? formatTemperature(systemInformation?.cpu?.main) : 0}
                temperature
                isFahrenheit={isFahrenheit}
            />;
        case 'ram':
            return <GaugeWidget title='RAM' value={memoryInformation} />;
        case 'network':
            return (
                <Box position='relative'>
                    <GaugeWidget
                        title='NET'
                        value={downloadSpeed.normalizedValue} // Use normalized value (MB/s) for the gauge fill
                        total={dynamicMax}
                        customContent={
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '70%', // Use most of the gauge height
                                pt: 0.5,
                                ml: -6.5
                            }}>
                                {/* Container for both rows with fixed width icon column */}
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '16px 1fr',
                                    width: '80%', // Increased width for more text space
                                    gap: 0.5,
                                    alignItems: 'center'
                                }}>
                                    {/* Upload row */}
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%'
                                    }}>
                                        <ArrowUpward sx={{ color: 'white', fontSize: '0.7rem' }} />
                                    </Box>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        width: '100%'
                                    }}>
                                        <Typography
                                            fontWeight='medium'
                                            sx={{
                                                width: '100%',
                                                fontSize: 'clamp(6px, 2.5vw, 11px)', // Dynamic font sizing
                                                lineHeight: 1.2,
                                                whiteSpace: 'nowrap',
                                                display: 'block'
                                            }}
                                        >
                                            {formatNumberForDisplay(uploadSpeed.value)} {uploadSpeed.unit.replace('/s', '')}
                                        </Typography>
                                    </Box>

                                    {/* Download row */}
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%'
                                    }}>
                                        <ArrowDownward sx={{ color: 'white', fontSize: '0.7rem' }} />
                                    </Box>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        width: '100%'
                                    }}>
                                        <Typography
                                            fontWeight='medium'
                                            sx={{
                                                width: '100%',
                                                fontSize: 'clamp(6px, 2.5vw, 11px)', // Dynamic font sizing
                                                lineHeight: 1.2,
                                                whiteSpace: 'nowrap',
                                                display: 'block'
                                            }}
                                        >
                                            {formatNumberForDisplay(downloadSpeed.value)} {downloadSpeed.unit.replace('/s', '')}
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

    useEffect(() => {
        // Update temperature unit preference from config
        setIsFahrenheit(config?.temperatureUnit !== 'celsius');

        // Define the data fetching function inside the effect to avoid recreating it on every render
        const fetchSystemInfo = async () => {
            const res = await DashApi.getSystemInformation(config?.networkInterface);
            setSystemInformation(res);
            getRamPercentage(res);
            getNetworkInformation(res);
            getMainDiskInfo(res);
        };

        // Immediately fetch data with the current settings
        fetchSystemInfo();

        // Fetch system info every 5 seconds
        const interval = setInterval(() => {
            fetchSystemInfo();
        }, 5000); // 5000 ms = 5 seconds

        // Clean up the interval when component unmounts or dependencies change
        return () => {
            clearInterval(interval);
        };
    }, [config?.temperatureUnit, config?.networkInterface]);

    return (
        <Grid container gap={0} sx={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
            <div
                onPointerDownCapture={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: -5,
                        left: -5,
                        zIndex: 99
                    }}
                    onClick={() => setOpenSystemModal(true)}
                >
                    <IoInformationCircleOutline style={{ color: theme.palette.text.primary, fontSize: '1.5rem' }}/>
                </IconButton>
            </div>
            <Grid container gap={2} mt={-1}>
                {visibleGauges.map((gaugeType, index) => (
                    <Grid key={index}>
                        {renderGauge(gaugeType)}
                    </Grid>
                ))}
            </Grid>
            <Box p={1} width={'92%'} mt={-1}>
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
                                <b>Interface Speed:</b> {systemInformation.network.speed || 1000} Mbps
                            </Typography>
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
