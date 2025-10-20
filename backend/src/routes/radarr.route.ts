import axios from 'axios';
import { Request, Response, Router } from 'express';
import https from 'https';

import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, isEncrypted } from '../utils/crypto';

export const radarrRoute = Router();

// Configure HTTPS agent to allow self-signed certificates for Radarr connections
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Allow self-signed certificates
});

// Helper function to validate and get itemId with better error message
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
    
    const port = connectionInfo.port || '7878';
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
        // Check if decryption failed (returns empty string)
        if (!apiKey) {
            console.error('API key decryption failed for Radarr');
            return null;
        }
    }

    return apiKey;
};

interface RadarrQueueItem {
    id: number;
    title: string;
    status: string;
    trackedDownloadStatus: string;
    trackedDownloadState: string;
    statusMessages: Array<{
        title: string;
        messages: string[];
    }>;
    downloadId: string;
    protocol: string;
    downloadClient: string;
    indexer: string;
    outputPath: string;
    estimatedCompletionTime?: string;
    added: string;
    size: number;
    sizeleft: number;
    timeleft?: string;
    movie: {
        id: number;
        title: string;
        originalTitle: string;
        originalLanguage: {
            id: number;
            name: string;
        };
        secondaryYearSourceId: number;
        sortTitle: string;
        sizeOnDisk: number;
        status: string;
        overview: string;
        inCinemas: string;
        physicalRelease: string;
        digitalRelease: string;
        images: Array<{
            coverType: string;
            url: string;
            remoteUrl: string;
        }>;
        website: string;
        year: number;
        hasFile: boolean;
        youTubeTrailerId: string;
        studio: string;
        path: string;
        qualityProfileId: number;
        monitored: boolean;
        minimumAvailability: string;
        isAvailable: boolean;
        folderName: string;
        runtime: number;
        cleanTitle: string;
        imdbId: string;
        tmdbId: number;
        titleSlug: string;
        certification: string;
        genres: string[];
        tags: number[];
        added: string;
        ratings: {
            imdb: {
                votes: number;
                value: number;
                type: string;
            };
            tmdb: {
                votes: number;
                value: number;
                type: string;
            };
            metacritic: {
                votes: number;
                value: number;
                type: string;
            };
            rottenTomatoes: {
                votes: number;
                value: number;
                type: string;
            };
        };
        movieFile: {
            id: number;
            movieId: number;
            relativePath: string;
            path: string;
            size: number;
            dateAdded: string;
            releaseGroup: string;
            quality: {
                quality: {
                    id: number;
                    name: string;
                    source: string;
                    resolution: number;
                    modifier: string;
                };
                revision: {
                    version: number;
                    real: number;
                    isRepack: boolean;
                };
            };
            customFormats: any[];
            indexerFlags: number;
            mediaInfo: {
                audioChannels: number;
                audioCodec: string;
                audioLanguages: string;
                height: number;
                width: number;
                subtitles: string;
                videoCodec: string;
                videoDynamicRangeType: string;
                videoDynamicRange: string;
            };
            originalFilePath: string;
        };
        collection: {
            name: string;
            tmdbId: number;
            images: any[];
        };
    };
}

// Get Radarr queue
radarrRoute.get('/queue', async (req: Request, res: Response) => {
    console.log('Radarr queue request');
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

        const response = await axios.get(`${baseUrl}/api/v3/queue`, {
            headers: {
                'X-Api-Key': apiKey
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        const queueItems: RadarrQueueItem[] = response.data.records || response.data || [];

        // Transform to common format
        const transformedItems = queueItems.map(item => {
            const finalState = getStateFromStatus(item.status, item.trackedDownloadStatus, item.trackedDownloadState);

            return {
                id: item.id,
                hash: item.downloadId || item.id.toString(),
                name: item.movie?.title ? `${item.movie.title} (${item.movie.year || 'Unknown'})` : item.title || 'Unknown Movie',
                title: item.title || 'Unknown',
                state: finalState,
                progress: item.size > 0 ? Math.max(0, (item.size - item.sizeleft) / item.size) : 0,
                size: item.size || 0,
                dlspeed: 0, // Radarr doesn't provide real-time speed
                upspeed: 0,
                eta: item.timeleft ? parseTimeLeft(item.timeleft) : undefined,
                protocol: item.protocol || 'Unknown',
                downloadClient: item.downloadClient || 'Unknown',
                indexer: item.indexer || 'Unknown',
                added: item.added || '',
                estimatedCompletionTime: item.estimatedCompletionTime,
                statusMessages: item.statusMessages || [],
                movie: item.movie ? {
                    title: item.movie.title || 'Unknown',
                    originalTitle: item.movie.originalTitle || '',
                    year: item.movie.year || 0,
                    overview: item.movie.overview || '',
                    runtime: item.movie.runtime || 0,
                    certification: item.movie.certification || '',
                    genres: item.movie.genres || [],
                    imdbId: item.movie.imdbId || '',
                    tmdbId: item.movie.tmdbId || 0,
                    poster: item.movie.images?.find(img => img.coverType === 'poster')?.remoteUrl,
                    fanart: item.movie.images?.find(img => img.coverType === 'fanart')?.remoteUrl,
                    inCinemas: item.movie.inCinemas || '',
                    physicalRelease: item.movie.physicalRelease || '',
                    digitalRelease: item.movie.digitalRelease || '',
                    studio: item.movie.studio || '',
                    ratings: item.movie.ratings || {}
                } : undefined
            };
        });

        res.json({
            success: true,
            data: transformedItems
        });

    } catch (error: any) {
        console.error('Radarr queue error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Radarr queue'
        });
    }
});

// Remove item from Radarr queue
radarrRoute.delete('/queue/:id', async (req: Request, res: Response) => {
    console.log('Radarr queue delete request');
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);
        const { id } = req.params;
        const { removeFromClient = true, blocklist = false } = req.query;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key is required or could not be decrypted'
            });
            return;
        }

        const response = await axios.delete(`${baseUrl}/api/v3/queue/${id}`, {
            headers: {
                'X-Api-Key': apiKey
            },
            params: {
                removeFromClient: removeFromClient === 'true',
                blocklist: blocklist === 'true'
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        res.json({
            success: true,
            message: 'Item removed from queue successfully'
        });

    } catch (error: any) {
        console.error('Radarr queue delete error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to remove item from queue'
        });
    }
});

// Get Radarr system status
radarrRoute.get('/status', async (req: Request, res: Response) => {
    console.log('Radarr status request');
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

        const response = await axios.get(`${baseUrl}/api/v3/system/status`, {
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
        console.error('Radarr status error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Radarr status'
        });
    }
});

// Get Radarr movies for statistics
radarrRoute.get('/movies', async (req: Request, res: Response) => {
    console.log('Radarr movies request');
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

        const response = await axios.get(`${baseUrl}/api/v3/movie`, {
            headers: {
                'X-Api-Key': apiKey
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        const movies = response.data || [];
        const monitoredMovies = movies.filter((m: any) => m.monitored);

        res.json({
            success: true,
            data: {
                totalMovies: movies.length,
                monitoredMovies: monitoredMovies.length
            }
        });

    } catch (error: any) {
        console.error('Radarr movies error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Radarr movies'
        });
    }
});

// Refresh Monitored Downloads endpoint
radarrRoute.post('/refresh-monitored-downloads', async (req: Request, res: Response): Promise<void> => {
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key not configured for this Radarr instance'
            });
            return;
        }

        console.log('Sending RefreshMonitoredDownloads command to:', baseUrl);
        // Send RefreshMonitoredDownloads command to Radarr
        await axios.post(`${baseUrl}/api/v3/command`, {
            name: 'RefreshMonitoredDownloads'
        }, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            httpsAgent: httpsAgent,
            timeout: 10000
        });

        res.json({
            success: true,
            message: 'RefreshMonitoredDownloads command sent successfully'
        });

    } catch (error: any) {
        console.error('Radarr refresh monitored downloads error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to refresh monitored downloads'
        });
    }
});

// Utility functions
function getStateFromStatus(status: string, trackedDownloadStatus: string, trackedDownloadState: string): string {
    // Map Radarr statuses to common download states
    // Check status first as it's the most accurate current state
    if (status === 'downloading') {
        return 'downloading';
    }
    if (status === 'paused') {
        return 'paused';
    }
    if (status === 'queued') {
        return 'queued';
    }
    if (status === 'completed') {
        return 'completed';
    }
    if (status === 'failed') {
        return 'error';
    }
    if (status === 'warning') {
        return 'warning';
    }
    if (status === 'stopped') {
        return 'stopped';
    }

    // Check trackedDownloadStatus next
    if (trackedDownloadStatus === 'downloading') {
        return 'downloading';
    }
    if (trackedDownloadStatus === 'paused') {
        return 'paused';
    }
    if (trackedDownloadStatus === 'queued') {
        return 'queued';
    }
    if (trackedDownloadStatus === 'completed') {
        return 'completed';
    }
    if (trackedDownloadStatus === 'failed') {
        return 'error';
    }
    if (trackedDownloadStatus === 'warning') {
        return 'warning';
    }

    // Finally check trackedDownloadState
    if (trackedDownloadState === 'downloading') {
        return 'downloading';
    }
    if (trackedDownloadState === 'paused' || trackedDownloadState === 'pausedDL') {
        return 'paused';
    }
    if (trackedDownloadState === 'stopped') {
        return 'stopped';
    }
    if (trackedDownloadState === 'stalled' || trackedDownloadState === 'stalledDL') {
        return 'stalled';
    }



    return status || trackedDownloadStatus || trackedDownloadState || 'unknown';
}

function parseTimeLeft(timeLeft: string): number | undefined {
    // Parse time left string (e.g., "00:15:30") to seconds
    if (!timeLeft || timeLeft === '00:00:00') return undefined;

    const parts = timeLeft.split(':');
    if (parts.length !== 3) return undefined;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);

    return (hours * 3600) + (minutes * 60) + seconds;
}
