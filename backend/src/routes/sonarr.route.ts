import axios from 'axios';
import { Request, Response, Router } from 'express';
import https from 'https';

import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, isEncrypted } from '../utils/crypto';

export const sonarrRoute = Router();

// Configure HTTPS agent to allow self-signed certificates for Sonarr connections
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
    
    const port = connectionInfo.port || '8989';
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
            console.error('API key decryption failed for Sonarr');
            return null;
        }
    }

    return apiKey;
};

interface SonarrQueueItem {
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
    episode: {
        id: number;
        episodeNumber: number;
        title: string;
        airDate: string;
        hasFile: boolean;
        monitored: boolean;
        series: {
            id: number;
            title: string;
            sortTitle: string;
            seasonCount: number;
            status: string;
            overview: string;
            network: string;
            airTime: string;
            images: Array<{
                coverType: string;
                url: string;
                remoteUrl: string;
            }>;
            seasons: Array<{
                seasonNumber: number;
                monitored: boolean;
            }>;
            year: number;
            path: string;
            qualityProfileId: number;
            languageProfileId: number;
            seriesType: string;
            cleanTitle: string;
            imdbId: string;
            tvdbId: number;
            tvRageId: number;
            tvMazeId: number;
            firstAired: string;
            lastInfoSync: string;
            runtime: number;
            tags: number[];
            added: string;
            ratings: {
                votes: number;
                value: number;
            };
            genres: string[];
            certification: string;
            remotePoster: string;
            ended: boolean;
            monitored: boolean;
        };
    };
}

// Get Sonarr queue
sonarrRoute.get('/queue', async (req: Request, res: Response) => {
    console.log('Sonarr queue request');
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

        const queueItems: SonarrQueueItem[] = response.data.records || response.data || [];

        // Transform to common format
        const transformedItems = queueItems.map(item => {
            // Safely extract series information with fallbacks
            const seriesTitle = item.episode?.series?.title || item.title || 'Unknown Series';
            const episodeTitle = item.episode?.title || 'Unknown Episode';
            const episodeNumber = item.episode?.episodeNumber || 0;

            const finalState = getStateFromStatus(item.status, item.trackedDownloadStatus, item.trackedDownloadState);

            return {
                id: item.id,
                hash: item.downloadId || item.id.toString(),
                name: `${seriesTitle} - S00E${episodeNumber.toString().padStart(2, '0')} - ${episodeTitle}`,
                title: item.title,
                state: finalState,
                progress: item.size > 0 ? Math.max(0, (item.size - item.sizeleft) / item.size) : 0,
                size: item.size,
                dlspeed: 0, // Sonarr doesn't provide real-time speed
                upspeed: 0,
                eta: item.timeleft ? parseTimeLeft(item.timeleft) : undefined,
                protocol: item.protocol,
                downloadClient: item.downloadClient,
                indexer: item.indexer,
                added: item.added,
                estimatedCompletionTime: item.estimatedCompletionTime,
                statusMessages: item.statusMessages || [],
                series: {
                    title: seriesTitle,
                    year: item.episode?.series?.year || 0,
                    poster: item.episode?.series?.images?.find(img => img.coverType === 'poster')?.remoteUrl
                },
                episode: {
                    seasonNumber: 0, // Season number not available in this API response
                    episodeNumber: episodeNumber,
                    title: episodeTitle,
                    airDate: item.episode?.airDate || ''
                }
            };
        });

        res.json({
            success: true,
            data: transformedItems
        });

    } catch (error: any) {
        console.error('Sonarr queue error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Sonarr queue'
        });
    }
});

// Remove item from Sonarr queue
sonarrRoute.delete('/queue/:id', async (req: Request, res: Response) => {
    console.log('Sonarr queue delete request');
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
        console.error('Sonarr queue delete error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to remove item from queue'
        });
    }
});

// Get Sonarr system status
sonarrRoute.get('/status', async (req: Request, res: Response) => {
    console.log('Sonarr status request');
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
        console.error('Sonarr status error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Sonarr status'
        });
    }
});

// Get Sonarr series for statistics
sonarrRoute.get('/series', async (req: Request, res: Response) => {
    console.log('Sonarr series request');
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

        const response = await axios.get(`${baseUrl}/api/v3/series`, {
            headers: {
                'X-Api-Key': apiKey
            },
            timeout: 10000,
            httpsAgent: httpsAgent
        });

        const series = response.data || [];
        const monitoredSeries = series.filter((s: any) => s.monitored);

        res.json({
            success: true,
            data: {
                totalSeries: series.length,
                monitoredSeries: monitoredSeries.length
            }
        });

    } catch (error: any) {
        console.error('Sonarr series error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to get Sonarr series'
        });
    }
});

// Refresh Monitored Downloads endpoint
sonarrRoute.post('/refresh-monitored-downloads', async (req: Request, res: Response): Promise<void> => {
    try {
        const baseUrl = getBaseUrl(req);
        const apiKey = getApiKey(req);

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'API key not configured for this Sonarr instance'
            });
            return;
        }

        console.log('Sending RefreshMonitoredDownloads command to:', baseUrl);
        // Send RefreshMonitoredDownloads command to Sonarr
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
        console.error('Sonarr refresh monitored downloads error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to refresh monitored downloads'
        });
    }
});

// Utility functions
function getStateFromStatus(status: string, trackedDownloadStatus: string, trackedDownloadState: string): string {
    // Map Sonarr statuses to common download states
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
