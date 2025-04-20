import { ArrowDownward, ArrowUpward, CheckCircle, Download, ExpandLess, ExpandMore, Pause, Warning } from '@mui/icons-material';
import { Box, CardContent, CircularProgress, Divider, Grid, IconButton, LinearProgress, TextField, Typography, useMediaQuery } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { DashApi } from '../../../../api/dash-api';
import { useAppContext } from '../../../../context/useAppContext';
import { theme } from '../../../../theme/theme';

type QBittorrentWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    username?: string;
    password?: string;
    autoLogin?: boolean;
    refreshInterval?: number;
    maxDisplayedTorrents?: number;
};

// Format bytes to appropriate size unit
const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

// Format percentage progress
const formatProgress = (progress: number): string => {
    return `${(progress * 100).toFixed(1)}%`;
};

// Get status icon based on torrent state
const getStatusIcon = (state: string) => {
    switch (state) {
    case 'downloading': return <Download color='primary' fontSize='small' />;
    case 'uploading':
    case 'seeding': return <ArrowUpward sx={{ color: theme.palette.primary.main }} fontSize='small' />;
    case 'pausedDL':
    case 'pausedUP': return <Pause color='warning' fontSize='small' />;
    case 'stalledDL':
    case 'stalledUP': return <Warning color='warning' fontSize='small' />;
    case 'completed':
    case 'checkingUP': return <CheckCircle color='success' fontSize='small' />;
    default: return <CircularProgress size={14} />;
    }
};

export const QBittorrentWidget = (props: { config?: QBittorrentWidgetConfig }) => {
    const { config } = props;
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [torrents, setTorrents] = useState<any[]>([]);
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '8080',
        ssl: config?.ssl || false,
        username: config?.username || '',
        password: config?.password || ''
    });

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials({
                host: config.host || 'localhost',
                port: config.port || '8080',
                ssl: config.ssl || false,
                username: config.username || '',
                password: config.password || ''
            });
        }
    }, [config]);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setAuthError('');
        try {
            const success = await DashApi.qbittorrentLogin(loginCredentials);
            setIsAuthenticated(success);
            if (!success) {
                setAuthError('Login failed. Check your credentials and connection.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setAuthError('Connection error. Check your qBittorrent WebUI settings.');
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, [loginCredentials]);

    const fetchStats = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl
            };
            const statsData = await DashApi.qbittorrentGetStats(connectionInfo);
            setStats(statsData);
        } catch (error) {
            console.error('Error fetching qBittorrent stats:', error);
            // If we get an auth error, set isAuthenticated to false to show login form
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [isAuthenticated, loginCredentials]);

    const fetchTorrents = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl
            };
            const torrentsData = await DashApi.qbittorrentGetTorrents(connectionInfo);
            // Sort by progress (downloading first) then by name
            const sortedTorrents = torrentsData.sort((a, b) => {
                // Prioritize downloading torrents
                if (a.state === 'downloading' && b.state !== 'downloading') return -1;
                if (a.state !== 'downloading' && b.state === 'downloading') return 1;

                // Then by progress (least complete first)
                if (a.progress !== b.progress) return a.progress - b.progress;

                // Then alphabetically
                return a.name.localeCompare(b.name);
            });

            // Limit the number of torrents displayed
            const maxTorrents = config?.maxDisplayedTorrents || 5;
            setTorrents(sortedTorrents.slice(0, maxTorrents));
        } catch (error) {
            console.error('Error fetching qBittorrent torrents:', error);
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [isAuthenticated, loginCredentials, config?.maxDisplayedTorrents]);

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Auto-login if configured
    useEffect(() => {
        if (config?.autoLogin && config.username && config.password) {
            handleLogin();
        }
    }, [config, handleLogin]);

    // Refresh stats and torrents periodically
    useEffect(() => {
        if (isAuthenticated) {
            fetchStats();
            fetchTorrents();

            const interval = setInterval(() => {
                fetchStats();
                fetchTorrents();
            }, config?.refreshInterval || 5000);

            return () => clearInterval(interval);
        }
    }, [isAuthenticated, fetchStats, fetchTorrents, config?.refreshInterval]);

    // Login form when not authenticated
    if (!isAuthenticated) {
        return (
            <CardContent sx={{ height: '100%', padding: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        height: '100%'
                    }}
                >
                    <Typography variant='h6' align='center' gutterBottom>
                        qBittorrent Login
                    </Typography>

                    {authError && (
                        <Typography
                            color='error'
                            variant='body2'
                            align='center'
                            sx={{ mb: 2 }}
                        >
                            {authError}
                        </Typography>
                    )}

                    <Grid container spacing={2} direction='column' sx={{ mb: 2 }}>
                        <Grid item>
                            <TextField
                                name='host'
                                label='Host'
                                variant='outlined'
                                fullWidth
                                size='small'
                                value={loginCredentials.host}
                                onChange={handleInputChange}
                            />
                        </Grid>
                        <Grid item>
                            <TextField
                                name='port'
                                label='Port'
                                variant='outlined'
                                fullWidth
                                size='small'
                                value={loginCredentials.port}
                                onChange={handleInputChange}
                            />
                        </Grid>
                        <Grid item>
                            <TextField
                                name='username'
                                label='Username'
                                variant='outlined'
                                fullWidth
                                size='small'
                                value={loginCredentials.username}
                                onChange={handleInputChange}
                            />
                        </Grid>
                        <Grid item>
                            <TextField
                                name='password'
                                label='Password'
                                type='password'
                                variant='outlined'
                                fullWidth
                                size='small'
                                value={loginCredentials.password}
                                onChange={handleInputChange}
                            />
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Box
                            onClick={handleLogin}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme.palette.primary.main,
                                borderRadius: '4px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                '&:hover': {
                                    backgroundColor: theme.palette.primary.dark
                                }
                            }}
                        >
                            {isLoading ? (
                                <CircularProgress size={24} color='inherit' />
                            ) : (
                                <Typography>Connect</Typography>
                            )}
                        </Box>
                    </Box>
                </Box>
            </CardContent>
        );
    }

    return (
        <CardContent sx={{ height: '100%', padding: 2 }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                color: 'white'
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ color: 'white' }}>
                        qBittorrent
                    </Typography>
                </Box>

                {!stats ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', mb: 1 }}>
                            <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                                Active Torrents ({stats.torrents?.downloading || 0})
                            </Typography>

                            {torrents.length === 0 ? (
                                <Box sx={{ px: 1, py: 1 }}>
                                    <Typography variant='caption' align='center' sx={{ display: 'block', color: 'white' }}>
                                        No active torrents
                                    </Typography>
                                </Box>
                            ) : (
                                <Box sx={{ px: 1, overflowY: 'auto', flex: 1, mb: 1 }}>
                                    {torrents.map((torrent) => (
                                        <Box key={torrent.hash} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                {getStatusIcon(torrent.state)}
                                                <Typography
                                                    variant='caption'
                                                    noWrap
                                                    sx={{
                                                        ml: 0.5,
                                                        maxWidth: '70%',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        color: 'white'
                                                    }}
                                                >
                                                    {torrent.name}
                                                </Typography>
                                                <Typography
                                                    variant='caption'
                                                    sx={{ ml: 'auto', color: 'white' }}
                                                >
                                                    {formatProgress(torrent.progress)}
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant='determinate'
                                                value={torrent.progress * 100}
                                                sx={{
                                                    height: 4,
                                                    borderRadius: 2,
                                                    mt: 0.5,
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor:
                                                            torrent.state === 'downloading' ? 'primary.main' :
                                                                torrent.state.includes('seed') || torrent.state.includes('upload') ? theme.palette.primary.main :
                                                                    torrent.progress === 1 ? 'success.main' : 'warning.main'
                                                    }
                                                }}
                                            />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.2 }}>
                                                <Typography variant='caption' sx={{ fontSize: '0.6rem', color: 'white' }}>
                                                    {torrent.state === 'downloading' && `↓ ${formatBytes(torrent.dlspeed)}/s`}
                                                </Typography>
                                                <Typography variant='caption' sx={{ fontSize: '0.6rem', color: 'white' }}>
                                                    {(torrent.state === 'uploading' || torrent.state === 'seeding') &&
                                                    `↑ ${formatBytes(torrent.upspeed)}/s`}
                                                </Typography>
                                                <Typography variant='caption' sx={{ fontSize: '0.6rem', ml: 'auto', color: 'white' }}>
                                                    {formatBytes(torrent.size)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            )}

                            <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                                Seeding Torrents ({stats.torrents?.seeding || 0})
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                                        Current:
                                    </Typography>
                                    <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                                        Session:
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <ArrowDownward sx={{ color: 'primary.main', fontSize: '0.7rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'white' }}>
                                            {formatBytes(stats.dl_info_speed)}/s
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ArrowDownward sx={{ color: 'primary.main', fontSize: '0.7rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'white' }}>
                                            {formatBytes(stats.dl_info_data || 0)}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <ArrowUpward sx={{ color: theme.palette.primary.main, fontSize: '0.7rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'white' }}>
                                            {formatBytes(stats.up_info_speed)}/s
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ArrowUpward sx={{ color: theme.palette.primary.main, fontSize: '0.7rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'white' }}>
                                            {formatBytes(stats.up_info_data || 0)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </CardContent>
    );
};
