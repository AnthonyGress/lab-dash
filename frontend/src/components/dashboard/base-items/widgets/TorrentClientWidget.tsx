import { ArrowDownward, ArrowUpward, CheckCircle, Delete, Download, MoreVert, Pause, PlayArrow, Stop, Warning } from '@mui/icons-material';
import { Box, CardContent, CircularProgress, Grid, IconButton, LinearProgress, Menu, MenuItem, TextField, Typography, useMediaQuery } from '@mui/material';
import React, { useState } from 'react';

import { useAppContext } from '../../../../context/useAppContext';
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
    state: string;  // Common states: 'downloading', 'seeding', 'pausedDL', 'pausedUP', 'stopped', 'error', etc.
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
    onResumeTorrent?: (hash: string) => Promise<boolean>;
    onPauseTorrent?: (hash: string) => Promise<boolean>;
    onDeleteTorrent?: (hash: string, deleteFiles: boolean) => Promise<boolean>;
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
    case 'downloading': return <Download sx={{ color: 'white' }} fontSize='small' />;
    case 'uploading':
    case 'seeding': return <ArrowUpward sx={{ color: 'white' }} fontSize='small' />;
    case 'pausedDL':
    case 'pausedUP': return <Pause sx={{ color: 'white' }} fontSize='small' />;
    case 'stalledDL':
    case 'stalledUP': return <Warning sx={{ color: 'white' }} fontSize='small' />;
    case 'completed':
    case 'checkingUP': return <CheckCircle sx={{ color: 'white' }} fontSize='small' />;
    case 'stopped':
    case 'error': return <Stop sx={{ color: 'white' }} fontSize='small' />;
    default: return <Stop sx={{ color: 'white' }} fontSize='small' />;
    }
};

interface TorrentItemProps {
    torrent: TorrentInfo;
    clientName: string;
    isAdmin: boolean;
    onResume?: (hash: string) => Promise<boolean>;
    onPause?: (hash: string) => Promise<boolean>;
    onDelete?: (hash: string, deleteFiles: boolean) => Promise<boolean>;
}

const TorrentItem: React.FC<TorrentItemProps> = ({ torrent, clientName, isAdmin, onResume, onPause, onDelete }) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { editMode } = useAppContext();

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setMenuAnchorEl(null);
    };

    const handleResume = async () => {
        if (onResume) {
            setIsActionLoading(true);
            try {
                await onResume(torrent.hash);
            } catch (error) {
                console.error('Failed to resume torrent:', error);
            } finally {
                setIsActionLoading(false);
            }
        }
        handleMenuClose();
    };

    const handlePause = async () => {
        if (onPause) {
            setIsActionLoading(true);
            try {
                await onPause(torrent.hash);
            } catch (error) {
                console.error('Failed to pause torrent:', error);
            } finally {
                setIsActionLoading(false);
            }
        }
        handleMenuClose();
    };

    const handleDelete = async () => {
        if (onDelete && window.confirm(`Are you sure you want to remove "${torrent.name}"?`)) {
            setIsActionLoading(true);
            try {
                const deleteFiles = window.confirm('Do you also want to delete the downloaded files?');
                await onDelete(torrent.hash, deleteFiles);
            } catch (error) {
                console.error('Failed to delete torrent:', error);
            } finally {
                setIsActionLoading(false);
            }
        }
        handleMenuClose();
    };

    // Check if the torrent is paused or stopped
    const isPausedOrStopped = torrent.state.includes('paused') || torrent.state === 'stopped' || torrent.state === 'error';

    // Show menu button only if admin and actions are available and not in edit mode
    const showMenuButton = isAdmin && !editMode && (onResume || onPause || onDelete);

    return (
        <Box sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getStatusIcon(torrent.state)}
                <Typography
                    variant='caption'
                    noWrap
                    sx={{
                        ml: 0.5,
                        maxWidth: '50%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'white',
                        fontSize: isMobile ? '0.7rem' : '.8rem'
                    }}
                >
                    {torrent.name}
                </Typography>
                <Typography variant='caption' sx={{ fontSize: '0.7rem', ml: 'auto', color: 'white' }}>
                    {(torrent.state === 'downloading' && torrent.eta !== undefined) && `ETA: ${formatEta(torrent.eta)}`}
                </Typography>
                { (
                    <IconButton
                        size='small'
                        onClick={handleMenuOpen}
                        disabled={isActionLoading}
                        sx={{
                            p: 0.5,
                            ml: 0.5,
                            color: 'white',
                            opacity: 0.7,
                            '&:hover': { opacity: 1 },
                            visibility: showMenuButton ? 'visible' : 'hidden'
                        }}
                    >
                        {isActionLoading ? <CircularProgress size={16} /> : <MoreVert fontSize='small' />}
                    </IconButton>
                )}
                <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: '#2a2a2a',
                                color: 'white',
                                border: '1px solid #444',
                                minWidth: '120px'
                            }
                        }
                    }}
                >
                    {clientName === 'qBittorrent' ? (
                        // For qBittorrent: Use Start/Stop terminology
                        <>
                            {/* Show Start option for torrents that can be started */}
                            {(torrent.state.includes('paused') || torrent.state === 'missingfiles' ||
                              torrent.state === 'error' || torrent.state === 'stalledDL' ||
                              torrent.state === 'unknown' || torrent.state === 'checkingUP' ||
                              torrent.state === 'checkingDL' || torrent.state === 'checkingResumeData' ||
                              torrent.state === 'stoppedDL') && (
                                <MenuItem
                                    onClick={handleResume}
                                    disabled={!onResume}
                                >
                                    <PlayArrow fontSize='small' sx={{ mr: 1 }} />
                                    Start
                                </MenuItem>
                            )}

                            {/* Show Stop option for active torrents */}
                            {(torrent.state === 'downloading' || torrent.state === 'uploading' ||
                              torrent.state === 'metaDL' || torrent.state === 'forcedDL' ||
                              torrent.state === 'forcedUP' || torrent.state === 'moving' ||
                              torrent.state === 'seeding') && (
                                <MenuItem
                                    onClick={handlePause}
                                    disabled={!onPause}
                                >
                                    <Stop fontSize='small' sx={{ mr: 1 }} />
                                    Stop
                                </MenuItem>
                            )}
                        </>
                    ) : (
                        // For other clients like Deluge: Use Pause/Resume terminology
                        <>
                            {/* Show Start option for stopped torrents */}
                            {(torrent.state === 'stopped' || torrent.state === 'error') && (
                                <MenuItem
                                    onClick={handleResume}
                                    disabled={!onResume}
                                >
                                    <PlayArrow fontSize='small' sx={{ mr: 1 }} />
                                    Start
                                </MenuItem>
                            )}

                            {/* Show Resume option only for paused torrents */}
                            {torrent.state.includes('paused') && (
                                <MenuItem
                                    onClick={handleResume}
                                    disabled={!onResume}
                                >
                                    <PlayArrow fontSize='small' sx={{ mr: 1 }} />
                                    Resume
                                </MenuItem>
                            )}

                            {/* Show Pause option for active torrents */}
                            <MenuItem
                                onClick={handlePause}
                                disabled={!onPause || isPausedOrStopped}
                            >
                                <Pause fontSize='small' sx={{ mr: 1 }} />
                                Pause
                            </MenuItem>
                        </>
                    )}

                    <MenuItem onClick={handleDelete} disabled={!onDelete}>
                        <Delete fontSize='small' sx={{ mr: 1 }} />
                        Remove
                    </MenuItem>
                </Menu>
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
                <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'white' }}>
                    {torrent.state === 'downloading' && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ArrowDownward sx={{ color: 'white', fontSize: '0.75rem', mr: 0.3 }} />
                            <span>{formatBytes(torrent.dlspeed)}/s</span>
                        </Box>
                    )}
                    {(torrent.state === 'uploading' || torrent.state === 'seeding') && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ArrowUpward sx={{ color: 'white', fontSize: '0.75rem', mr: 0.3 }} />
                            <span>{formatBytes(torrent.upspeed)}/s</span>
                        </Box>
                    )}

                    {(torrent.state === 'stopped' || torrent.state === 'error' || torrent.state.includes('paused')) &&
                    `${clientName === 'qBittorrent' ? 'Stopped' : 'Paused'}`}
                </Typography>
                <Typography
                    variant='caption'
                    sx={{ ml: 'auto', color: 'white', fontSize: isMobile ? '0.65rem' : '.75rem' }}
                >
                    {formatProgress(torrent.progress)} / {formatBytes(torrent.size)}
                </Typography>
            </Box>
        </Box>
    );
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
    showLabel,
    onResumeTorrent,
    onPauseTorrent,
    onDeleteTorrent
}) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { isAdmin } = useAppContext();

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
        <CardContent sx={{ height: '100%', padding: 2, maxWidth: '100%' }}>
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
                                Active ({stats.torrents?.downloading || 0})
                            </Typography>

                            <Box sx={{ px: 1, overflowY: 'auto', flex: 1, mb: 1 }}>
                                {torrents.map((torrent) => (
                                    <TorrentItem
                                        key={torrent.hash}
                                        torrent={torrent}
                                        clientName={clientName}
                                        isAdmin={isAdmin}
                                        onResume={onResumeTorrent}
                                        onPause={onPauseTorrent}
                                        onDelete={onDeleteTorrent}
                                    />
                                ))}
                            </Box>

                        </Box>
                        <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                                        Current:
                                    </Typography>
                                    <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>
                                        Session:
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <ArrowDownward sx={{ color: 'white', fontSize: '0.75rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'white' }}>
                                            {formatBytes(stats.dl_info_speed)}/s
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ArrowDownward sx={{ color: 'white', fontSize: '0.75rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'white' }}>
                                            {formatBytes(stats.dl_info_data || 0)}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <ArrowUpward sx={{ color: 'white', fontSize: '0.75rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'white' }}>
                                            {formatBytes(stats.up_info_speed)}/s
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ArrowUpward sx={{ color: 'white', fontSize: '0.75rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'white' }}>
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
