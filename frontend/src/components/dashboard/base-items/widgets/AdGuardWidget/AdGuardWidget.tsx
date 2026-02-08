import { Box, Button, CircularProgress, Grid2 as Grid, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaPercentage } from 'react-icons/fa';
import { FaShield } from 'react-icons/fa6';
import { MdBlockFlipped, MdDns, MdPause, MdPlayArrow } from 'react-icons/md';

import { DashApi } from '../../../../../api/dash-api';
import { BACKEND_URL } from '../../../../../constants/constants';
import { useAppContext } from '../../../../../context/useAppContext';
import { formatNumber } from '../../../../../utils/utils';

// Define our own Timeout type based on setTimeout's return type
type TimeoutId = ReturnType<typeof setTimeout>;

type AdGuardWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    _hasUsername?: boolean;
    _hasPassword?: boolean;
    username?: string; // For backward compatibility with existing configs
    password?: string; // For backward compatibility with existing configs
    showLabel?: boolean;
    displayName?: string;
};

type AdGuardStats = {
    domains_being_blocked?: number;
    dns_queries_today?: number;
    ads_blocked_today?: number;
    ads_percentage_today?: number | string;
    status?: string;
    timer?: number | null; // Frontend timer for consistency with Pi-hole
};

const initialStats: AdGuardStats = {
    domains_being_blocked: 0,
    dns_queries_today: 0,
    ads_blocked_today: 0,
    ads_percentage_today: 0,
    status: 'unknown',
    timer: null
};

export const AdGuardWidget = (props: { config?: AdGuardWidgetConfig; id?: string }) => {
    const { config, id } = props;
    const { editMode, config: appConfig } = useAppContext();

    // Reference to track if this is the first render
    const isFirstRender = useRef(true);

    const [isLoading, setIsLoading] = useState(false);
    const [isConfigured, setIsConfigured] = useState(() => {
        // Initialize with a proper check of the config
        if (config) {
            // Check for either security flags OR actual encrypted credentials
            const hasCredentials = (!!config._hasUsername && !!config._hasPassword) ||
                                   (!!config.username && !!config.password);
            return !!config.host && hasCredentials;
        }
        return false;
    });
    const [stats, setStats] = useState<AdGuardStats>(initialStats);
    const [error, setError] = useState<string | null>(null);
    const [adguardConfig, setAdguardConfig] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '3000', // AdGuard Home default web interface port
        ssl: config?.ssl || false,
        _hasUsername: config?._hasUsername || false,
        _hasPassword: config?._hasPassword || false,
        showLabel: config?.showLabel,
        displayName: config?.displayName || 'AdGuard Home'
    });

    // State for disable/enable blocking functionality (matching Pi-hole naming)
    const [isBlocking, setIsBlocking] = useState(true);
    const [disableMenuAnchor, setDisableMenuAnchor] = useState<null | HTMLElement>(null);
    const [isDisablingBlocking, setIsDisablingBlocking] = useState(false);
    const [disableEndTime, setDisableEndTime] = useState<Date | null>(null);
    const [disableTimer, setDisableTimer] = useState<TimeoutId | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');

    // Add a state to track authentication failures
    const [authFailed, setAuthFailed] = useState(false);

    // Add a ref to store the refresh interval
    const refreshIntervalRef = useRef<TimeoutId | null>(null);

    // Add a ref to store the status check interval
    const statusCheckIntervalRef = useRef<TimeoutId | null>(null);

    // Add a ref to track component mounted state to prevent updates after unmount
    const isMountedRef = useRef<boolean>(true);

    // Helper function to get the base URL for navigation
    const getBaseUrl = () => {
        if (!adguardConfig.host) return '';

        // Strip any existing protocol prefix
        const cleanHost = adguardConfig.host.replace(/^https?:\/\//, '');
        const protocol = adguardConfig.ssl ? 'https' : 'http';
        const port = adguardConfig.port ? `:${adguardConfig.port}` : '';

        return `${protocol}://${cleanHost}${port}`;
    };

    // Helper function to safely update state only if component is still mounted
    const safeSetState = (updateFunction: () => void) => {
        if (isMountedRef.current) {
            updateFunction();
        }
    };

    // Main function to fetch AdGuard Home statistics
    const fetchStats = useCallback(async () => {
        if (!isConfigured || !id) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            setAuthFailed(false);

            const data = await DashApi.getAdGuardStats(id);

            safeSetState(() => {
                setStats(data);
                setError(null);
                setAuthFailed(false);

                // Update isBlocking based on status
                if (data.status === 'enabled') {
                    setIsBlocking(true);
                } else if (data.status === 'disabled') {
                    setIsBlocking(false);
                }
            });
        } catch (err: any) {
            console.error('Failed to fetch AdGuard stats:', err);

            safeSetState(() => {
                if (err?.adguard?.requiresReauth) {
                    setAuthFailed(true);
                    setError('Authentication failed. Please reconfigure your AdGuard Home credentials.');
                } else if (err.message?.includes('Item not found in configuration')) {
                    // Handle "Item not found" errors - this might be a timing issue during duplication
                    console.log('🔄 AdGuard: Item not found, retrying in 2s (duplication timing)');
                    // Schedule a retry after a short delay instead of setting permanent error
                    setTimeout(() => {
                        if (isMountedRef.current && !error && !authFailed) {
                            fetchStats();
                        }
                    }, 2000); // Retry after 2 seconds
                    return; // Exit without setting error state
                } else {
                    setError(err.message || 'Failed to fetch AdGuard Home statistics');
                }
                setStats(initialStats);
            });
        } finally {
            safeSetState(() => {
                setIsLoading(false);
            });
        }
    }, [isConfigured, id]);

    // Effect to update configuration when props change
    useEffect(() => {
        if (config) {
            const newConfig = {
                host: config.host || 'localhost',
                port: config.port !== undefined ? config.port : (adguardConfig.port || '3000'), // AdGuard Home default web interface port
                ssl: config.ssl || false,
                _hasUsername: config._hasUsername || false,
                _hasPassword: config._hasPassword || false,
                showLabel: config.showLabel,
                displayName: config.displayName || 'AdGuard Home'
            };

            setAdguardConfig(newConfig);

            const newIsConfigured = !!config.host && (!!config._hasUsername && !!config._hasPassword);
            setIsConfigured(newIsConfigured);
        }
    }, [config, id]);

    // Set isMounted on mount and clear on unmount
    useEffect(() => {
        isMountedRef.current = true;

        // Special initialization logic for first render
        if (isFirstRender.current) {
            isFirstRender.current = false;

            // Force configuration validation on mount
            const isValid = !!adguardConfig.host && (!!adguardConfig._hasUsername && !!adguardConfig._hasPassword);
            if (isValid !== isConfigured) {
                setIsConfigured(isValid);
            }

            // If valid, trigger an initial status check
            if (isValid) {
                setIsLoading(true);

                // Use a small timeout to ensure state updates have completed
                setTimeout(() => {
                    if (isMountedRef.current && !error && !authFailed) {
                        fetchStats();
                    }
                }, 200);
            }
        }

        return () => {
            isMountedRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initial fetch and setup refresh interval
    useEffect(() => {
        if (isConfigured && !editMode) {
            fetchStats();

            // Set up refresh interval (every 30 seconds)
            refreshIntervalRef.current = setInterval(() => {
                fetchStats();
            }, 30000);
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
        };
    }, [isConfigured, editMode, fetchStats]);

    // Handle disable protection with timer options
    const handleDisableProtection = async (seconds?: number) => {
        if (!id) return;

        try {
            setIsDisablingBlocking(true);
            await DashApi.disableAdGuard(id, seconds);

            safeSetState(() => {
                setIsBlocking(false);
                setDisableMenuAnchor(null);

                if (seconds) {
                    // Set up frontend timer for display
                    const endTime = new Date(Date.now() + seconds * 1000);
                    setDisableEndTime(endTime);

                    // Set up a timeout to re-enable protection and refresh stats
                    const timer = setTimeout(async () => {
                        try {
                            // Re-enable protection when timer expires
                            await DashApi.enableAdGuard(id);

                            safeSetState(() => {
                                setIsBlocking(true);
                                setDisableEndTime(null);
                                setDisableTimer(null);
                            });

                            // Refresh stats after re-enabling
                            setTimeout(() => fetchStats(), 1000);
                        } catch (timerError) {
                            console.error('Failed to re-enable AdGuard protection after timer:', timerError);
                            // Even if re-enable fails, clear the timer state
                            safeSetState(() => {
                                setDisableEndTime(null);
                                setDisableTimer(null);
                                // Refresh stats to get current state
                                fetchStats();
                            });
                        }
                    }, seconds * 1000);

                    setDisableTimer(timer);
                }
            });

            // Refresh stats immediately after disabling
            setTimeout(() => fetchStats(), 1000);
        } catch (err: any) {
            console.error('Failed to disable AdGuard protection:', err);
            safeSetState(() => {
                if (err.message?.includes('Item not found in configuration')) {
                    // Handle "Item not found" errors - this might be a timing issue during duplication
                    console.log('🔄 AdGuard: Disable failed, retrying in 2s (duplication timing)');
                    // Schedule a retry after a short delay instead of setting permanent error
                    setTimeout(() => {
                        if (isMountedRef.current && !error && !authFailed) {
                            handleDisableProtection(seconds);
                        }
                    }, 2000); // Retry after 2 seconds
                    return; // Exit without setting error state
                } else {
                    setError(err.message || 'Failed to disable AdGuard Home protection');
                }
            });
        } finally {
            safeSetState(() => {
                setIsDisablingBlocking(false);
            });
        }
    };

    // Handle enable protection
    const handleEnableProtection = async () => {
        if (!id) return;

        try {
            setIsDisablingBlocking(true);
            await DashApi.enableAdGuard(id);

            safeSetState(() => {
                setIsBlocking(true);
                setDisableEndTime(null);
                if (disableTimer) {
                    clearTimeout(disableTimer);
                    setDisableTimer(null);
                }
            });

            // Refresh stats immediately after enabling
            setTimeout(() => fetchStats(), 1000);
        } catch (err: any) {
            console.error('Failed to enable AdGuard protection:', err);
            safeSetState(() => {
                if (err.message?.includes('Item not found in configuration')) {
                    // Handle "Item not found" errors - this might be a timing issue during duplication
                    console.log('🔄 AdGuard: Enable failed, retrying in 2s (duplication timing)');
                    // Schedule a retry after a short delay instead of setting permanent error
                    setTimeout(() => {
                        if (isMountedRef.current && !error && !authFailed) {
                            handleEnableProtection();
                        }
                    }, 2000); // Retry after 2 seconds
                    return; // Exit without setting error state
                } else {
                    setError(err.message || 'Failed to enable AdGuard Home protection');
                }
            });
        } finally {
            safeSetState(() => {
                setIsDisablingBlocking(false);
            });
        }
    };

    // Update remaining time for disable timer
    useEffect(() => {
        if (!disableEndTime) {
            setRemainingTime('');
            return;
        }

        const updateRemainingTime = () => {
            const now = new Date();
            const diff = disableEndTime.getTime() - now.getTime();

            if (diff <= 0) {
                setRemainingTime('');
                setDisableEndTime(null);
                return;
            }

            const minutes = Math.floor(diff / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateRemainingTime();
        const interval = setInterval(updateRemainingTime, 1000);

        return () => clearInterval(interval);
    }, [disableEndTime]);

    // Handle click on widget items to navigate to AdGuard admin
    const handleItemClick = (path: string = '') => {
        const baseUrl = getBaseUrl();
        if (baseUrl) {
            window.open(`${baseUrl}${path}`, '_blank');
        }
    };

    // Format percentage for display
    const formatPercentage = (value: number | string | undefined): string => {
        if (value === undefined || value === null) return '0%';
        if (typeof value === 'string') return value;
        return `${Math.round(value)}%`;
    };

    // Handle retry functionality
    const handleRetry = () => {
        setError(null);
        setAuthFailed(false);
        fetchStats();
    };

    // Error handling - matches Pi-hole widget exactly
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
                <Typography variant='subtitle1' align='center'>
                    {error}
                </Typography>
                <Typography variant='caption' align='center' sx={{ mt: 1, fontSize: '0.8rem' }}>
                    {authFailed ?
                        'Using Basic Authentication' :
                        'Check your AdGuard Home configuration and network connection'}
                </Typography>
                <Button
                    variant='contained'
                    color='primary'
                    sx={{ mt: 2 }}
                    onClick={handleRetry}
                >
                    Retry
                </Button>
            </Box>
        );
    }

    // Not configured state - matches Pi-hole widget exactly
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
                    Please configure the AdGuard Home widget in settings
                </Typography>
            </Box>
        );
    }

    // Loading state - matches Pi-hole widget exactly
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

    // Convert percentage to number if it's a string (matches Pi-hole widget)
    const parsePercentage = (value: number | string | undefined): number => {
        if (value === undefined) return 0;
        if (typeof value === 'number') return value;

        // Handle string representation
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Get percentage as a number for display
    const blockPercentage = parsePercentage(stats.ads_percentage_today);

    // Format the percentage text
    const percentageText = blockPercentage.toFixed(1);

    return (
        <Box sx={{ p: 0.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
            }}>
                {/* Left side - AdGuard title */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {adguardConfig.showLabel && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%',
                                cursor: editMode ? 'grab' : 'pointer',
                                '&:hover': {
                                    opacity: editMode ? 1 : 0.8
                                }
                            }}
                            onClick={editMode ? undefined : () => handleItemClick()}
                            mb={0.5}
                        >
                            <img
                                src={`${BACKEND_URL}/icons/adguardhome.svg`}
                                alt='AdGuard Home logo'
                                style={{
                                    width: '30px',
                                    height: '30px',
                                }}
                            />
                            <Typography variant='h6' sx={{ mb: 0, fontSize: '1rem', ml: 0.5 }}>
                                {adguardConfig.displayName}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Right side - Disable/Enable button - Only show when not in edit mode */}
                {!editMode && (
                    <Button
                        variant='text'
                        startIcon={isBlocking ? <MdPause /> : <MdPlayArrow />}
                        onClick={isBlocking ? (e) => setDisableMenuAnchor(e.currentTarget) : handleEnableProtection}
                        disabled={isDisablingBlocking}
                        sx={{
                            height: 25,
                            fontSize: '0.7rem',
                            color: 'white',
                            minWidth: '80px',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ml: 'auto'
                        }}
                    >
                        {isBlocking ? 'Disable' : (remainingTime ? `Resume (${remainingTime})` : 'Resume')}
                    </Button>
                )}

                {/* Disable interval menu */}
                <Menu
                    anchorEl={disableMenuAnchor}
                    open={Boolean(disableMenuAnchor)}
                    onClose={() => setDisableMenuAnchor(null)}
                    closeAfterTransition={false}
                >
                    <MenuItem onClick={() => handleDisableProtection(10)}>10 seconds</MenuItem>
                    <MenuItem onClick={() => handleDisableProtection(30)}>30 seconds</MenuItem>
                    <MenuItem onClick={() => handleDisableProtection(60)}>1 minute</MenuItem>
                    <MenuItem onClick={() => handleDisableProtection(300)}>5 minutes</MenuItem>
                    <MenuItem onClick={() => handleDisableProtection(1800)}>30 minutes</MenuItem>
                    <MenuItem onClick={() => handleDisableProtection(3600)}>1 hour</MenuItem>
                    <MenuItem onClick={() => handleDisableProtection()}>Indefinitely</MenuItem>
                </Menu>
            </Box>

            <Grid container spacing={0.4} sx={{ flex: 1 }}>
                {/* Blocked Today */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : () => handleItemClick('#logs?response_status=blocked')}
                        sx={{
                            backgroundColor: '#74281E',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <MdBlockFlipped style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Blocked Today
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.ads_blocked_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Percent Blocked */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : () => handleItemClick('#logs?response_status=blocked')}
                        sx={{
                            backgroundColor: '#8E5B0A',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FaPercentage style={{ fontSize: '1.6rem' }} />
                        </Box>
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Percent Blocked
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {percentageText}%
                        </Typography>
                    </Paper>
                </Grid>

                {/* Queries Today */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : () => handleItemClick('#logs?response_status=all')}
                        sx={{
                            backgroundColor: '#006179',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <MdDns style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Queries Today
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.dns_queries_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Blocked Malware */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : () => handleItemClick('#logs?response_status=blocked_safebrowsing')}
                        sx={{
                            backgroundColor: '#1F5F3F',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <FaShield style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Blocked Malware
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.domains_being_blocked || 0)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};
