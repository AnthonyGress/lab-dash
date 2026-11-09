import { Box, Button, CircularProgress, Grid2 as Grid, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { FaGlobe, FaList, FaPercentage } from 'react-icons/fa';
import { MdBlockFlipped, MdPause, MdPlayArrow } from 'react-icons/md';

import { BACKEND_URL } from '../../../../../constants/constants';
import { useAppContext } from '../../../../../context/useAppContext';
import { useDnsBlocker } from '../../../../../hooks/useDnsBlocker';
import { formatNumber } from '../../../../../utils/utils';

type PiholeWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    _hasApiToken?: boolean;
    _hasPassword?: boolean;
    showLabel?: boolean;
    displayName?: string;
};

export const PiholeWidget = (props: { config?: PiholeWidgetConfig; id?: string }) => {
    const { config, id } = props;
    const { editMode } = useAppContext();

    const piholeConfig = {
        host: config?.host || 'pi.hole',
        port: config?.port || '80',
        ssl: config?.ssl || false,
        _hasApiToken: config?._hasApiToken || false,
        _hasPassword: config?._hasPassword || false,
        showLabel: config?.showLabel,
        displayName: config?.displayName || 'Pi-hole'
    };
    const isConfigured = !!config?.host && (!!config._hasApiToken || !!config._hasPassword);
    const [disableMenuAnchor, setDisableMenuAnchor] = useState<null | HTMLElement>(null);

    // Statistics and blocking state are pushed by the server; pause and resume go back the same way
    const {
        stats, isBlocking, isLoading, error, remainingTime, isDisablingBlocking, disable, enable, retry
    } = useDnsBlocker(id, isConfigured);
    const authFailed = Boolean(error);

    // Handle disable blocking with timeout
    const handleDisableBlocking = async (seconds: number | null) => {
        setDisableMenuAnchor(null);
        await disable(seconds);
    };

    // Handle enable blocking
    const handleEnableBlocking = enable;

    // Reconnect and try again
    const handleRetry = retry;

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

    // Create base URL for Pi-hole admin panel
    const getBaseUrl = () => {
        if (!piholeConfig.host) return '';

        // Strip any existing protocol prefix
        const cleanHost = piholeConfig.host.replace(/^https?:\/\//, '');
        const protocol = piholeConfig.ssl ? 'https' : 'http';
        const port = piholeConfig.port ? `:${piholeConfig.port}` : '';

        // The base API URL is the same for both v5 and v6
        return `${protocol}://${cleanHost}${port}/admin`;
    };

    // Handle opening the Pi-hole admin dashboard (default page)
    const handleOpenPiholeAdmin = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        // Main dashboard is /admin for both v5 and v6
        window.open(baseUrl, '_blank');
    };

    // Handle opening the queries page (percentage blocked)
    const handleOpenQueriesPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        // For v6, direct links won't work without authentication, so just open the main admin page
        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/queries`, '_blank');
            return;
        }

        const queriesUrl = `${baseUrl}/queries.php`;
        window.open(queriesUrl, '_blank');
    };

    // Handle opening the blocked queries page
    const handleOpenBlockedPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/queries?upstream=blocklist`, '_blank');
            return;
        }

        const blockedUrl = `${baseUrl}/queries.php?forwarddest=blocked`;
        window.open(blockedUrl, '_blank');
    };

    // Handle opening the network page (queries today)
    const handleOpenNetworkPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/network`, '_blank');
            return;
        }

        // For v5, we can deep link directly
        const networkUrl = `${baseUrl}/network.php`;
        window.open(networkUrl, '_blank');
    };

    // Handle opening the adlists page
    const handleOpenAdlistsPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/groups-lists`, '_blank');
            return;
        }

        const adlistsUrl = `${baseUrl}/groups-adlists.php`;
        window.open(adlistsUrl, '_blank');
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
                <Typography variant='subtitle1' align='center'>
                    {error}
                </Typography>
                <Typography variant='caption' align='center' sx={{ mt: 1, fontSize: '0.8rem' }}>
                    {authFailed ?
                        `Using ${piholeConfig._hasApiToken ? 'API token' : 'password'} authentication` :
                        'Check your Pi-hole configuration and network connection'}
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

    return (
        <Box sx={{ p: 0.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
            }}>
                {/* Left side - Pi-hole title */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {piholeConfig.showLabel && (
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
                            onClick={editMode ? undefined : handleOpenPiholeAdmin}
                            mb={0.5}
                        >
                            <img
                                src={`${BACKEND_URL}/icons/pihole.svg`}
                                alt='Pi-hole logo'
                                style={{
                                    width: '30px',
                                    height: '30px',
                                }}
                            />
                            <Typography variant='h6' sx={{ mb: 0, fontSize: '1rem', ml: 0.5 }}>
                                {piholeConfig.displayName}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Right side - Disable/Enable button - Only show when not in edit mode */}
                {!editMode && (
                    <Button
                        variant='text'
                        startIcon={isBlocking ? <MdPause /> : <MdPlayArrow />}
                        onClick={isBlocking ? handleDisableMenuClick : handleEnableBlocking}
                        disabled={isDisablingBlocking}
                        sx={{
                            height: 25,
                            fontSize: '0.7rem',
                            color: 'white',
                            minWidth: '80px', // Add fixed minimum width to prevent size changes
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
                    onClose={handleDisableMenuClose}
                    closeAfterTransition={false}
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

            <Grid container spacing={0.4} sx={{ flex: 1 }}>
                {/* Blocked Today */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : handleOpenBlockedPage}
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
                        onClick={editMode ? undefined : handleOpenQueriesPage}
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
                        onClick={editMode ? undefined : handleOpenNetworkPage}
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
                        <FaGlobe style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Queries Today
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.dns_queries_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Domains on Adlists */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : handleOpenAdlistsPage}
                        sx={{
                            backgroundColor: '#004A28',
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
                        <FaList style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Domains on Adlists
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.domains_being_blocked || 0)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Status indicator - only show when not in edit mode and blocking is disabled */}
            {!editMode && !isBlocking && (
                <Box sx={{ mt: 0.2, textAlign: 'center' }}>
                    <Typography variant='caption' color='white' sx={{ fontSize: '0.6rem' }}>
                        {remainingTime
                            ? `Blocking disabled. Will resume in ${remainingTime}`
                            : 'Blocking disabled indefinitely'}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};
