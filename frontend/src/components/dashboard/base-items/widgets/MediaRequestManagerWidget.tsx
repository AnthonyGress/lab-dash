import {
    CheckCircle as ApproveIcon,
    Cancel as DeclineIcon,
    Movie as MovieIcon,
    Person as PersonIcon,
    Search as SearchIcon,
    Tv as TvIcon
} from '@mui/icons-material';
import {
    Avatar,
    Box,
    Button,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import { open } from 'fs';
import React, { useCallback, useEffect, useState } from 'react';
import { FaRegThumbsDown, FaRegThumbsUp } from 'react-icons/fa6';

import { DashApi } from '../../../../api/dash-api';
import { BACKEND_URL, TWENTY_SEC_IN_MS } from '../../../../constants/constants';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../context/useAppContext';
import { theme } from '../../../../theme/theme';
import { PopupManager } from '../../../modals/PopupManager';

export interface MediaRequestManagerWidgetProps {
    id: string;
    service: 'jellyseerr' | 'overseerr';
    host?: string;
    port?: string;
    ssl?: boolean;
    _hasApiKey?: boolean;
    displayName?: string;
    error?: string;
    showLabel?: boolean;
}

interface SearchResult {
    id: number;
    mediaType: 'movie' | 'tv';
    title?: string;
    name?: string;
    overview: string;
    releaseDate?: string;
    firstAirDate?: string;
    posterPath?: string;
    status?: {
        status: number;
        status4k?: number;
    };
}

interface MediaRequest {
    id: number;
    type: string;
    status: number;
    createdAt: string;
    updatedAt: string;
    profileName?: string;
    media: {
        id: number;
        mediaType: 'movie' | 'tv';
        tmdbId: number;
        status: number;
        status4k?: number;
        title?: string;
        name?: string;
        overview?: string;
        releaseDate?: string;
        firstAirDate?: string;
        posterPath?: string;
    };
    requestedBy: {
        id: number;
        displayName: string;
        username: string;
        avatar?: string;
    };
    seasons?: any[];
}

export const MediaRequestManagerWidget: React.FC<MediaRequestManagerWidgetProps> = ({
    id,
    service,
    host,
    port,
    ssl,
    _hasApiKey,
    displayName,
    error,
    showLabel
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [allRequests, setAllRequests] = useState<MediaRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { editMode, isAdmin } = useAppContext();

    const serviceName = service === 'jellyseerr' ? 'Jellyseerr' : 'Overseerr';
    const serviceUrl = `${ssl ? 'https' : 'http'}://${host}:${port}`;

    const fetchRequests = useCallback(async () => {
        if (!id || !host || !_hasApiKey) {
            console.warn('MediaRequestManagerWidget: Missing required configuration');
            return;
        }

        try {
            // Try to fetch all requests without filtering to get all status types
            let allResults: MediaRequest[] = [];

            try {
                const allResponse = await DashApi.jellyseerrGetRequests(id, 'all');
                if (allResponse.success) {
                    allResults = allResponse.data.results || [];
                }
            } catch (allError) {
                console.warn('Failed to fetch all requests, trying individual status calls:', allError);
                // Fallback to individual status calls
                const [pendingResponse, approvedResponse, availableResponse] = await Promise.allSettled([
                    DashApi.jellyseerrGetRequests(id, 'pending'),
                    DashApi.jellyseerrGetRequests(id, 'approved'),
                    DashApi.jellyseerrGetRequests(id, 'available')
                ]);

                if (pendingResponse.status === 'fulfilled' && pendingResponse.value.success) {
                    allResults.push(...(pendingResponse.value.data.results || []));
                }
                if (approvedResponse.status === 'fulfilled' && approvedResponse.value.success) {
                    allResults.push(...(approvedResponse.value.data.results || []));
                }
                if (availableResponse.status === 'fulfilled' && availableResponse.value.success) {
                    allResults.push(...(availableResponse.value.data.results || []));
                }
            }

            // Remove duplicates based on request ID
            const uniqueResults = allResults.filter((request, index, self) =>
                index === self.findIndex(r => r.id === request.id)
            );

            // Sort by updatedAt and take the 8 most recent
            uniqueResults.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setAllRequests(uniqueResults.slice(0, 8));

        } catch (fetchError) {
            console.error('Error fetching requests:', fetchError);
        } finally {
            setLoading(false);
        }
    }, [id, host, _hasApiKey]);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !id || !_hasApiKey) return;

        setSearchLoading(true);
        try {
            const response = await DashApi.jellyseerrSearch(id, searchQuery.trim());
            if (response.success) {
                setSearchResults(response.data.results || []);
            }
        } catch (searchError) {
            console.error('Search error:', searchError);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleRequest = async (item: SearchResult) => {
        if (!id || !_hasApiKey) return;

        try {
            const response = await DashApi.jellyseerrCreateRequest(
                id,
                item.mediaType,
                item.id.toString()
            );
            if (response.success) {
                // Refresh requests after creating one
                fetchRequests();
                // Clear search results
                setSearchResults([]);
                setSearchQuery('');
            }
        } catch (requestError) {
            console.error('Request creation error:', requestError);
        }
    };

    const handleApproveRequest = (requestId: number) => {
        const request = allRequests.find(r => r.id === requestId);
        const title = request ? getTitle(request.media) : 'Unknown';

        PopupManager.confirmation({
            title: 'Approve Request',
            text: `Are you sure you want to approve the request for "${title}"?`,
            confirmText: 'Yes, Approve',
            confirmAction: async () => {
                if (!id || !_hasApiKey) return;

                try {
                    const response = await DashApi.jellyseerrApproveRequest(id, requestId.toString());
                    if (response.success) {
                        fetchRequests();
                    }
                } catch (actionError) {
                    console.error('Request approval error:', actionError);
                }
            }
        });
    };

    const handleDeclineRequest = (requestId: number) => {
        const request = allRequests.find(r => r.id === requestId);
        const title = request ? getTitle(request.media) : 'Unknown';

        PopupManager.deleteConfirmation({
            title: 'Decline Request',
            text: `Are you sure you want to decline the request for "${title}"?`,
            confirmText: 'Yes, Decline',
            confirmAction: async () => {
                if (!id || !_hasApiKey) return;

                try {
                    const response = await DashApi.jellyseerrDeclineRequest(id, requestId.toString());
                    if (response.success) {
                        fetchRequests();
                    }
                } catch (actionError) {
                    console.error('Request decline error:', actionError);
                }
            }
        });
    };

    const handleOpenWebUI = () => {
        if (editMode) return;
        window.open(serviceUrl, '_blank');
    };

    const getStatusColor = (status: number) => {
        switch (status) {
        case 1: return 'warning'; // Pending
        case 2: return 'success'; // Approved
        case 3: return 'error'; // Declined
        case 4: return 'success'; // Available
        default: return 'default';
        }
    };

    const getStatusColorSx = (status: number) => {
        switch (status) {
        case 1: return { backgroundColor: 'warning.dark', color: 'warning.contrastText' }; // Pending
        case 2: return { backgroundColor: 'success.dark', color: 'success.contrastText' }; // Approved
        case 3: return { backgroundColor: 'error.dark', color: 'error.contrastText' }; // Declined
        case 4: return { backgroundColor: 'success.dark', color: 'success.contrastText' }; // Available
        default: return {};
        }
    };

    const getStatusText = (status: number) => {
        switch (status) {
        case 1: return 'Pending';
        case 2: return 'Approved';
        case 3: return 'Declined';
        case 4: return 'Available';
        default: return 'Unknown';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const getPosterUrl = (posterPath?: string) => {
        if (!posterPath) return null;
        return `https://image.tmdb.org/t/p/w92${posterPath}`;
    };

    const getTitle = (item: SearchResult | MediaRequest['media']) => {
        return item.title || item.name || 'Unknown Title';
    };

    const getReleaseYear = (item: SearchResult | MediaRequest['media']) => {
        const date = item.releaseDate || item.firstAirDate;
        return date ? new Date(date).getFullYear() : '';
    };

    const getServiceIcon = () => {
        const iconName = service.toLowerCase();
        return `${BACKEND_URL}/icons/${iconName}.svg`;
    };

    const getUserAvatar = (user: MediaRequest['requestedBy']) => {
        if (user.avatar && !user.avatar.startsWith('/avatarproxy/')) {
            // If it's a full URL
            return user.avatar;
        } else if (user.avatar) {
            // If it's a relative path, construct the full URL
            const userServiceUrl = `${ssl ? 'https' : 'http'}://${host}:${port}`;
            return `${userServiceUrl}${user.avatar}`;
        }
        return null;
    };

    const formatSeasons = (seasons: any[]) => {
        if (!seasons || seasons.length === 0) return '';
        const seasonNumbers = seasons.map(s => s.seasonNumber).sort((a, b) => a - b);
        if (seasonNumbers.length > 4) {
            return `${seasonNumbers.length} seasons requested`;
        } else {
            return `Seasons: ${seasonNumbers.join(', ')}`;
        }
    };

    // Handle search on Enter key
    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    useEffect(() => {
        // Initial load with a slight delay to allow config to load
        const timeoutId = setTimeout(() => {
            fetchRequests();
        }, 100);

        // Set up polling interval
        const intervalId = setInterval(fetchRequests, TWENTY_SEC_IN_MS);

        return () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
    }, [fetchRequests]);

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
                                src={getServiceIcon()}
                                alt={serviceName}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    marginRight: '8px'
                                }}
                                onError={(e) => {
                                    // Fallback to a generic icon if service icon not found
                                    (e.target as HTMLImageElement).src = `${BACKEND_URL}/icons/generic.svg`;
                                }}
                            />
                            <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ color: 'white' }}>
                                {displayName || serviceName}
                            </Typography>
                        </Box>
                        {!editMode && (
                            <TextField
                                size='small'
                                placeholder='Search movies & TV...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                                sx={{
                                    flex: 1,
                                    ml: 2,
                                    '& .MuiInputBase-input::placeholder': {
                                        color: 'rgba(255,255,255,0.5)',
                                        opacity: 1
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position='start'>
                                            <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchLoading && (
                                        <InputAdornment position='end'>
                                            <CircularProgress size={16} sx={{ color: 'white' }} />
                                        </InputAdornment>
                                    ),
                                    sx: {
                                        color: 'white',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'divider'
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'rgba(255,255,255,0.5)'
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'rgba(255,255,255,0.7)'
                                        }
                                    }
                                }}
                            />
                        )}
                    </Box>
                )}

                {error ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, width: '100%', flexDirection: 'column' }}>
                        <Typography variant='body2' sx={{ textAlign: 'center', mb: 1 }}>
                            Configuration Error
                        </Typography>
                        <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                            {error}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                        {/* Search Results */}
                        {searchResults.length > 0 && !editMode && (
                            <Box sx={{ mb: 2, maxHeight: 150, overflow: 'auto' }}>
                                <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                                    Search Results
                                </Typography>
                                <List dense sx={{ pt: 0 }}>
                                    {searchResults.map((item) => (
                                        <ListItem
                                            key={item.id}
                                            sx={{ px: 1 }}
                                            secondaryAction={
                                                <Button
                                                    size='small'
                                                    variant='contained'
                                                    onClick={() => handleRequest(item)}
                                                    disabled={item.status?.status === 4}
                                                    sx={{ minWidth: 'auto', px: 1 }}
                                                >
                                                    {item.status?.status === 4 ? 'Available' : 'Request'}
                                                </Button>
                                            }
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    src={getPosterUrl(item.posterPath) || undefined}
                                                    sx={{ width: 32, height: 48 }}
                                                    variant='rounded'
                                                >
                                                    {item.mediaType === 'movie' ? <MovieIcon /> : <TvIcon />}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Typography variant='body2' sx={{ color: 'white' }}>
                                                        {getTitle(item)}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                                        {getReleaseYear(item)} • {item.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}

                        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%' }}>
                            {/* All Requests */}
                            <Box>
                                <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                                    Requests ({allRequests.length})
                                </Typography>
                                <Box sx={{
                                    px: 1.5,
                                    pt: 1,
                                    pb: 1,
                                    overflowY: 'auto',
                                    height: '18rem',
                                    width: '100%',
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
                                    position: 'relative'
                                }}>
                                    {loading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                            <CircularProgress size={24} sx={{ color: 'white' }} />
                                        </Box>
                                    ) : allRequests.length === 0 ? (
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            height: '100%',
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: '0.85rem'
                                        }}>
                                            No requests found
                                        </Box>
                                    ) : (
                                        <Box>
                                            {allRequests.map((request, index) => (
                                                <Box
                                                    key={`${request.id}-${request.status}-${index}`}
                                                    sx={{
                                                        mb: 1.5,
                                                        '&:last-child': { mb: 0 },
                                                        p: 1,
                                                        borderRadius: '4px',
                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                        width: '100%',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'stretch', width: '100%', gap: 1, minHeight: '85px' }}>
                                                        <Avatar
                                                            src={getPosterUrl(request.media.posterPath) || undefined}
                                                            sx={{
                                                                width: 'auto',
                                                                height: '85px',
                                                                aspectRatio: '2/3',
                                                                flexShrink: 0
                                                            }}
                                                            variant='rounded'
                                                        >
                                                            {request.media.mediaType === 'movie' ? <MovieIcon /> : <TvIcon />}
                                                        </Avatar>
                                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', height: '100%', position: 'relative' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1, width: '100%', height: '100%' }}>
                                                                {/* Left section - title, year, seasons, profile with username */}
                                                                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                                    <Box>
                                                                        <Tooltip
                                                                            title={getTitle(request.media)}
                                                                            placement='top'
                                                                            enterDelay={1000}
                                                                            arrow
                                                                        >
                                                                            <Typography
                                                                                variant='caption'
                                                                                noWrap
                                                                                sx={{
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis',
                                                                                    color: 'white',
                                                                                    fontSize: isMobile ? '0.7rem' : '.8rem',
                                                                                    cursor: 'default',
                                                                                    fontWeight: 500,
                                                                                    display: 'block',
                                                                                    mb: 0.5
                                                                                }}
                                                                            >
                                                                                {getTitle(request.media)}
                                                                            </Typography>
                                                                        </Tooltip>
                                                                        <Typography
                                                                            variant='caption'
                                                                            sx={{
                                                                                color: 'rgba(255,255,255,0.7)',
                                                                                fontSize: '0.65rem',
                                                                                display: 'block',
                                                                                mb: 0.5
                                                                            }}
                                                                        >
                                                                            {getReleaseYear(request.media)} • {request.media.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                                                                        </Typography>

                                                                        {/* Seasons or blank space for movies */}
                                                                        {request.type === 'tv' && request.seasons && request.seasons.length > 0 ? (
                                                                            <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                                                                                {formatSeasons(request.seasons)}
                                                                            </Typography>
                                                                        ) : (
                                                                            <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'transparent', display: 'block', mb: 0.5 }}>
                                                                                &nbsp;
                                                                            </Typography>
                                                                        )}
                                                                    </Box>

                                                                    {/* Profile text */}
                                                                    <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                                                                        Profile: {request.profileName || 'Default'}
                                                                    </Typography>
                                                                </Box>

                                                                {/* Username positioned at bottom right, aligned with profile */}
                                                                <Box sx={{
                                                                    position: 'absolute',
                                                                    bottom: 0,
                                                                    right: 0,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 0.5
                                                                }}>
                                                                    <Avatar
                                                                        src={getUserAvatar(request.requestedBy) || undefined}
                                                                        sx={{
                                                                            width: 14,
                                                                            height: 14,
                                                                            fontSize: '0.5rem'
                                                                        }}
                                                                    >
                                                                        <PersonIcon sx={{ fontSize: '0.5rem' }} />
                                                                    </Avatar>
                                                                    <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
                                                                        {request.requestedBy.displayName}
                                                                    </Typography>
                                                                    <Typography variant='caption' sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)' }}>
                                                                        • {formatDate(request.createdAt)}
                                                                    </Typography>
                                                                </Box>

                                                                {/* Right section - status and approval buttons */}
                                                                <Box sx={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'flex-end',
                                                                    justifyContent: 'flex-start',
                                                                    flexShrink: 0,
                                                                    minWidth: 'fit-content',
                                                                    height: '100%',
                                                                    gap: 1
                                                                }}>
                                                                    {/* Status chip */}
                                                                    <Chip
                                                                        label={getStatusText(request.status)}
                                                                        color={getStatusColor(request.status)}
                                                                        size='small'
                                                                        sx={{
                                                                            fontSize: '0.8rem',
                                                                            height: '1.25rem',
                                                                            ...getStatusColorSx(request.status)
                                                                        }}
                                                                    />

                                                                    {/* Approval buttons positioned between status and username */}
                                                                    <Box sx={{ mt: 0.25 }}>
                                                                        {request.status === 1 && isAdmin && !editMode ? (
                                                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                                <IconButton
                                                                                    size='small'
                                                                                    onClick={() => handleApproveRequest(request.id)}
                                                                                    sx={{
                                                                                        width: 28,
                                                                                        height: 28,
                                                                                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                                                                        color: 'rgba(149, 239, 165, 0.8)',
                                                                                        '&:hover': {
                                                                                            backgroundColor: 'success.dark',
                                                                                            color: 'white',
                                                                                            transform: 'scale(1.1)'
                                                                                        },
                                                                                        '&:active': {
                                                                                            backgroundColor: 'success.dark',
                                                                                            color: 'white'
                                                                                        },
                                                                                        transition: 'all 0.2s ease'
                                                                                    }}
                                                                                >
                                                                                    <FaRegThumbsUp size={14} />
                                                                                </IconButton>
                                                                                <IconButton
                                                                                    size='small'
                                                                                    onClick={() => handleDeclineRequest(request.id)}
                                                                                    sx={{
                                                                                        width: 28,
                                                                                        height: 28,
                                                                                        backgroundColor: 'rgba(244, 67, 54, 0.2)',
                                                                                        color: 'rgba(244, 195, 191, 0.8)',
                                                                                        '&:hover': {
                                                                                            backgroundColor: 'error.dark',
                                                                                            color: 'white',
                                                                                            transform: 'scale(1.1)'
                                                                                        },
                                                                                        '&:active': {
                                                                                            backgroundColor: 'error.dark',
                                                                                            color: 'white'
                                                                                        },
                                                                                        transition: 'all 0.2s ease'
                                                                                    }}
                                                                                >
                                                                                    <FaRegThumbsDown size={14} />
                                                                                </IconButton>
                                                                            </Box>
                                                                        ) : (
                                                                            <Box />
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </CardContent>
    );
};
