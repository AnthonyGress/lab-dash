import { ArrowDownward, Movie, MusicNote, Pause, Person, PlayArrow, Schedule, Tv } from '@mui/icons-material';
import { Box, CardContent, CircularProgress, Typography, useMediaQuery } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { DashApi } from '../../../../../api/dash-api';
import { BACKEND_URL, FIFTEEN_MIN_IN_MS } from '../../../../../constants/constants';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../../constants/widget-dimensions';
import { theme } from '../../../../../theme/theme';
import { WidgetContainer } from '../WidgetContainer';

interface JellyfinSession {
    Id: string;
    UserId: string;
    UserName: string;
    Client: string;
    ApplicationVersion: string;
    DeviceName: string;
    DeviceType: string;
    PlayState?: {
        IsPaused: boolean;
        PositionTicks: number;
        PlayMethod: string;
    };
    NowPlayingItem?: {
        Id: string;
        Name: string;
        Type: string;
        RunTimeTicks: number;
        ProductionYear?: number;
        SeriesName?: string;
        SeasonName?: string;
        IndexNumber?: number;
        ParentIndexNumber?: number;
        ImageTags?: {
            Primary?: string;
        };
    };
}

interface MediaServerWidgetProps {
    config?: {
        clientType?: 'jellyfin' | 'plex' | 'emby';
        displayName?: string;
        host?: string;
        port?: string;
        ssl?: boolean;
        apiKey?: string;
        showLabel?: boolean;
        _hasApiKey?: boolean; // Security flag instead of actual API key
        [key: string]: any; // Allow additional properties for flexibility
    };
    editMode?: boolean;
    id?: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
}

// Format duration from ticks to readable format
const formatDuration = (ticks: number): string => {
    const totalSeconds = Math.floor(ticks / 10000000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

// Format progress percentage
const formatProgress = (positionTicks: number, runtimeTicks: number): string => {
    if (!runtimeTicks) return '0%';
    return `${Math.round((positionTicks / runtimeTicks) * 100)}%`;
};

// Get media type display name
const getMediaTypeDisplay = (type: string): string => {
    switch (type?.toLowerCase()) {
    case 'episode':
        return 'TV Show';
    case 'movie':
        return 'Movie';
    case 'audio':
        return 'Music';
    case 'musicalbum':
        return 'Album';
    case 'book':
        return 'Book';
    case 'audiobook':
        return 'Audiobook';
    default:
        return type || 'Media';
    }
};

// Get media type icon
const getMediaIcon = (type: string) => {
    switch (type?.toLowerCase()) {
    case 'episode':
        return <Tv sx={{ color: 'white', fontSize: '1rem' }} />;
    case 'movie':
        return <Movie sx={{ color: 'white', fontSize: '1rem' }} />;
    case 'audio':
    case 'musicalbum':
        return <MusicNote sx={{ color: 'white', fontSize: '1rem' }} />;
    default:
        return <PlayArrow sx={{ color: 'white', fontSize: '1rem' }} />;
    }
};

// Get session status icon
const getStatusIcon = (session: JellyfinSession) => {
    if (session.PlayState?.IsPaused) {
        return <Pause sx={{ color: 'white' }} fontSize='small' />;
    }
    return <PlayArrow sx={{ color: 'white' }} fontSize='small' />;
};

// Get display title for media item
const getDisplayTitle = (item: JellyfinSession['NowPlayingItem']): string => {
    if (!item) return '';

    if (item.Type === 'Episode' && item.SeriesName) {
        const season = item.ParentIndexNumber ? `S${item.ParentIndexNumber}` : '';
        const episode = item.IndexNumber ? `E${item.IndexNumber}` : '';
        return `${item.SeriesName} ${season}${episode}`;
    }

    return item.Name;
};

interface SessionItemProps {
    session: JellyfinSession;
    clientType: string;
    config: any;
}

const SessionItem: React.FC<SessionItemProps> = ({ session, clientType, config }) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const displayTitle = getDisplayTitle(session.NowPlayingItem);
    const subtitle = session.NowPlayingItem?.Type === 'Episode' ? session.NowPlayingItem.Name : '';

    // Construct image URL for Jellyfin
    const getImageUrl = (item: JellyfinSession['NowPlayingItem'], serverConfig: any): string | undefined => {
        if (!item?.ImageTags?.Primary || !serverConfig?.host) return undefined;

        // Strip any existing protocol prefix
        const cleanHost = serverConfig.host.replace(/^https?:\/\//, '');
        const protocol = serverConfig.ssl ? 'https' : 'http';
        const port = serverConfig.port ? `:${serverConfig.port}` : '';
        const baseUrl = `${protocol}://${cleanHost}${port}`;

        return `${baseUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&maxHeight=80&maxWidth=80&quality=90`;
    };

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
            <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 1 }}>
                {/* Cover Art */}
                <Box sx={{
                    width: '40px',
                    height: '40px',
                    flexShrink: 0,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {session.NowPlayingItem?.ImageTags?.Primary ? (
                        <img
                            src={getImageUrl(session.NowPlayingItem, config)}
                            alt={displayTitle}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                            onError={(e) => {
                                // Fallback to icon if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = '';
                                const iconContainer = document.createElement('div');
                                iconContainer.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;';
                                target.parentElement!.appendChild(iconContainer);
                            }}
                        />
                    ) : (
                        getMediaIcon(session.NowPlayingItem?.Type || '')
                    )}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Typography
                            variant='caption'
                            noWrap
                            sx={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'white',
                                fontSize: isMobile ? '0.7rem' : '.8rem',
                                fontWeight: 500
                            }}
                        >
                            {displayTitle || 'Unknown Media'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                            <Typography
                                variant='caption'
                                sx={{
                                    fontSize: '0.75rem',
                                    color: 'white',
                                    minWidth: '60px',
                                    textAlign: 'right'
                                }}
                            >
                                {session.PlayState?.IsPaused ? 'Paused' : 'Playing'}
                            </Typography>
                            {getStatusIcon(session)}
                        </Box>
                    </Box>

                    {subtitle && (
                        <Typography
                            variant='caption'
                            sx={{
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '0.75rem',
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'white' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Person sx={{ color: 'white', fontSize: '1rem', mr: 0.3 }} />
                                    <span>{session.UserName}</span>
                                </Box>
                            </Typography>
                            <Typography
                                variant='caption'
                                sx={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.7)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5
                                }}
                            >
                                {getMediaIcon(session.NowPlayingItem?.Type || '')}
                                {getMediaTypeDisplay(session.NowPlayingItem?.Type || '')}
                            </Typography>
                        </Box>
                        <Typography
                            variant='caption'
                            sx={{ ml: 'auto', color: 'white', fontSize: '.75rem', minWidth: '80px', textAlign: 'right' }}
                        >
                            {session.NowPlayingItem?.RunTimeTicks && session.PlayState?.PositionTicks ? (
                                `${formatProgress(session.PlayState.PositionTicks, session.NowPlayingItem.RunTimeTicks)} / ${formatDuration(session.NowPlayingItem.RunTimeTicks)}`
                            ) : (
                                session.DeviceName
                            )}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export const MediaServerWidget: React.FC<MediaServerWidgetProps> = ({
    config,
    editMode = false,
    id,
    onEdit,
    onDelete,
    onDuplicate
}) => {
    const [sessions, setSessions] = useState<JellyfinSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [libraryStats, setLibraryStats] = useState<{
        tvShows: number;
        movies: number;
        isLoading: boolean;
    }>({
        tvShows: 0,
        movies: 0,
        isLoading: true
    });
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const fetchSessions = useCallback(async () => {
        if (!id) {
            setError('Widget ID missing');
            setIsLoading(false);
            return;
        }

        if (!config?.host || (!config?.apiKey && !config?._hasApiKey)) {
            setError('Server configuration missing');
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            // Jellyfin and Emby use the same API
            if (config.clientType === 'jellyfin' || config.clientType === 'emby' || !config.clientType) {
                const data = await DashApi.getJellyfinSessions(id);

                setSessions(data.sessions || []);
                setError(null);
            } else {
                setError(`${config.clientType} is not yet supported`);
            }
        } catch (err) {
            console.error('Error fetching media server sessions:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setSessions([]);
        } finally {
            setIsLoading(false);
        }
    }, [id, config]);

    const fetchLibraryStats = useCallback(async () => {
        if (!id) {
            setLibraryStats(prev => ({ ...prev, isLoading: false }));
            return;
        }

        if (!config?.host || (!config?.apiKey && !config?._hasApiKey)) {
            setLibraryStats(prev => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            setLibraryStats(prev => ({ ...prev, isLoading: true }));
            // Jellyfin and Emby use the same API
            if (config.clientType === 'jellyfin' || config.clientType === 'emby' || !config.clientType) {
                const data = await DashApi.getJellyfinLibraryStats(id);
                setLibraryStats({
                    tvShows: data.tvShows || 0,
                    movies: data.movies || 0,
                    isLoading: false
                });
            } else {
                setLibraryStats({
                    tvShows: 0,
                    movies: 0,
                    isLoading: false
                });
            }
        } catch (err) {
            console.error('Error fetching library stats:', err);
            setLibraryStats({
                tvShows: 0,
                movies: 0,
                isLoading: false
            });
        }
    }, [id, config]);

    useEffect(() => {
        if (!config?.host || (!config?.apiKey && !config?._hasApiKey)) {
            setIsLoading(false);
            return;
        }

        if (!id) {
            setIsLoading(false);
            return;
        }

        // Initial fetch
        fetchSessions();
        fetchLibraryStats();

        // Set up periodic refresh every 2 minutes
        timerRef.current = setInterval(fetchSessions, 1200000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [config, id, fetchSessions, fetchLibraryStats]);

    const clientName = config?.displayName || (config?.clientType === 'plex' ? 'Plex' : config?.clientType === 'emby' ? 'Emby' : 'Jellyfin');

    // Create base URL for media server web UI
    const getBaseUrl = () => {
        if (!config?.host) return '';

        // Strip any existing protocol prefix
        const cleanHost = config.host.replace(/^https?:\/\//, '');
        const protocol = config.ssl ? 'https' : 'http';
        const port = config.port ? `:${config.port}` : '';

        return `${protocol}://${cleanHost}${port}`;
    };

    // Handle opening the media server web UI
    const handleOpenWebUI = () => {
        // Don't navigate if in edit mode
        if (editMode) return;

        const baseUrl = getBaseUrl();

        if (baseUrl) {
            // Use a secure method to open the URL
            const linkElement = document.createElement('a');
            linkElement.href = baseUrl;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
        }
    };

    // Show error message and retry functionality
    if (error) {
        return (
            <WidgetContainer
                editMode={editMode}
                id={id}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
            >
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
                        {config?.showLabel !== false && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
                                <img
                                    src={`${BACKEND_URL}/icons/${config?.clientType === 'plex' ? 'plex.svg' : config?.clientType === 'emby' ? 'emby.svg' : 'jellyfin.svg'}`}
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

                        <Typography
                            variant='body2'
                            align='center'
                            sx={{ mb: 2, color: 'white' }}
                        >
                            {error}
                        </Typography>
                    </Box>
                </CardContent>
            </WidgetContainer>
        );
    }

    return (
        <WidgetContainer
            editMode={editMode}
            id={id}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
        >
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
                    {config?.showLabel !== false && (
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
                                    src={`${BACKEND_URL}/icons/${config?.clientType === 'plex' ? 'plex.svg' : config?.clientType === 'emby' ? 'emby.svg' : 'jellyfin.svg'}`}
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

                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, width: '100%' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', mb: 1, width: '100%' }}>
                                <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                                    Watching ({sessions.length})
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
                                    {sessions.length > 0 ? (
                                        sessions.map((session) => (
                                            <SessionItem
                                                key={session.Id}
                                                session={session}
                                                clientType={config?.clientType || 'jellyfin'}
                                                config={config}
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
                                            {/* Hidden sample session item to maintain width - but not visible */}
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
                                                        <Movie sx={{ color: 'white' }} fontSize='small' />
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
                                                            Sample Movie Title
                                                        </Typography>
                                                        <Typography
                                                            variant='caption'
                                                            sx={{
                                                                fontSize: '0.75rem',
                                                                ml: 'auto',
                                                                color: 'white',
                                                                minWidth: '80px',
                                                                textAlign: 'right',
                                                                mr: 0.5
                                                            }}
                                                        >
                                                            Playing
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.2 }}>
                                                        <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'white', minWidth: '100px' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <Person sx={{ color: 'white', fontSize: '1rem', mr: 0.3 }} />
                                                                <span>User</span>
                                                            </Box>
                                                        </Typography>
                                                        <Typography
                                                            variant='caption'
                                                            sx={{ ml: 'auto', color: 'white', fontSize: '.75rem', minWidth: '100px', textAlign: 'right' }}
                                                        >
                                                            45% / 2h 15m
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
                                            Total TV Shows:
                                        </Typography>
                                        <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary' }}>
                                            Total Movies:
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '65px', textAlign: 'right', mb: 0.5 }}>
                                            {libraryStats.isLoading ? '...' : libraryStats.tvShows}
                                        </Typography>
                                        <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary', minWidth: '65px', textAlign: 'right' }}>
                                            {libraryStats.isLoading ? '...' : libraryStats.movies}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Box>
            </CardContent>
        </WidgetContainer>
    );
};
