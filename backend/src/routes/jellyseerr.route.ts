import axios from 'axios';
import { Request, Response, Router } from 'express';
import https from 'https';

import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, isEncrypted } from '../utils/crypto';

export const jellyseerRoute = Router();

// Configure HTTPS agent to allow self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Helper function to validate and get itemId
const validateItemId = (req: Request): string => {
    const itemId = req.query.itemId as string;
    if (!itemId) {
        throw new Error('itemId parameter is required. Please ensure the widget is properly configured with an item ID.');
    }
    return itemId;
};

const getBaseUrl = (req: Request): string => {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    
    // Clean the host to remove any protocol prefix
    let host = connectionInfo.host || 'localhost';
    host = host.replace(/^https?:\/\//, '');
    host = host.replace(/\/+$/, '');
    
    const port = connectionInfo.port || '5055';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
};

const getApiKey = (req: Request): string | null => {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    let apiKey = connectionInfo.apiKey;

    if (!apiKey) {
        return null;
    }

    // Handle encrypted API key
    if (isEncrypted(apiKey)) {
        apiKey = decrypt(apiKey);
        if (!apiKey) {
            console.error('API key decryption failed for Jellyseerr');
            return null;
        }
    }

    return apiKey;
};

// Search for movies and TV shows
jellyseerRoute.get('/search', async (req: Request, res: Response) => {
    console.log('Jellyseerr search request');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const query = req.query.query as string;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        if (!query) {
            res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
            return;
        }

        // Simple search call without pagination for now
        const encodedQuery = encodeURIComponent(query.trim());
        const response = await axios.get(`${baseUrl}/api/v1/search?query=${encodedQuery}`, {
            headers: {
                'X-Api-Key': apiKey
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Jellyseerr search error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to search'
        });
    }
});

// Get pending requests
jellyseerRoute.get('/requests', async (req: Request, res: Response) => {
    console.log('Jellyseerr requests request');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const status = req.query.status as string || 'pending';

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        const response = await axios.get(`${baseUrl}/api/v1/request`, {
            headers: {
                'X-Api-Key': apiKey
            },
            params: {
                filter: status === 'all' ? undefined : status,
                take: 50, // Increased to get more results including declined ones
                skip: 0,
                sort: 'added',
                requestedBy: req.query.requestedBy || undefined
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        // Enhance requests with title information from Jellyseerr's media endpoint
        const enhancedResults = await Promise.all(
            (response.data.results || []).map(async (request: any) => {
                try {
                    if (request.media && request.media.tmdbId) {
                        const mediaType = request.media.mediaType === 'tv' ? 'tv' : 'movie';
                        const mediaResponse = await axios.get(
                            `${baseUrl}/api/v1/${mediaType}/${request.media.tmdbId}`,
                            {
                                headers: {
                                    'X-Api-Key': apiKey
                                },
                                timeout: 5000,
                                httpsAgent: httpsAgent
                            }
                        );

                        // Add title information to the media object
                        request.media.title = mediaResponse.data.title || mediaResponse.data.name;
                        request.media.overview = mediaResponse.data.overview;
                        request.media.releaseDate = mediaResponse.data.releaseDate || mediaResponse.data.firstAirDate;
                        request.media.posterPath = mediaResponse.data.posterPath;
                    }
                } catch (mediaError: any) {
                    // If media lookup fails, continue without title info
                    console.warn(`Failed to fetch media data for request ${request.id}:`, mediaError.message);
                }
                return request;
            })
        );

        res.json({
            success: true,
            data: {
                ...response.data,
                results: enhancedResults
            }
        });

    } catch (error: any) {
        console.error('Jellyseerr requests error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Jellyseerr requests'
        });
    }
});

// Request a movie or TV show
jellyseerRoute.post('/request', async (req: Request, res: Response) => {
    console.log('Jellyseerr request creation');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const { mediaType, mediaId, seasons } = req.body;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        if (!mediaType || !mediaId) {
            res.status(400).json({
                success: false,
                error: 'mediaType and mediaId are required'
            });
            return;
        }

        const requestBody: any = {
            mediaType: mediaType,
            mediaId: parseInt(mediaId)
        };

        // Add seasons for TV shows
        if (mediaType === 'tv') {
            if (seasons && seasons.length > 0) {
                requestBody.seasons = seasons;
            } else {
                // If no seasons specified, don't include the seasons field
                // This will let Jellyseerr handle the default behavior
                console.warn('No seasons specified for TV show request');
            }
        }

        console.log('Jellyseerr API URL:', `${baseUrl}/api/v1/request`);

        const response = await axios.post(`${baseUrl}/api/v1/request`, requestBody, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Jellyseerr request creation error:', error.message);
        console.error('Error response status:', error.response?.status);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to create request'
        });
    }
});

// Approve a request
jellyseerRoute.post('/request/:id/approve', async (req: Request, res: Response) => {
    console.log('Jellyseerr request approval');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const { id } = req.params;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        const response = await axios.post(`${baseUrl}/api/v1/request/${id}/approve`, {}, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Jellyseerr request approval error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to approve request'
        });
    }
});

// Decline a request
jellyseerRoute.post('/request/:id/decline', async (req: Request, res: Response) => {
    console.log('Jellyseerr request decline');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const { id } = req.params;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        const response = await axios.post(`${baseUrl}/api/v1/request/${id}/decline`, {}, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Jellyseerr request decline error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to decline request'
        });
    }
});

// Get TV show details including seasons
jellyseerRoute.get('/tv/:tmdbId', async (req: Request, res: Response) => {
    console.log('Jellyseerr TV show details request');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const { tmdbId } = req.params;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        if (!tmdbId) {
            res.status(400).json({
                success: false,
                error: 'tmdbId parameter is required'
            });
            return;
        }

        const response = await axios.get(`${baseUrl}/api/v1/tv/${tmdbId}`, {
            headers: {
                'X-Api-Key': apiKey
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Jellyseerr TV show details error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get TV show details'
        });
    }
});

// Get system status
jellyseerRoute.get('/status', async (req: Request, res: Response) => {
    console.log('Jellyseerr status request');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        const response = await axios.get(`${baseUrl}/api/v1/status`, {
            headers: {
                'X-Api-Key': apiKey
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Jellyseerr status error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Jellyseerr status'
        });
    }
});
