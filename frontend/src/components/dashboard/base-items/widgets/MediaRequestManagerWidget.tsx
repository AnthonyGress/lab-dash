import {
    CheckCircle as ApproveIcon,
    Cancel as DeclineIcon,
    Movie as MovieIcon,
    Person as PersonIcon,
    Tv as TvIcon
} from '@mui/icons-material';
import {
    Autocomplete,
    Avatar,
    Box,
    Button,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    ClickAwayListener,
    FormControlLabel,
    IconButton,
    InputAdornment,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { FaRegThumbsDown, FaRegThumbsUp } from 'react-icons/fa6';
import { RemoveScroll } from 'react-remove-scroll';

import { DashApi } from '../../../../api/dash-api';
import { BACKEND_URL, TWENTY_SEC_IN_MS } from '../../../../constants/constants';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../context/useAppContext';
import { COLORS } from '../../../../theme/styles';
import { theme } from '../../../../theme/theme';
import { CenteredModal } from '../../../modals/CenteredModal';
import { PopupManager } from '../../../modals/PopupManager';
import { ToastManager } from '../../../toast/ToastManager';

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
    const [confirmationItem, setConfirmationItem] = useState<SearchResult | null>(null);
    const [previousSearchQuery, setPreviousSearchQuery] = useState<string>('');
    const [tvShowDetails, setTvShowDetails] = useState<any>(null);
    const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
    const [loadingTvDetails, setLoadingTvDetails] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { editMode, isAdmin, isLoggedIn } = useAppContext();

    const serviceName = service === 'jellyseerr' ? 'Jellyseerr' : 'Overseerr';
    // Strip any existing protocol prefix
    const cleanHost = host?.replace(/^https?:\/\//, '') || host;
    const serviceUrl = `${ssl ? 'https' : 'http'}://${cleanHost}:${port}`;

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
                if (allResponse.success && allResponse.data && allResponse.data.results) {
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

                if (pendingResponse.status === 'fulfilled' && pendingResponse.value.success && pendingResponse.value.data && pendingResponse.value.data.results) {
                    allResults.push(...(pendingResponse.value.data.results || []));
                }
                if (approvedResponse.status === 'fulfilled' && approvedResponse.value.success && approvedResponse.value.data && approvedResponse.value.data.results) {
                    allResults.push(...(approvedResponse.value.data.results || []));
                }
                if (availableResponse.status === 'fulfilled' && availableResponse.value.success && availableResponse.value.data && availableResponse.value.data.results) {
                    allResults.push(...(availableResponse.value.data.results || []));
                }
            }

            // Remove duplicates based on request ID
            const uniqueResults = (allResults || []).filter((request, index, self) =>
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

    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim() || !id || !_hasApiKey) {
            setSearchResults([]);
            setIsDropdownOpen(false);
            return;
        }

        setSearchLoading(true);
        try {
            const response = await DashApi.jellyseerrSearch(id, query.trim());
            if (response.success) {
                const results = response.data.results || [];
                // Don't limit results, show all matches from Jellyseerr
                setSearchResults(results);
            }
        } catch (searchError) {
            console.error('Search error:', searchError);
            setSearchResults([]);
            setIsDropdownOpen(false);
        } finally {
            setSearchLoading(false);
        }
    }, [id, _hasApiKey]);

    // Debounced search effect
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setSearchResults([]);
            setIsDropdownOpen(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            handleSearch(searchQuery);
        }, 250); // Reduced to 250ms for faster response

        return () => clearTimeout(timeoutId);
    }, [searchQuery, handleSearch]);

    const handleItemClick = async (item: SearchResult) => {
        setConfirmationItem(item);
        setSelectedSeasons([]);
        setTvShowDetails(null);

        // If it's a TV show, fetch details including seasons
        if (item.mediaType === 'tv' && id && _hasApiKey) {
            setLoadingTvDetails(true);
            try {
                const response = await DashApi.jellyseerrGetTVDetails(id, item.id.toString());

                if (response.success) {
                    setTvShowDetails(response.data);
                    // Don't pre-select any seasons - let the user choose
                    setSelectedSeasons([]);
                }
            } catch (tvDetailsError) {
                console.error('Failed to fetch TV show details:', tvDetailsError);
            } finally {
                setLoadingTvDetails(false);
            }
        }
    };

    // Helper function to check if a season should not be re-requested (has status 2, 3, 4, 5, or 6)
    const isSeasonAvailable = (season: any) => {
        // First check if the season itself has status information
        // Status 2 = PENDING, Status 3 = PROCESSING, Status 4 = PARTIALLY_AVAILABLE, Status 5 = AVAILABLE, Status 6 = DELETED
        if (season.status === 2 || season.status === 3 || season.status === 4 || season.status === 5 || season.status === 6) {
            return true;
        }

        // Then check mediaInfo.seasons for status information
        if (!tvShowDetails?.mediaInfo?.seasons) {
            return false;
        }

        // Check if this specific season exists in the mediaInfo.seasons array
        const seasonStatus = tvShowDetails.mediaInfo.seasons.find((s: any) => s.seasonNumber === season.seasonNumber);

        if (seasonStatus) {
            // Season is unavailable for re-request if it has status 2, 3, 4, 5, or 6
            return seasonStatus.status === 2 || seasonStatus.status === 3 || seasonStatus.status === 4 || seasonStatus.status === 5 || seasonStatus.status === 6;
        }

        return false;
    };

    // Helper function to get available seasons count for "All" checkbox logic
    const getAvailableSeasons = (seasons: any[]) => {
        return seasons.filter((season: any) => season.seasonNumber > 0 && !isSeasonAvailable(season));
    };

    const handleRequest = async (item: SearchResult, seasons?: number[]) => {
        if (!id || !_hasApiKey) return;

        try {
            // Filter out already available seasons before sending the request
            let seasonsToRequest = seasons;
            const title = item.title || item.name;
            if (item.mediaType === 'tv' && seasons && tvShowDetails) {
                seasonsToRequest = seasons.filter(seasonNumber => {
                    const season = tvShowDetails.seasons?.find((s: any) => s.seasonNumber === seasonNumber);
                    return season && !isSeasonAvailable(season);
                });
            }

            const response = await DashApi.jellyseerrCreateRequest(
                id,
                item.mediaType,
                item.id.toString(),
                seasonsToRequest
            );

            if (response.success) {
                // Refresh requests after creating one
                fetchRequests();
                // Clear search results and query
                setSearchResults([]);
                setSearchQuery('');
                setIsDropdownOpen(false);
                ToastManager.success(`Successfully requested ${title}`);
            } else {
                console.error('Request creation failed:', response.error);
                ToastManager.error(`Failed to request ${title}`);
            }
        } catch (requestError) {
            console.error('Request creation error:', requestError);
            ToastManager.error('An error occured while requesting');
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
        case 4: return 'success'; // Partially Available
        case 5: return 'success'; // Available
        case 6: return 'error'; // Failed
        default: return 'default';
        }
    };

    const getStatusColorSx = (status: number) => {
        switch (status) {
        case 1: return { backgroundColor: 'warning.dark', color: 'warning.contrastText' }; // Pending
        case 2: return { backgroundColor: 'success.dark', color: 'success.contrastText' }; // Approved
        case 3: return { backgroundColor: 'error.dark', color: 'error.contrastText' }; // Declined
        case 4: return { backgroundColor: 'success.dark', color: 'success.contrastText' }; // Partially Available
        case 5: return { backgroundColor: 'success.dark', color: 'success.contrastText' }; // Available
        case 6: return { backgroundColor: 'error.dark', color: 'error.contrastText' }; // Failed
        default: return { backgroundColor: 'grey.dark', color: 'grey.contrastText' };
        }
    };

    const getStatusText = (status: number) => {
        switch (status) {
        case 1: return 'Pending';
        case 2: return 'Approved';
        case 3: return 'Declined';
        case 4: return 'Partial';
        case 5: return 'Available';
        case 6: return 'Failed';
        default: return `Status ${status}`;
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
        if (!user.avatar) {
            return null;
        }

        // Check if it's a default Jellyseerr avatar - these typically use /avatarproxy/ or default avatar patterns
        if (user.avatar.startsWith('/avatarproxy/') ||
            user.avatar.includes('default') ||
            user.avatar.includes('gravatar') ||
            user.avatar.endsWith('/avatar') ||
            user.avatar === '/avatar') {
            return null; // Use PersonIcon fallback instead
        }

        // If it's a full URL, return as is
        if (user.avatar.startsWith('http')) {
            return user.avatar;
        }

        // If it's a relative path, construct the full URL
        const userServiceUrl = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        return `${userServiceUrl}${user.avatar}`;
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
                {/* Title/Icon and Search Bar Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: .5, width: '100%' }}>
                    {showLabel && (
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
                    )}
                    <ClickAwayListener onClickAway={() => {
                        if (searchQuery && !confirmationItem) {
                            setSearchQuery('');
                            setSearchResults([]);
                        }
                        // Always reset dropdown state when clicking away
                        setIsDropdownOpen(false);
                    }}>
                        <Box sx={{
                            flex: 1,
                            ml: showLabel ? 2 : 0,
                            mr: 1,
                            display: 'flex',
                            alignItems: 'center',
                            visibility: editMode ? 'hidden' : 'visible'
                        }}>
                            <RemoveScroll
                                enabled={isDropdownOpen && searchResults.length > 0}
                                removeScrollBar={false}
                                style={{ width: '100%' }}
                            >
                                <Autocomplete
                                    freeSolo
                                    options={searchResults}
                                    getOptionLabel={(option) =>
                                        typeof option === 'string' ? option : getTitle(option)
                                    }
                                    inputValue={searchQuery}
                                    onInputChange={(_, newInputValue) => {
                                        setSearchQuery(newInputValue);
                                    }}
                                    onOpen={() => setIsDropdownOpen(true)}
                                    onClose={() => setIsDropdownOpen(false)}
                                    onChange={(_, newValue) => {
                                        if (newValue && typeof newValue !== 'string') {
                                        // Dismiss keyboard on mobile
                                            const activeElement = document.activeElement as HTMLElement;
                                            if (activeElement && activeElement.blur) {
                                                activeElement.blur();
                                            }

                                            setPreviousSearchQuery(searchQuery); // Save current search query
                                            handleItemClick(newValue);
                                            setSearchQuery(''); // Clear search after selection
                                            setIsDropdownOpen(false);
                                        }
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && searchResults.length > 0 && !searchLoading) {
                                            event.preventDefault();
                                            // Select the first item in the search results
                                            const firstItem = searchResults[0];
                                            if (firstItem) {
                                            // Dismiss keyboard
                                                const activeElement = document.activeElement as HTMLElement;
                                                if (activeElement && activeElement.blur) {
                                                    activeElement.blur();
                                                }

                                                setPreviousSearchQuery(searchQuery);
                                                handleItemClick(firstItem);
                                                setSearchQuery('');
                                                setIsDropdownOpen(false);
                                            }
                                        }
                                    }}
                                    loading={searchLoading}
                                    loadingText='Searching...'
                                    noOptionsText={searchQuery.length < 2 ? 'Type to search...' : 'No results found'}
                                    filterOptions={(options) => options} // Don't filter on frontend, show all API results
                                    open={searchQuery.length >= 2 && searchResults.length > 0 && !searchLoading && !confirmationItem} // Close when modal is open
                                    disablePortal={false} // Allow portal for proper dropdown positioning
                                    disableClearable={false}
                                    componentsProps={{
                                        popper: {
                                            placement: 'bottom-start', // Always place dropdown below
                                            modifiers: [
                                                {
                                                    name: 'flip',
                                                    enabled: false, // Disable flipping to top
                                                },
                                                {
                                                    name: 'preventOverflow',
                                                    enabled: false, // Allow overflow if needed
                                                }
                                            ]
                                        }
                                    }}
                                    sx={{
                                        width: '100%',
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            height: '36px', // Slightly taller for better usability
                                            '& fieldset': {
                                                border: '1px solid rgba(255, 255, 255, 0.3) !important',
                                            },
                                            '&:hover fieldset': {
                                                border: '1px solid rgba(255, 255, 255, 0.5) !important',
                                            },
                                            '&.Mui-focused fieldset': {
                                                border: '1px solid rgba(255, 255, 255, 0.7) !important',
                                            },
                                        },
                                        '& .MuiAutocomplete-clearIndicator': {
                                            color: 'white',
                                            alignSelf: 'center', // Center the clear icon vertically
                                        },
                                        '& .MuiAutocomplete-popupIndicator': {
                                            display: 'none', // Hide the dropdown arrow
                                        },
                                        '& .MuiAutocomplete-endAdornment': {
                                            top: '50%', // Center vertically
                                            transform: 'translateY(-50%)', // Perfect centering
                                            right: '9px', // Adjust positioning
                                        },
                                    }}
                                    renderOption={(props, option) => (
                                        <Box
                                            component='li'
                                            {...props}
                                            key={`search-result-${option.id}`}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                py: 1,
                                                opacity: option.status?.status === 4 ? 0.6 : 1,
                                                cursor: option.status?.status === 4 ? 'default' : 'pointer',
                                                '&:hover': {
                                                    backgroundColor: option.status?.status === 4 ? 'transparent' : 'rgba(255,255,255,0.05)'
                                                }
                                            }}

                                        >
                                            <Avatar
                                                key={`avatar-${option.id}`}
                                                src={getPosterUrl(option.posterPath) || undefined}
                                                sx={{ width: 36, height: 54 }}
                                                variant='rounded'
                                            >
                                                {option.mediaType === 'movie' ? <MovieIcon /> : <TvIcon />}
                                            </Avatar>
                                            <Box key={`content-${option.id}`} sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography key={`title-${option.id}`} variant='body2' sx={{ color: 'white', fontWeight: 500 }}>
                                                    {getTitle(option)}
                                                </Typography>
                                                <Typography key={`subtitle-${option.id}`} variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                                    {getReleaseYear(option)} • {option.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                                                </Typography>
                                            </Box>
                                            {option.status?.status === 4 && (
                                                <Chip
                                                    key={`chip-${option.id}`}
                                                    label='Available'
                                                    size='small'
                                                    sx={{
                                                        fontSize: '0.7rem',
                                                        height: '1rem',
                                                        backgroundColor: 'success.dark',
                                                        color: 'success.contrastText'
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder='Search for movies or TV shows...'
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <InputAdornment position='start' sx={{ color: 'text.primary' }}>
                                                        <FaSearch />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <>
                                                        {searchLoading && (
                                                            <InputAdornment position='end'>
                                                                <CircularProgress size={16} sx={{ color: 'white' }} />
                                                            </InputAdornment>
                                                        )}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                                sx: { height: '36px' }, // Match container height
                                            }}
                                            sx={{
                                                height: '36px', // Match the container height
                                            }}
                                        />
                                    )}
                                    slotProps={{
                                        listbox: {
                                            sx: {
                                                maxHeight: 400, // Increased height for more results
                                                '& .MuiAutocomplete-option': {
                                                    minHeight: 'unset',
                                                    lineHeight: '1.5'
                                                }
                                            }
                                        }
                                    }}
                                />
                            </RemoveScroll>
                        </Box>
                    </ClickAwayListener>
                </Box>

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
                                    height: '18.5rem',
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
                                                                        <Box sx={{ pt: 0.25 }}>
                                                                            <Typography
                                                                                variant='caption'
                                                                                sx={{
                                                                                    color: 'rgba(255,255,255,0.7)',
                                                                                    fontSize: '0.75rem',
                                                                                    display: 'block',
                                                                                    mb: 0.05
                                                                                }}
                                                                            >
                                                                                {getReleaseYear(request.media)} • {request.media.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                                                                            </Typography>

                                                                            {/* Seasons or blank space for movies */}
                                                                            {request.type === 'tv' && request.seasons && request.seasons.length > 0 ? (
                                                                                <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.05 }}>
                                                                                    {formatSeasons(request.seasons)}
                                                                                </Typography>
                                                                            ) : (
                                                                                <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'transparent', display: 'block', mb: 0.05 }}>
                                                                                    &nbsp;
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Box>

                                                                    {/* Profile text */}
                                                                    <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
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
                                                                    {getUserAvatar(request.requestedBy) ? (
                                                                        <Avatar
                                                                            src={getUserAvatar(request.requestedBy) || undefined}
                                                                            sx={{
                                                                                width: 14,
                                                                                height: 14
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <PersonIcon sx={{ fontSize: '0.75rem', color: 'white' }} />
                                                                    )}
                                                                    <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'text.primary' }}>
                                                                        {request.requestedBy.displayName}
                                                                    </Typography>
                                                                    <Typography variant='caption' sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
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
                                                                        {request.status === 1 && isAdmin && isLoggedIn && !editMode ? (
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

            {/* Confirmation Modal */}
            <CenteredModal
                open={!!confirmationItem}
                handleClose={() => {
                    setConfirmationItem(null);
                    setTvShowDetails(null);
                    setSelectedSeasons([]);
                    // Restore the previous search query to reopen autocomplete
                    if (previousSearchQuery) {
                        setSearchQuery(previousSearchQuery);
                        setPreviousSearchQuery('');
                    }
                }}
                title={confirmationItem ? `Request ${getTitle(confirmationItem)}` : ''}
                width='400px'
            >
                {confirmationItem && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                                src={getPosterUrl(confirmationItem.posterPath) || undefined}
                                sx={{ width: 60, height: 90 }}
                                variant='rounded'
                            >
                                {confirmationItem.mediaType === 'movie' ? <MovieIcon /> : <TvIcon />}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='h6' sx={{ color: 'white', mb: 0.5 }}>
                                    {getTitle(confirmationItem)}
                                </Typography>
                                <Typography variant='body2' sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {getReleaseYear(confirmationItem)} • {confirmationItem.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                                </Typography>
                                {confirmationItem.status?.status === 4 && (
                                    <Chip
                                        label='Already Available'
                                        size='small'
                                        sx={{
                                            fontSize: '0.7rem',
                                            height: '1.5rem',
                                            backgroundColor: 'success.dark',
                                            color: 'success.contrastText',
                                            mt: 0.5
                                        }}
                                    />
                                )}
                            </Box>
                        </Box>

                        {confirmationItem.overview && (
                            <Typography variant='body2' sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
                                {confirmationItem.overview}
                            </Typography>
                        )}

                        {/* Season Selection for TV Shows */}
                        {confirmationItem.mediaType === 'tv' && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant='h6' sx={{ color: 'white', mb: 1 }}>
                                    Select Seasons:
                                </Typography>

                                {loadingTvDetails ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                        <CircularProgress size={24} sx={{ color: 'white' }} />
                                    </Box>
                                ) : tvShowDetails && tvShowDetails.seasons ? (
                                    <Box>
                                        <Box sx={{ mb: 1 }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={
                                                            selectedSeasons.length > 0 &&
                                                            selectedSeasons.length === getAvailableSeasons(tvShowDetails.seasons).length
                                                        }
                                                        indeterminate={
                                                            selectedSeasons.length > 0 &&
                                                            selectedSeasons.length < getAvailableSeasons(tvShowDetails.seasons).length
                                                        }
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const availableSeasons = getAvailableSeasons(tvShowDetails.seasons)
                                                                    .map((season: any) => season.seasonNumber);
                                                                setSelectedSeasons(availableSeasons);
                                                            } else {
                                                                setSelectedSeasons([]);
                                                            }
                                                        }}
                                                        sx={{
                                                            color: 'rgba(255,255,255,0.7)',
                                                            '&.Mui-checked': {
                                                                color: 'primary.main'
                                                            }
                                                        }}
                                                    />
                                                }
                                                label={`All (${tvShowDetails.seasons.filter((season: any) => season.seasonNumber > 0).length})`}
                                                sx={{
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    margin: 0,
                                                    '& .MuiFormControlLabel-label': {
                                                        fontSize: '0.95rem',
                                                        fontWeight: 500
                                                    }
                                                }}
                                            />
                                        </Box>

                                        <Box sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                            gap: 1,
                                            maxHeight: '200px',
                                            overflowY: 'auto'
                                        }}>
                                            {tvShowDetails.seasons
                                                .filter((season: any) => season.seasonNumber > 0)
                                                .sort((a: any, b: any) => a.seasonNumber - b.seasonNumber)
                                                .map((season: any) => {
                                                    const seasonAvailable = isSeasonAvailable(season);
                                                    const isSelected = selectedSeasons.includes(season.seasonNumber);

                                                    return (
                                                        <FormControlLabel
                                                            key={season.seasonNumber}
                                                            control={
                                                                <Checkbox
                                                                    checked={seasonAvailable ? true : isSelected}
                                                                    disabled={seasonAvailable}
                                                                    onChange={() => {
                                                                        if (!seasonAvailable) {
                                                                            setSelectedSeasons(prev =>
                                                                                prev.includes(season.seasonNumber)
                                                                                    ? prev.filter(s => s !== season.seasonNumber)
                                                                                    : [...prev, season.seasonNumber]
                                                                            );
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        color: seasonAvailable ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                                                                        '&.Mui-checked': {
                                                                            color: 'primary.main'
                                                                        },
                                                                        '&.Mui-disabled': {
                                                                            color: 'rgba(255,255,255,0.3)'
                                                                        },
                                                                        '&.Mui-disabled.Mui-checked': {
                                                                            color: 'primary.main'
                                                                        }
                                                                    }}
                                                                />
                                                            }
                                                            label={
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Typography
                                                                        sx={{
                                                                            fontSize: '0.9rem',
                                                                            color: seasonAvailable ? 'rgba(255,255,255,0.5)' : 'white'
                                                                        }}
                                                                    >
                                                                        Season {season.seasonNumber}
                                                                    </Typography>
                                                                    {seasonAvailable && (
                                                                        <Chip
                                                                            label={(() => {
                                                                                // Check season status first
                                                                                if (season.status === 2) return 'Pending';
                                                                                if (season.status === 3) return 'Processing';
                                                                                if (season.status === 4) return 'Partial';
                                                                                if (season.status === 5) return 'Available';
                                                                                if (season.status === 6) return 'Deleted';

                                                                                // Check mediaInfo.seasons status
                                                                                const seasonStatus = tvShowDetails?.mediaInfo?.seasons?.find((s: any) => s.seasonNumber === season.seasonNumber);
                                                                                if (seasonStatus) {
                                                                                    if (seasonStatus.status === 2) return 'Pending';
                                                                                    if (seasonStatus.status === 3) return 'Processing';
                                                                                    if (seasonStatus.status === 4) return 'Partial';
                                                                                    if (seasonStatus.status === 5) return 'Available';
                                                                                    if (seasonStatus.status === 6) return 'Deleted';
                                                                                }

                                                                                return 'Unavailable'; // fallback
                                                                            })()}
                                                                            size='small'
                                                                            sx={{
                                                                                fontSize: '0.6rem',
                                                                                height: '1rem',
                                                                                backgroundColor: (() => {
                                                                                    const status = season.status || tvShowDetails?.mediaInfo?.seasons?.find((s: any) => s.seasonNumber === season.seasonNumber)?.status;
                                                                                    switch (status) {
                                                                                    case 2: return 'warning.dark'; // Pending
                                                                                    case 3: return 'info.dark'; // Processing
                                                                                    case 4: return 'success.dark'; // Partial
                                                                                    case 5: return 'success.dark'; // Available
                                                                                    case 6: return 'error.dark'; // Deleted
                                                                                    default: return 'success.dark';
                                                                                    }
                                                                                })(),
                                                                                color: (() => {
                                                                                    const status = season.status || tvShowDetails?.mediaInfo?.seasons?.find((s: any) => s.seasonNumber === season.seasonNumber)?.status;
                                                                                    switch (status) {
                                                                                    case 2: return 'warning.contrastText'; // Pending
                                                                                    case 3: return 'info.contrastText'; // Processing
                                                                                    case 4: return 'success.contrastText'; // Partial
                                                                                    case 5: return 'success.contrastText'; // Available
                                                                                    case 6: return 'error.contrastText'; // Deleted
                                                                                    default: return 'success.contrastText';
                                                                                    }
                                                                                })()
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Box>
                                                            }
                                                            sx={{
                                                                color: 'white',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                margin: 0,
                                                                opacity: seasonAvailable ? 0.6 : 1
                                                            }}
                                                        />
                                                    );
                                                })
                                            }
                                        </Box>

                                        {getAvailableSeasons(tvShowDetails.seasons).length === 0 ? (
                                            <Typography variant='body2' sx={{ color: 'rgba(255,255,255,0.7)', mt: 1 }}>
                                                All seasons are already available or requested
                                            </Typography>
                                        ) : null}
                                    </Box>
                                ) : (
                                    <Typography variant='body2' sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                        Failed to load season information
                                    </Typography>
                                )}
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                            <Button
                                variant='outlined'
                                onClick={() => {
                                    setConfirmationItem(null);
                                    setTvShowDetails(null);
                                    setSelectedSeasons([]);
                                    // Restore the previous search query to reopen autocomplete
                                    if (previousSearchQuery) {
                                        setSearchQuery(previousSearchQuery);
                                        setPreviousSearchQuery('');
                                    }
                                }}
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant='contained'
                                onClick={() => {
                                    const seasonsToRequest = confirmationItem.mediaType === 'tv' ? selectedSeasons : undefined;
                                    handleRequest(confirmationItem, seasonsToRequest);
                                    setConfirmationItem(null);
                                    setPreviousSearchQuery(''); // Clear saved search since request was made
                                }}
                                disabled={
                                    confirmationItem.status?.status === 4 ||
                                    (confirmationItem.mediaType === 'tv' && selectedSeasons.length === 0) ||
                                    (confirmationItem.mediaType === 'tv' && tvShowDetails && getAvailableSeasons(tvShowDetails.seasons).length === 0)
                                }
                                sx={{
                                    backgroundColor: 'primary.main',
                                    '&:hover': { backgroundColor: 'primary.dark' }
                                }}
                            >
                                {confirmationItem.status?.status === 4 ? 'Already Available' : 'Request'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </CenteredModal>

        </CardContent>
    );
};
