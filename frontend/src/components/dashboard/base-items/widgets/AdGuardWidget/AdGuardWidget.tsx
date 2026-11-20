import { Box, Button, CircularProgress, Grid2 as Grid, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { FaPercentage } from 'react-icons/fa';
import { FaShield } from 'react-icons/fa6';
import { MdBlockFlipped, MdDns, MdPause, MdPlayArrow } from 'react-icons/md';

import { BACKEND_URL } from '../../../../../constants/constants';
import { useAppContext } from '../../../../../context/useAppContext';
import { useDnsBlocker } from '../../../../../hooks/useDnsBlocker';
import { formatNumber } from '../../../../../utils/utils';

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

export const AdGuardWidget = (props: { config?: AdGuardWidgetConfig; id?: string }) => {
    const { config, id } = props;
    const { editMode } = useAppContext();

    const adguardConfig = {
        host: config?.host || 'localhost',
        port: config?.port || '3000', // AdGuard Home default web interface port
        ssl: config?.ssl || false,
        _hasUsername: config?._hasUsername || false,
        _hasPassword: config?._hasPassword || false,
        showLabel: config?.showLabel,
        displayName: config?.displayName || 'AdGuard Home'
    };
    // Check for either security flags OR actual encrypted credentials
    const hasCredentials = (!!config?._hasUsername && !!config?._hasPassword) ||
                           (!!config?.username && !!config?.password);
    const isConfigured = !!config?.host && hasCredentials;
    const [disableMenuAnchor, setDisableMenuAnchor] = useState<null | HTMLElement>(null);

    // Statistics and protection state are pushed by the server; pause and resume go back the same way
    const {
        stats, isBlocking, isLoading, error, remainingTime, isDisablingBlocking, disable, enable, retry
    } = useDnsBlocker(id, isConfigured);
    const authFailed = Boolean(error);

    const handleDisableProtection = async (seconds?: number) => {
        setDisableMenuAnchor(null);
        await disable(seconds);
    };
    const handleEnableProtection = enable;
    const handleRetry = retry;

    // Helper function to get the base URL for navigation
    const getBaseUrl = () => {
        if (!adguardConfig.host) return '';

        // Strip any existing protocol prefix
        const cleanHost = adguardConfig.host.replace(/^https?:\/\//, '');
        const protocol = adguardConfig.ssl ? 'https' : 'http';
        const port = adguardConfig.port ? `:${adguardConfig.port}` : '';

        return `${protocol}://${cleanHost}${port}`;
    };

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
