import { ArrowDownward, ArrowUpward, CheckCircle, Delete, Download, MoreVert, Pause, PlayArrow, Stop, Upload, Warning } from '@mui/icons-material';
import { Box, Button, CardContent, CircularProgress, Grid, IconButton, LinearProgress, Link, Menu, MenuItem, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import React, { useState } from 'react';

import { PopupManager } from '../../../../components/modals/PopupManager';
import { BACKEND_URL } from '../../../../constants/constants';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../context/useAppContext';
import { theme } from '../../../../theme/theme';


export type DownloadClientStats = {
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

export type DownloadInfo = {
    hash: string;
    name: string;
    state: string;  // Common states: 'downloading', 'seeding', 'pausedDL', 'pausedUP', 'stopped', 'error', etc.
    progress: number;
    size: number;
    dlspeed: number;
    upspeed: number;
    eta?: number; // ETA in seconds
};

export type DownloadClientWidgetProps = {
    clientName: string;
    isLoading: boolean;
    isAuthenticated: boolean;
    authError: string;
    stats: DownloadClientStats | null;
    torrents: DownloadInfo[];
    loginCredentials: {
        host: string;
        port: string;
        ssl: boolean;
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

// Format status text for tooltip display
const formatStatusText = (state: string): string => {
    switch (state) {
    case 'downloading': return 'Downloading';
    case 'uploading': return 'Uploading';
    case 'seeding': return 'Seeding';
    case 'pausedDL': return 'Paused (Download)';
    case 'pausedUP': return 'Paused (Upload)';
    case 'stalledDL': return 'Stalled (Download)';
    case 'stalledUP': return 'Stalled (Upload)';
    case 'completed': return 'Completed';
    case 'checkingUP': return 'Checking';
    case 'stopped': return 'Stopped';
    case 'error': return 'Error';
    default: return state.charAt(0).toUpperCase() + state.slice(1);
    }
};

// Get status icon based on torrent state
const getStatusIcon = (state: string) => {
    switch (state) {
    case 'downloading': return <Download sx={{ color: 'white' }} fontSize='small' />;
    case 'uploading':
    case 'seeding': return <Upload sx={{ color: 'white' }} fontSize='small' />;
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

interface DownloadItemProps {
    torrent: DownloadInfo;
    clientName: string;
    isAdmin: boolean;
    onResume?: (hash: string) => Promise<boolean>;
    onPause?: (hash: string) => Promise<boolean>;
    onDelete?: (hash: string, deleteFiles: boolean) => Promise<boolean>;
}

const DownloadItem: React.FC<DownloadItemProps> = ({ torrent, clientName, isAdmin, onResume, onPause, onDelete }) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { editMode } = useAppContext();

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
        setMenuOpen(true);
    };

    const handleMenuClose = () => {
        setMenuAnchorEl(null);
        setMenuOpen(false);
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
        if (onDelete) {
            handleMenuClose();

            PopupManager.threeButtonDialog({
                title: `Remove "${torrent.name}"?`,
                confirmText: 'Delete Files',
                confirmAction: async () => {
                    // Delete torrent and files
                    setIsActionLoading(true);
                    try {
                        await onDelete(torrent.hash, true);
                    } catch (error) {
                        console.error('Failed to delete torrent with files:', error);
                    } finally {
                        setIsActionLoading(false);
                    }
                },
                denyText: 'Keep Files',
                denyAction: async () => {
                    // Delete torrent only, keep files
                    setIsActionLoading(true);
                    try {
                        await onDelete(torrent.hash, false);
                    } catch (error) {
                        console.error('Failed to delete torrent (keeping files):', error);
                    } finally {
                        setIsActionLoading(false);
                    }
                }
            });
        }
    };

    // Check if the torrent is paused or stopped
    const isPausedOrStopped = torrent.state.includes('paused') || torrent.state === 'stopped' || torrent.state === 'error';

    // Show menu button only if admin and actions are available and not in edit mode
    const showMenuButton = isAdmin && !editMode && (onResume || onPause || onDelete);

    return (
        <Box sx={{
            mb: 1.5,
            '&:last-child': { mb: 0 },
            p: 1,
            borderRadius: '4px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            transition: 'all 0.2s ease',
            '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.08)'
            },
            width: '100%',
            boxSizing: 'border-box'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Tooltip
                    title={formatStatusText(torrent.state)}
                    placement='top'
                    enterDelay={500}
                    arrow
                >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getStatusIcon(torrent.state)}
                    </Box>
                </Tooltip>
                <Tooltip
                    title={torrent.name}
                    placement='top'
                    enterDelay={1000}
                    arrow
                >
                    <Typography
                        variant='caption'
                        noWrap
                        sx={{
                            ml: 0.5,
                            maxWidth: '50%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'white',
                            fontSize: isMobile ? '0.7rem' : '.8rem',
                            cursor: 'default'
                        }}
                    >
                        {torrent.name}
                    </Typography>
                </Tooltip>
                <Typography
                    variant='caption'
                    sx={{
                        fontSize: isMobile ? '0.7rem' : '0.75rem',
                        ml: 'auto',
                        color: 'white',
                        minWidth: '80px',
                        textAlign: 'right',
                        mr: 0.5
                    }}
                >
                    {(torrent.eta !== undefined && torrent.eta > 0) ? `ETA: ${formatEta(torrent.eta)}` : ''}
                </Typography>
                {showMenuButton && (
                    <IconButton
                        size='small'
                        onClick={handleMenuOpen}
                        disabled={isActionLoading}
                        sx={{
                            p: 0.5,
                            color: 'white',
                            opacity: 0.7,
                            '&:hover': { opacity: 1 }
                        }}
                    >
                        {isActionLoading ? <CircularProgress size={16} /> : <MoreVert fontSize='small' />}
                    </IconButton>
                )}
                <Menu
                    anchorEl={menuAnchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'center',
                        horizontal: 'left',
                    }}

                >
                    {(clientName === 'qBittorrent' || clientName === 'Transmission') ? (
                        // For qBittorrent and Transmission: Use Start/Stop terminology
                        <>
                            {/* Show Start option for torrents that can be started */}
                            {(torrent.state.includes('paused') || torrent.state === 'missingfiles' ||
                              torrent.state === 'error' || torrent.state === 'stalledDL' ||
                              torrent.state === 'unknown' || torrent.state === 'checkingUP' ||
                              torrent.state === 'checkingDL' || torrent.state === 'checkingResumeData' ||
                              torrent.state === 'stoppedDL' || torrent.state === 'stopped') && (
                                <MenuItem
                                    onClick={handleResume}
                                    disabled={!onResume}
                                    sx={{ fontSize: '0.9rem', py: 1 }}
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
                                    sx={{ fontSize: '0.9rem', py: 1 }}
                                >
                                    <Stop fontSize='small' sx={{ mr: 1 }} />
                                    Stop
                                </MenuItem>
                            )}
                        </>
                    ) : clientName === 'SABnzbd' ? (
                        // For SABnzbd: Use Resume/Pause terminology with SABnzbd-specific states
                        <>
                            {/* Show Resume option for non-downloading SABnzbd items */}
                            {(torrent.state !== 'downloading' && torrent.state !== 'active') && (
                                <MenuItem
                                    onClick={handleResume}
                                    disabled={!onResume}
                                    sx={{ fontSize: '0.9rem', py: 1 }}
                                >
                                    <PlayArrow fontSize='small' sx={{ mr: 1 }} />
                                    Resume
                                </MenuItem>
                            )}

                            {/* Show Pause option for active SABnzbd items */}
                            {(torrent.state === 'downloading' || torrent.state === 'active') && (
                                <MenuItem
                                    onClick={handlePause}
                                    disabled={!onPause}
                                    sx={{ fontSize: '0.9rem', py: 1 }}
                                >
                                    <Pause fontSize='small' sx={{ mr: 1 }} />
                                    Pause
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
                                    sx={{ fontSize: '0.9rem', py: 1 }}
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
                                    sx={{ fontSize: '0.9rem', py: 1 }}
                                >
                                    <PlayArrow fontSize='small' sx={{ mr: 1 }} />
                                    Resume
                                </MenuItem>
                            )}

                            {/* Show Pause option for active torrents */}
                            <MenuItem
                                onClick={handlePause}
                                disabled={!onPause || isPausedOrStopped}
                                sx={{ fontSize: '0.9rem', py: 1 }}
                            >
                                <Pause fontSize='small' sx={{ mr: 1 }} />
                                Pause
                            </MenuItem>
                        </>
                    )}

                    <MenuItem onClick={handleDelete} disabled={!onDelete} sx={{ fontSize: '0.9rem', py: 1 }}>
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
                                torrent.state.includes('seed') || torrent.state.includes('upload') ? 'primary.main' :
                                    torrent.progress === 1 ? 'success.main' : 'warning.main'
                    }
                }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.2 }}>
                <Typography variant='caption' sx={{ fontSize: '0.7rem', color: 'white', minWidth: '100px' }}>
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
                    `${(clientName === 'qBittorrent' || clientName === 'Transmission') ? 'Stopped' : 'Paused'}`}
                </Typography>
                <Typography
                    variant='caption'
                    sx={{ ml: 'auto', color: 'white', fontSize: '.75rem', minWidth: '100px', textAlign: 'right' }}
                >
                    {formatProgress(torrent.progress)} / {formatBytes(torrent.size)}
                </Typography>
            </Box>
        </Box>
    );
};

export const DownloadClientWidget: React.FC<DownloadClientWidgetProps> = ({
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
    const { isAdmin, editMode } = useAppContext();

    // Create base URL for torrent client web UI
    const getBaseUrl = () => {
        if (!loginCredentials.host) return '';

        // Strip any existing protocol prefix
        const cleanHost = loginCredentials.host.replace(/^https?:\/\//, '');
        const protocol = loginCredentials.ssl ? 'https' : 'http';
        const port = loginCredentials.port ? `:${loginCredentials.port}` : '';

        return `${protocol}://${cleanHost}${port}`;
    };

    // Handle opening the torrent client web UI
    const handleOpenWebUI = () => {
        // Don't navigate if in edit mode
        if (editMode) return;

        const baseUrl = getBaseUrl();

        if (baseUrl) {
            // Use a secure method to open the URL
            // This creates a temporary anchor element and triggers a click
            const linkElement = document.createElement('a');
            linkElement.href = baseUrl;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
        }
    };

    // Just show error message and retry button if authentication failed
    if (!isAuthenticated) {
        return (
            <CardContent sx={{
                height: '100%',
                padding: 2,
                ...(isMobile ? {} : {
                    minHeight: DUAL_WIDGET_CONTAINER_HEIGHT.sm
                })
            }}>
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
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
                            <img
                                src={`${BACKEND_URL}/icons/${clientName.toLowerCase().includes('qbittorrent') ? 'qbittorrent.svg' : clientName.toLowerCase().includes('transmission') ? 'transmission.svg' : clientName.toLowerCase().includes('sabnzbd') ? 'sabnzbd.svg' : clientName.toLowerCase().includes('nzbget') ? 'nzbget.svg' : 'deluge.svg'}`}
                                alt={clientName}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    marginRight: '8px'
                                }}
                            />
                            <Typography variant='h6' align='center' gutterBottom sx={{ color: 'white', mb: 0 }}>
                                {clientName}
                            </Typography>
                        </Box>
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

                    {!isLoading && (
                        <Button
                            variant='contained'
                            color='primary'
                            onClick={handleLogin}
                            sx={{ mt: 2 }}
                        >
                            Retry
                        </Button>
                    )}
                </Box>
            </CardContent>
        );
    }

    return (
        <CardContent sx={{
            height: '100%',
            padding: 2,
            maxWidth: '100%',
            width: '100%',
            ...(isMobile ? {} : {
                minHeight: DUAL_WIDGET_CONTAINER_HEIGHT.sm
            })
        }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                color: 'white',
                width: '100%'
            }}>
                {showLabel && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, width: '100%' }}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: editMode ? 'grab' : 'pointer',
                                '&:hover': {
                                    opacity: editMode ? 1 : 0.8
                                }
                            }}
                            onClick={handleOpenWebUI}
                        >
                            <img
                                src={`${BACKEND_URL}/icons/${clientName.toLowerCase().includes('qbittorrent') ? 'qbittorrent.svg' : clientName.toLowerCase().includes('transmission') ? 'transmission.svg' : clientName.toLowerCase().includes('sabnzbd') ? 'sabnzbd.svg' : clientName.toLowerCase().includes('nzbget') ? 'nzbget.svg' : 'deluge.svg'}`}
                                alt={clientName}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    marginRight: '8px'
                                }}
                            />
                            <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ color: 'white' }}>
                                {clientName}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {!stats ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, width: '100%' }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', mb: 1, width: '100%' }}>
                            <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                                Active ({stats.torrents?.downloading || 0})
                            </Typography>

                            <Box sx={{
                                px: 1.5,
                                pt: 1.5,
                                pb: 1,
                                overflowY: 'auto',
                                height: '225px',
                                maxHeight: '225px',
                                mb: 1,
                                width: '100%',
                                minWidth: '100%',
                                flex: '1 1 auto',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.1)',
                                '&::-webkit-scrollbar': {
                                    width: '4px',
                                },
                                '&::-webkit-scrollbar-track': {
                                    background: 'rgba(255,255,255,0.05)',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    background: 'rgba(255,255,255,0.2)',
                                    borderRadius: '2px',
                                },
                                '&::-webkit-scrollbar-thumb:hover': {
                                    background: 'rgba(255,255,255,0.3)',
                                },
                                display: 'block',
                                boxSizing: 'border-box',
                                position: 'relative'
                            }}>
                                {torrents.length > 0 ? (
                                    torrents.map((torrent) => (
                                        <DownloadItem
                                            key={torrent.hash}
                                            torrent={torrent}
                                            clientName={clientName}
                                            isAdmin={isAdmin}
                                            onResume={onResumeTorrent}
                                            onPause={onPauseTorrent}
                                            onDelete={onDeleteTorrent}
                                        />
                                    ))
                                ) : (
                                    <>
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            height: '100%',
                                            width: '100%',
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: '0.85rem',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            zIndex: 1
                                        }}>
                                            No active items
                                        </Box>
                                        {/* Hidden sample torrent item to maintain width - but not visible */}
                                        <Box sx={{
                                            opacity: 0,
                                            pointerEvents: 'none',
                                            position: 'absolute',
                                            visibility: 'hidden'
                                        }}>
                                            <Box sx={{
                                                mb: 1.5,
                                                p: 1,
                                                borderRadius: '4px',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                    <Download sx={{ color: 'white' }} fontSize='small' />
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
                                                        Sample File Name.mkv
                                                    </Typography>
                                                    <Typography
                                                        variant='caption'
                                                        sx={{
                                                            fontSize: isMobile ? '0.7rem' : '0.75rem',
                                                            ml: 'auto',
                                                            color: 'white',
                                                            minWidth: '80px',
                                                            textAlign: 'right',
                                                            mr: 0.5
                                                        }}
                                                    >
                                                        ETA: 1h 30m
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.2 }}>
                                                    <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '100px' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <ArrowDownward sx={{ color: 'text.primary', fontSize: '0.75rem', mr: 0.3 }} />
                                                            <span>3.2 MB/s</span>
                                                        </Box>
                                                    </Typography>
                                                    <Typography
                                                        variant='caption'
                                                        sx={{ ml: 'auto', color: 'white', fontSize: '.75rem', minWidth: '100px', textAlign: 'right' }}
                                                    >
                                                        45.2% / 1.24 GB
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </>
                                )}
                            </Box>

                        </Box>
                        <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)', width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', mb: 0.5 }}>
                                        Current:
                                    </Typography>
                                    <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary' }}>
                                        {clientName === 'SABnzbd' ? 'This month:' : 'Session:'}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <ArrowDownward sx={{ color: 'text.primary', fontSize: '0.75rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '65px', textAlign: 'right' }}>
                                            {formatBytes(stats.dl_info_speed)}/s
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ArrowDownward sx={{ color: 'text.primary', fontSize: '0.75rem', mr: 0.3 }} />
                                        <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '65px', textAlign: 'right' }}>
                                            {formatBytes(stats.dl_info_data || 0)}
                                        </Typography>
                                    </Box>
                                </Box>

                                {clientName !== 'SABnzbd' && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                            <ArrowUpward sx={{ color: 'text.primary', fontSize: '0.75rem', mr: 0.3 }} />
                                            <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '65px', textAlign: 'right' }}>
                                                {formatBytes(stats.up_info_speed)}/s
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <ArrowUpward sx={{ color: 'text.primary', fontSize: '0.75rem', mr: 0.3 }} />
                                            <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '65px', textAlign: 'right' }}>
                                                {formatBytes(stats.up_info_data || 0)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </CardContent>
    );
};
