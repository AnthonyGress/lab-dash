import { Box, CardContent, Grid2 as Grid, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { FaHdd } from 'react-icons/fa';

import { DashApi } from '../../../../api/dash-api';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../constants/widget-dimensions';
import { theme } from '../../../../theme/theme';

interface DiskInfo {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
}

interface DiskSelection {
    mount: string;
    customName: string;
    showMountPath?: boolean;
}

interface DiskMonitorWidgetProps {
    config?: {
        selectedDisks?: DiskSelection[];
        showIcons?: boolean;
        showMountPath?: boolean;
        showName?: boolean;
        layout?: '2x2' | '2x4' | '1x5';
        dualWidgetPosition?: 'top' | 'bottom';
    };
    editMode?: boolean;
}

export const DiskMonitorWidget = ({ config, editMode }: DiskMonitorWidgetProps) => {
    const [diskData, setDiskData] = useState<DiskInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isLargeOrSmaller = useMediaQuery(theme.breakpoints.down('xl'));

    // Get config options with defaults
    const selectedDisks = config?.selectedDisks || [];
    const showIcons = config?.showIcons !== false;
    const showName = config?.showName !== false;
    const isDualWidget = config?.dualWidgetPosition !== undefined;
    // Force 2x2 layout for dual widgets to maintain standard widget height
    const layout = isDualWidget ? '2x2' : (config?.layout || '2x2');

    // Helper function to format space dynamically (GB or TB)
    const formatSpace = (bytes: number): string => {
        if (bytes === 0) return '0 GB';
        const gb = bytes / (1024 ** 3);

        // For large and smaller screens, don't show decimals
        if (isLargeOrSmaller) {
            if (gb >= 1000) {
                return `${Math.round(gb / 1000)} TB`;
            }
            return `${Math.round(gb)} GB`;
        }

        // For XL screens, show decimals
        if (gb >= 1000) {
            return `${(gb / 1000).toFixed(1)} TB`;
        }
        return `${gb.toFixed(1)} GB`;
    };

    const fetchDiskData = async () => {
        try {
            setError(null);
            // Only show loading if we don't have existing data
            if (diskData.length === 0) {
                setIsLoading(true);
            }

            const systemInfo = await DashApi.getSystemInformation();

            if (systemInfo?.disk && Array.isArray(systemInfo.disk)) {
                // Filter out network shares or unwanted mounts
                const validDisks = systemInfo.disk.filter((disk: DiskInfo) =>
                    !disk.fs.startsWith('//') &&
                    disk.size > 0 &&
                    disk.mount !== '/dev' &&
                    disk.mount !== '/proc' &&
                    disk.mount !== '/sys' &&
                    !disk.mount.startsWith('/snap/')
                );

                setDiskData(validDisks);
            } else {
                setError('No disk information available');
            }
        } catch (err) {
            console.error('Error fetching disk data:', err);
            setError('Failed to fetch disk information');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!editMode) {
            fetchDiskData();

            // Refresh disk data every 30 seconds
            const interval = setInterval(fetchDiskData, 30000);
            return () => clearInterval(interval);
        }
    }, [editMode]);

    // Create display disks with custom names
    const displayDisks = selectedDisks
        .map(selected => {
            const diskInfo = diskData.find(disk => disk.mount === selected.mount);
            return diskInfo ? {
                ...diskInfo,
                customName: selected.customName || selected.mount
            } : null;
        })
        .filter(Boolean) as (DiskInfo & { customName: string })[];

    // Get max disks based on layout
    const getMaxDisks = () => {
        switch (layout) {
        case '2x2': return 4;
        case '2x4': return 8;
        case '1x5': return 5;
        default: return 4;
        }
    };

    const gridDisks = displayDisks.slice(0, getMaxDisks());

    const DiskItem = ({ disk, diskConfig }: { disk: DiskInfo & { customName: string }, diskConfig: DiskSelection }) => {
        const mountPathRef = useRef<HTMLElement>(null);
        const [showTooltip, setShowTooltip] = useState(false);

        // Calculate accurate usage percentage and ensure data consistency
        const usedSpace = disk.used;
        const totalSpace = disk.size;
        const calculatedFreeSpace = totalSpace - usedSpace; // Calculate free space from total - used
        const calculatedUsagePercent = totalSpace > 0 ? (usedSpace / totalSpace) * 100 : 0;

        // Use the calculated values for consistency
        const displayUsagePercent = calculatedUsagePercent;
        const displayFreeSpace = calculatedFreeSpace;

        useEffect(() => {
            const element = mountPathRef.current;
            if (element) {
                // Check if text is truncated
                setShowTooltip(element.scrollWidth > element.clientWidth);
            }
        }, [disk.mount]);

        return (
            <Box
                sx={{
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    width: '100%',
                    height: 'fit-content',
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)'
                    }
                }}
            >
                {/* Disk Header - Custom name and mount path on same line */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        {showIcons && (
                            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                <FaHdd size={16} color='white' />
                            </Box>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                                variant='subtitle2'
                                sx={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'white',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: '0 0 auto',
                                    maxWidth: '60%'
                                }}
                            >
                                {disk.customName}
                            </Typography>
                            {diskConfig.showMountPath && (
                                showTooltip ? (
                                    <Tooltip
                                        title={disk.mount}
                                        arrow
                                        enterDelay={1000}
                                        placement='top'
                                        slotProps={{
                                            tooltip: {
                                                sx: {
                                                    fontSize: 14,
                                                },
                                            },
                                        }}
                                    >
                                        <Typography
                                            ref={mountPathRef}
                                            variant='caption'
                                            sx={{
                                                fontSize: '0.6rem',
                                                color: 'rgba(255,255,255,0.7)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                flex: '1 1 auto'
                                            }}
                                        >
                                            {disk.mount}
                                        </Typography>
                                    </Tooltip>
                                ) : (
                                    <Typography
                                        ref={mountPathRef}
                                        variant='caption'
                                        sx={{
                                            fontSize: '0.6rem',
                                            color: 'rgba(255,255,255,0.7)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: '1 1 auto'
                                        }}
                                    >
                                        {disk.mount}
                                    </Typography>
                                )
                            )}
                        </Box>
                    </Box>
                    <Typography
                        variant='body2'
                        sx={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: 'white',
                            ml: 1
                        }}
                    >
                        {displayUsagePercent.toFixed(1)}%
                    </Typography>
                </Box>

                {/* Usage Bar */}
                <Box sx={{ position: 'relative', height: 3, borderRadius: 2, overflow: 'hidden', mb: 0.3 }}>
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }}
                    />
                    <Tooltip
                        title={`Used: ${formatSpace(usedSpace)} / ${formatSpace(totalSpace)}`}
                        arrow
                        placement='top'
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: `${displayUsagePercent}%`,
                                height: '100%',
                                backgroundColor: 'primary.main',
                                cursor: 'pointer'
                            }}
                        />
                    </Tooltip>
                </Box>

                {/* Space Info */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant='caption'
                        sx={{
                            fontSize: '0.65rem',
                            color: 'white',
                            flex: '0 1 auto',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {isLargeOrSmaller ? 'F:' : 'Free:'} {formatSpace(displayFreeSpace)}
                    </Typography>
                    <Typography
                        variant='caption'
                        sx={{
                            color: 'white',
                            fontSize: '0.65rem',
                            flex: '0 0 auto',
                            textAlign: 'right'
                        }}
                    >
                        {isLargeOrSmaller ? 'T:' : 'Total:'} {formatSpace(totalSpace)}
                    </Typography>
                </Box>
            </Box>
        );
    };

    return (
        <CardContent sx={{
            height: '100%',
            padding: '0 !important', // Remove all default padding
            maxWidth: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            ...(layout === '2x4' || layout === '1x5' ? {
                minHeight: DUAL_WIDGET_CONTAINER_HEIGHT.sm
            } : {})
        }}>
            <Box sx={{
                flex: 1,
                color: 'white',
                width: '100%',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
            }}>

                {/* Conditionally rendered title */}
                {showName && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: layout === '2x2' ? 0 : 3,
                            left: 16,
                            color: 'white',
                            fontSize: '1.1rem',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}
                    >
                        <FaHdd size={18} color='white' />
                        <Typography
                            variant='h6'
                            sx={{
                                color: 'white',
                                fontSize: '1.1rem',
                            }}
                        >
                            Disk Monitor
                        </Typography>
                    </Box>
                )}
                {error ? (
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <Typography variant='body2' sx={{ textAlign: 'center', mb: 1 }}>
                            Configuration Error
                        </Typography>
                        <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                            {error}
                        </Typography>
                    </Box>
                ) : (gridDisks.length === 0) ? (
                    <Box sx={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '0.85rem'
                    }}>
                        {isLoading ? 'Loading disks...' : 'No disks configured'}
                    </Box>
                ) : (
                    <Box sx={{
                        width: '100%',
                        height: layout === '2x4' || layout === '1x5' ? '100%' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mt: 3
                    }}>
                        <Grid container spacing={layout === '2x2' ? 0.75 : 1} sx={{
                            width: '100%',
                            maxWidth: '100%'
                        }}>
                            {gridDisks.map((disk, index) => {
                                const getGridSize = () => {
                                    switch (layout) {
                                    case '2x2': return 6; // 2 columns
                                    case '2x4': return 6; // 2 columns
                                    case '1x5': return 12; // 1 column
                                    default: return 6;
                                    }
                                };

                                // Determine alignment based on position
                                const getAlignment = () => {
                                    if (layout === '1x5') return 'flex-start'; // All left aligned for single column

                                    // For 2-column layouts (2x2, 2x4)
                                    const isLeftColumn = index % 2 === 0;
                                    return isLeftColumn ? 'flex-start' : 'flex-end';
                                };

                                // Find the disk configuration
                                const diskConfig = selectedDisks.find(d => d.mount === disk.mount) || { mount: disk.mount, customName: disk.customName };

                                return (
                                    <Grid key={disk.mount} size={getGridSize()} sx={{
                                        display: 'flex',
                                        justifyContent: getAlignment(),
                                        alignItems: 'stretch',
                                    // minHeight: layout === '2x2' ? '60px' : layout === '1x5' ? '100%' : '100%'
                                    }}>
                                        <DiskItem disk={disk} diskConfig={diskConfig} />
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                )}
            </Box>
        </CardContent>
    );
};
