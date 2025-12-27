import { Box, Button, CircularProgress, Grid2 as Grid, Paper, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { FaClock, FaGlobe, FaNetworkWired, FaServer } from 'react-icons/fa';

import { DashApi } from '../../../../api/dash-api';

interface NetworkInfoWidgetConfig {
    targetHost?: string;
    refreshInterval?: number; // in milliseconds
    showLabel?: boolean;
    displayName?: string;
    showTargetHost?: boolean;
}

interface NetworkInfoWidgetProps {
    config?: NetworkInfoWidgetConfig;
    editMode?: boolean;
}

interface NetworkData {
    publicIp: string | null;
    latency: number | null;
    status: 'online' | 'offline';
    lastChecked: Date | null;
}

// Format the last checked time as relative time (e.g., "5s ago", "2m ago")
const formatLastChecked = (date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}h ago`;
};

export const NetworkInfoWidget = ({ config, editMode }: NetworkInfoWidgetProps) => {
    const [networkData, setNetworkData] = useState<NetworkData>({
        publicIp: null,
        latency: null,
        status: 'offline',
        lastChecked: null
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, setTick] = useState(0); // For forcing re-render to update "last checked" display
    const isMountedRef = useRef(true);

    // Get config options with defaults
    const targetHost = config?.targetHost || '8.8.8.8';
    const refreshInterval = config?.refreshInterval || 30000; // Default 30 seconds
    const showLabel = config?.showLabel !== false;
    const displayName = config?.displayName || 'Network Info';
    const showTargetHost = config?.showTargetHost !== false;

    const fetchNetworkData = async () => {
        if (!isMountedRef.current) return;

        try {
            // Only show loading on initial load, not on refresh
            if (!networkData.publicIp && !networkData.latency) {
                setIsLoading(true);
            }

            // Fetch public IP and ping stats in parallel
            const [ipResult, pingResult] = await Promise.all([
                DashApi.getPublicIp().catch(err => {
                    console.error('Failed to fetch public IP:', err);
                    return { ip: null };
                }),
                DashApi.getPingStats(targetHost).catch(err => {
                    console.error('Failed to fetch ping stats:', err);
                    return { latency: null, status: 'offline' as const };
                })
            ]);

            if (!isMountedRef.current) return;

            setNetworkData({
                publicIp: ipResult.ip || null,
                latency: pingResult.latency,
                status: pingResult.status,
                lastChecked: new Date()
            });
            setError(null);
        } catch (err: any) {
            if (!isMountedRef.current) return;

            console.error('Error fetching network data:', err);
            if (err?.response?.status === 429) {
                setError('Rate limit exceeded. Please try again later.');
            } else {
                setError('Failed to fetch network information');
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        isMountedRef.current = true;

        if (!editMode) {
            fetchNetworkData();

            // Set up refresh interval for fetching data
            const dataInterval = setInterval(fetchNetworkData, refreshInterval);

            // Set up a 1-second interval to update the "last checked" display
            const tickInterval = setInterval(() => {
                setTick(t => t + 1);
            }, 1000);

            return () => {
                isMountedRef.current = false;
                clearInterval(dataInterval);
                clearInterval(tickInterval);
            };
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [editMode, targetHost, refreshInterval]);

    // Error state
    if (error) {
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
                    {error}
                </Typography>
                <Button
                    variant='contained'
                    color='primary'
                    onClick={() => {
                        setError(null);
                        fetchNetworkData();
                    }}
                    disabled={isLoading}
                    sx={{ mt: 2 }}
                >
                    {isLoading ? 'Retrying...' : 'Retry'}
                </Button>
            </Box>
        );
    }

    // Loading state
    if (isLoading && !networkData.publicIp && !networkData.latency) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant='body2' sx={{ mb: 2 }}>Loading network info...</Typography>
                    <CircularProgress size={30} />
                </Box>
            </Box>
        );
    }

    const statBoxStyle = {
        p: '8px 6px',
        minHeight: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        cursor: editMode ? 'grab' : 'default',
        borderRadius: 1
    };

    return (
        <Box sx={{ p: 0.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {showLabel && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <FaNetworkWired style={{ marginRight: '8px', fontSize: '1.1rem' }} />
                            <Typography variant='h6' sx={{ mb: 0, fontSize: '1rem' }}>
                                {displayName}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Stats Grid - 2x2 layout */}
            <Grid container spacing={0.4} sx={{ flex: 1 }}>
                {/* Public IP */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            ...statBoxStyle,
                            backgroundColor: '#006179'
                        }}
                    >
                        <FaGlobe style={{ fontSize: '1.2rem', marginBottom: '4px', opacity: 0.9 }} />
                        <Typography variant='caption' align='center' sx={{ fontSize: '0.65rem', opacity: 0.9, mb: 0.25 }}>
                            Public IP
                        </Typography>
                        <Typography
                            variant='subtitle2'
                            align='center'
                            fontWeight='bold'
                            sx={{
                                fontSize: '0.8rem',
                                lineHeight: 1.2,
                                wordBreak: 'break-all'
                            }}
                        >
                            {networkData.publicIp || 'N/A'}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Latency */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            ...statBoxStyle,
                            backgroundColor: networkData.status === 'online' ? '#004A28' : '#74281E'
                        }}
                    >
                        <FaNetworkWired style={{ fontSize: '1.2rem', marginBottom: '4px', opacity: 0.9 }} />
                        <Typography variant='caption' align='center' sx={{ fontSize: '0.65rem', opacity: 0.9, mb: 0.25 }}>
                            Latency
                        </Typography>
                        <Typography
                            variant='subtitle2'
                            align='center'
                            fontWeight='bold'
                            sx={{ fontSize: '0.9rem', lineHeight: 1 }}
                        >
                            {networkData.status === 'online' && networkData.latency !== null
                                ? `${networkData.latency} ms`
                                : 'Offline'}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Target Host */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            ...statBoxStyle,
                            backgroundColor: '#1a237e'
                        }}
                    >
                        <FaServer style={{ fontSize: '1.2rem', marginBottom: '4px', opacity: 0.9 }} />
                        <Typography variant='caption' align='center' sx={{ fontSize: '0.65rem', opacity: 0.9, mb: 0.25 }}>
                            Target Host
                        </Typography>
                        <Typography
                            variant='subtitle2'
                            align='center'
                            fontWeight='bold'
                            sx={{
                                fontSize: '0.75rem',
                                lineHeight: 1.2,
                                wordBreak: 'break-all',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {targetHost}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Last Checked */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            ...statBoxStyle,
                            backgroundColor: '#4a148c'
                        }}
                    >
                        <FaClock style={{ fontSize: '1.2rem', marginBottom: '4px', opacity: 0.9 }} />
                        <Typography variant='caption' align='center' sx={{ fontSize: '0.65rem', opacity: 0.9, mb: 0.25 }}>
                            Last Checked
                        </Typography>
                        <Typography
                            variant='subtitle2'
                            align='center'
                            fontWeight='bold'
                            sx={{ fontSize: '0.9rem', lineHeight: 1 }}
                        >
                            {formatLastChecked(networkData.lastChecked)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};
