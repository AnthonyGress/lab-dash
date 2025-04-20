import { ArrowDownward, ArrowUpward, CheckCircle, Download, Pause, Stop, Warning } from '@mui/icons-material';
import { Box, CardContent, CircularProgress, Grid, IconButton, LinearProgress, TextField, Typography, useMediaQuery } from '@mui/material';
import React from 'react';

import { theme } from '../../../../theme/theme';

export type TorrentClientStats = {
    dl_info_speed: number;
    dl_info_data: number;
    up_info_speed: number;
    up_info_data: number;
    torrents?: {
        total: number;
        downloading: number;
        seeding: number;
        completed: number;
        paused: number;
    };
};

export type TorrentInfo = {
    hash: string;
    name: string;
    state: string;
    progress: number;
    size: number;
    dlspeed: number;
    upspeed: number;
    eta?: number; // ETA in seconds
};

export type TorrentClientWidgetProps = {
    clientName: string;
    isLoading: boolean;
    isAuthenticated: boolean;
    authError: string;
    stats: TorrentClientStats | null;
    torrents: TorrentInfo[];
    loginCredentials: {
        host: string;
        port: string;
        ssl: boolean;
        username: string;
        password: string;
    };
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleLogin: () => void;
    showLabel?: boolean;
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

// Format ETA (estimated time of arrival)
const formatEta = (seconds?: number): string => {
    if (seconds === undefined || seconds < 0 || !isFinite(seconds)) return '∞';
    if (seconds === 0) return 'Done';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
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
    default: return <Stop sx={{ color: 'gray' }} fontSize='small' />;
    }
};

export const TorrentClientWidget: React.FC<TorrentClientWidgetProps> = ({
    clientName,
    isLoading,
    isAuthenticated,
    authError,
    stats,
    torrents,
    loginCredentials,
    handleInputChange,
    handleLogin,
    showLabel = true
}) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Just show error message if authentication failed
    if (!isAuthenticated) {
        return (
            <CardContent sx={{ height: '100%', padding: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%'
                    }}
                >
                    {showLabel && (
                        <Typography variant='h6' align='center' gutterBottom sx={{ color: 'white' }}>
                            {clientName}
                        </Typography>
                    )}

                    {authError ? (
                        <Typography
                            variant='body2'
                            align='center'
                            sx={{ mb: 2, color: 'white' }}
                        >
                            {authError}
                        </Typography>
                    ) : (
                        <Typography
                            variant='body2'
                            align='center'
                            sx={{ mb: 2, color: 'white' }}
                        >
                            Authentication failed
                        </Typography>
                    )}

                    {isLoading && <CircularProgress size={24} />}
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
                {showLabel && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ color: 'white' }}>
                            {clientName}
                        </Typography>
                    </Box>
                )}

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
                                                    maxWidth: '60%',
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
                                                {formatProgress(torrent.progress)} / {formatBytes(torrent.size)}
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
                                                {(torrent.state === 'uploading' || torrent.state === 'seeding') &&
                                                `↑ ${formatBytes(torrent.upspeed)}/s`}
                                            </Typography>
                                            <Typography variant='caption' sx={{ fontSize: '0.6rem', ml: 'auto', color: 'white' }}>
                                                {(torrent.state === 'downloading' && torrent.eta !== undefined) && `ETA: ${formatEta(torrent.eta)}`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

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
