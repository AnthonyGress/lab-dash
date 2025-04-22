import { Box, Button, CircularProgress, Grid, Menu, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { FaGlobe, FaList, FaPercentage } from 'react-icons/fa';
import { MdBlockFlipped, MdDns, MdPause, MdPlayArrow } from 'react-icons/md';

import { DashApi } from '../../../../../api/dash-api';
import { BACKEND_URL } from '../../../../../constants/constants';
import { COLORS } from '../../../../../theme/styles';
import { formatNumber } from '../../../../../utils/utils';

type PiholeWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    apiToken?: string;
    refreshInterval?: number;
    showLabel?: boolean;
};

type PiholeStats = {
    domains_being_blocked?: number;
    dns_queries_today?: number;
    ads_blocked_today?: number;
    ads_percentage_today?: number | string;
    status?: string;
};

const initialStats: PiholeStats = {
    domains_being_blocked: 0,
    dns_queries_today: 0,
    ads_blocked_today: 0,
    ads_percentage_today: 0,
    status: 'unknown'
};

export const PiholeWidget = (props: { config?: PiholeWidgetConfig }) => {
    const { config } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);
    const [stats, setStats] = useState<PiholeStats>(initialStats);
    const [error, setError] = useState<string | null>(null);
    const [piholeConfig, setPiholeConfig] = useState({
        host: config?.host || 'pi.hole',
        port: config?.port || '80',
        ssl: config?.ssl || false,
        apiToken: config?.apiToken || '',
        showLabel: config?.showLabel
    });

    // State for disable/enable blocking functionality
    const [isBlocking, setIsBlocking] = useState(true);
    const [disableMenuAnchor, setDisableMenuAnchor] = useState<null | HTMLElement>(null);
    const [isDisablingBlocking, setIsDisablingBlocking] = useState(false);
    const [disableEndTime, setDisableEndTime] = useState<Date | null>(null);
    const [disableTimer, setDisableTimer] = useState<NodeJS.Timeout | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');

    // Update remaining time every second
    useEffect(() => {
        if (!disableEndTime) {
            setRemainingTime('');
            return;
        }

        // Update immediately
        updateRemainingTime();

        // Then update every second
        const interval = setInterval(() => {
            updateRemainingTime();
        }, 1000);

        return () => clearInterval(interval);
    }, [disableEndTime]);

    // Function to update remaining time
    const updateRemainingTime = () => {
        if (!disableEndTime) {
            setRemainingTime('');
            return;
        }

        const now = new Date();
        const diffMs = disableEndTime.getTime() - now.getTime();

        if (diffMs <= 0) {
            setRemainingTime('Enabling...');
            return;
        }

        const diffSec = Math.floor(diffMs / 1000);
        const minutes = Math.floor(diffSec / 60);
        const seconds = diffSec % 60;

        setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    // Update config when props change
    useEffect(() => {
        if (config) {
            setPiholeConfig({
                host: config.host || 'pi.hole',
                port: config.port || '80',
                ssl: config.ssl || false,
                apiToken: config.apiToken || '',
                showLabel: config.showLabel
            });

            // Consider configured if we have a host and token
            setIsConfigured(!!config.host && !!config.apiToken);
        }
    }, [config]);

    const fetchStats = useCallback(async () => {
        if (!isConfigured || !piholeConfig.host || !piholeConfig.apiToken) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const piholeStats = await DashApi.getPiholeStats(piholeConfig);
            console.log('Pi-hole API response:', piholeStats);
            console.log('Pi-hole percentage value:', piholeStats.ads_percentage_today,
                'Type:', typeof piholeStats.ads_percentage_today);

            // Set stats from API response
            setStats(piholeStats);

            // Update blocking status based on API response
            if (piholeStats.status === 'disabled') {
                setIsBlocking(false);
            } else {
                setIsBlocking(true);
            }

        } catch (err: any) {
            console.error('Error fetching Pi-hole stats:', err);
            setError(err.message || 'Failed to connect to Pi-hole');

            // If there's a decryption error, show a more specific message
            if (err.message?.includes('decrypt')) {
                setError('Failed to decrypt API token. Please update your credentials in the widget settings.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [isConfigured, piholeConfig]);

    // Fetch stats on mount and when config changes
    useEffect(() => {
        if (isConfigured) {
            fetchStats();
        }
    }, [isConfigured, fetchStats]);

    // Set up refresh interval
    useEffect(() => {
        if (!isConfigured) return;

        const interval = setInterval(() => {
            fetchStats();
        }, config?.refreshInterval || 10000); // Default 10 seconds

        return () => clearInterval(interval);
    }, [isConfigured, fetchStats, config?.refreshInterval]);

    // Clean up disable timer on unmount
    useEffect(() => {
        return () => {
            if (disableTimer) {
                clearTimeout(disableTimer);
            }
        };
    }, [disableTimer]);

    // Handle disable blocking with timeout
    const handleDisableBlocking = async (seconds: number | null) => {
        if (!isConfigured || !piholeConfig.apiToken) return;

        setIsDisablingBlocking(true);
        setDisableMenuAnchor(null);

        try {
            // Call the backend API to disable blocking
            const result = await DashApi.disablePihole(
                {
                    host: piholeConfig.host,
                    port: piholeConfig.port,
                    ssl: piholeConfig.ssl,
                    apiToken: piholeConfig.apiToken
                },
                seconds || undefined
            );

            if (result) {
                // Set local state
                setIsBlocking(false);

                // Set timer for auto re-enable if seconds is provided
                if (seconds) {
                    // Calculate end time
                    const endTime = new Date();
                    endTime.setSeconds(endTime.getSeconds() + seconds);
                    setDisableEndTime(endTime);

                    // Clear any existing timer
                    if (disableTimer) {
                        clearTimeout(disableTimer);
                    }

                    // Set new timer
                    const timer = setTimeout(() => {
                        handleEnableBlocking();
                        setDisableEndTime(null);
                    }, seconds * 1000);

                    setDisableTimer(timer as unknown as NodeJS.Timeout);
                } else {
                    // Indefinite disable
                    setDisableEndTime(null);
                    if (disableTimer) {
                        clearTimeout(disableTimer);
                        setDisableTimer(null);
                    }
                }

                // Refresh stats
                setTimeout(fetchStats, 1000);
            } else {
                throw new Error('Failed to disable Pi-hole blocking');
            }
        } catch (err) {
            console.error('Error disabling Pi-hole:', err);
            setError('Failed to disable Pi-hole blocking');
        } finally {
            setIsDisablingBlocking(false);
        }
    };

    // Handle enable blocking
    const handleEnableBlocking = async () => {
        if (!isConfigured || !piholeConfig.apiToken) return;

        setIsDisablingBlocking(true);

        try {
            // Call the backend API to enable blocking
            const result = await DashApi.enablePihole({
                host: piholeConfig.host,
                port: piholeConfig.port,
                ssl: piholeConfig.ssl,
                apiToken: piholeConfig.apiToken
            });

            if (result) {
                // Set local state
                setIsBlocking(true);
                setDisableEndTime(null);

                // Clear any existing timer
                if (disableTimer) {
                    clearTimeout(disableTimer);
                    setDisableTimer(null);
                }

                // Refresh stats
                setTimeout(fetchStats, 1000);
            } else {
                throw new Error('Failed to enable Pi-hole blocking');
            }
        } catch (err) {
            console.error('Error enabling Pi-hole:', err);
            setError('Failed to enable Pi-hole blocking');
        } finally {
            setIsDisablingBlocking(false);
        }
    };

    // Handle menu open
    const handleDisableMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setDisableMenuAnchor(event.currentTarget);
    };

    // Handle menu close
    const handleDisableMenuClose = () => {
        setDisableMenuAnchor(null);
    };

    // Format remaining time (use the state value now)
    const formatRemainingTime = (): string => {
        return remainingTime;
    };

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
                <Typography variant='subtitle1' color='error' align='center'>
                    {error}
                </Typography>
                <Button
                    variant='contained'
                    color='primary'
                    sx={{ mt: 2 }}
                    onClick={() => fetchStats()}
                >
                    Retry
                </Button>
            </Box>
        );
    }

    if (!isConfigured) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <Typography variant='subtitle1'>
                    Please configure the Pi-hole widget in settings
                </Typography>
            </Box>
        );
    }

    if (isLoading && !stats.domains_being_blocked) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <CircularProgress size={30} />
            </Box>
        );
    }

    // Convert percentage to number if it's a string
    const parsePercentage = (value: number | string | undefined): number => {
        if (value === undefined) return 0;
        if (typeof value === 'number') return value;

        // Handle string representation
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Get percentage as a number for the progress circle
    const blockPercentage = parsePercentage(stats.ads_percentage_today);

    // Format the percentage text
    const percentageText = blockPercentage.toFixed(1);

    console.log('Rendered percentage values:', {
        original: stats.ads_percentage_today,
        parsed: blockPercentage,
        formatted: percentageText
    });

    return (
        <Box sx={{ p: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, mt: 1.5 }}>
                {piholeConfig.showLabel && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <img
                            src={`${BACKEND_URL}/icons/pihole.svg`}
                            alt='Pi-hole logo'
                            style={{
                                width: '35px',
                                height: '35px',
                                marginRight: '8px'
                            }}
                        />
                        <Typography variant='h6' gutterBottom sx={{ mb: 0 }}>
                            Pi-hole
                        </Typography>
                    </Box>
                )}

                {/* Blocking controls */}
                <Button
                    variant='text'
                    startIcon={isBlocking ? <MdPause /> : <MdPlayArrow />}
                    onClick={isBlocking ? handleDisableMenuClick : handleEnableBlocking}
                    disabled={isDisablingBlocking}
                    sx={{
                        height: 30,
                        fontSize: '0.75rem',
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        },
                        ml: piholeConfig.showLabel ? undefined : 'auto' // Push button to the right when label is hidden
                    }}
                >
                    {isBlocking ? 'Disable' : (disableEndTime ? `Resume (${formatRemainingTime()})` : 'Resume')}
                </Button>

                {/* Disable interval menu */}
                <Menu
                    anchorEl={disableMenuAnchor}
                    open={Boolean(disableMenuAnchor)}
                    onClose={handleDisableMenuClose}
                >
                    <MenuItem onClick={() => handleDisableBlocking(10)}>10 seconds</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(30)}>30 seconds</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(60)}>1 minute</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(300)}>5 minutes</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(1800)}>30 minutes</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(3600)}>1 hour</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(null)}>Indefinitely</MenuItem>
                </Menu>
            </Box>

            <Grid container spacing={2}>
                {/* Blocked Today */}
                <Grid item xs={6}>
                    <Paper
                        elevation={0}
                        sx={{
                            backgroundColor: '#74281E', // Red
                            p: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}
                    >
                        <MdBlockFlipped style={{ fontSize: '2rem' }} />
                        <Typography variant='subtitle1' align='center'>
                            Blocked Today
                        </Typography>
                        <Typography variant='h6' align='center' fontWeight='bold'>
                            {formatNumber(stats.ads_blocked_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Percent Blocked */}
                <Grid item xs={6}>
                    <Paper
                        elevation={0}
                        sx={{
                            backgroundColor: '#8E5B0A', // Orange
                            p: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '2rem' }}>
                            <FaPercentage style={{ fontSize: '2rem' }} />
                        </Box>
                        <Typography variant='subtitle1' align='center'>
                            Percent Blocked
                        </Typography>
                        <Typography variant='h6' align='center' fontWeight='bold'>
                            {percentageText}%
                        </Typography>
                    </Paper>
                </Grid>

                {/* Queries Today */}
                <Grid item xs={6}>
                    <Paper
                        elevation={0}
                        sx={{
                            backgroundColor: '#006179', // blue
                            p: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}
                    >
                        <FaGlobe style={{ fontSize: '2rem' }} />
                        <Typography variant='subtitle1' align='center'>
                            Queries Today
                        </Typography>
                        <Typography variant='h6' align='center' fontWeight='bold'>
                            {formatNumber(stats.dns_queries_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Domains on Adlists */}
                <Grid item xs={6}>
                    <Paper
                        elevation={0}
                        sx={{
                            backgroundColor: '#004A28', // Green
                            p: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}
                    >
                        <FaList style={{ fontSize: '2rem' }} />
                        <Typography variant='subtitle1' align='center'>
                            Domains on Adlists
                        </Typography>
                        <Typography variant='h6' align='center' fontWeight='bold'>
                            {formatNumber(stats.domains_being_blocked || 0)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Status indicator */}
            {!isBlocking && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant='body2' color='error'>
                        {disableEndTime
                            ? `Blocking disabled. Will resume in ${formatRemainingTime()}`
                            : 'Blocking disabled indefinitely'}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};
