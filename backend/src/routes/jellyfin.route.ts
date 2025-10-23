import { Request, Response, Router } from 'express';
import http from 'http';
import https from 'https';

import { getItemConnectionInfo } from '../utils/config-lookup';

export const jellyfinRoute = Router();

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

// Helper function to validate and get itemId with better error message
const validateItemId = (req: Request): string => {
    const itemId = req.query.itemId as string;
    if (!itemId) {
        throw new Error('itemId parameter is required. Please ensure the widget is properly configured with an item ID.');
    }
    return itemId;
};

/**
 * Get current Jellyfin sessions
 */
jellyfinRoute.get('/sessions', async (req: Request, res: Response) => {
    try {
        const itemId = validateItemId(req);
        const connectionInfo = getItemConnectionInfo(itemId);

        if (!connectionInfo) {
            res.status(400).json({
                sessions: [],
                error: 'Widget configuration not found'
            });
            return;
        }

        const { host, port, ssl, apiKey } = connectionInfo;

        if (!host || !apiKey) {
            res.status(400).json({
                sessions: [],
                error: 'Missing required configuration: host and apiKey'
            });
            return;
        }

        console.log('Jellyfin sessions request');

        // Clean the host to remove any protocol prefix
        let cleanHost = host;
        cleanHost = cleanHost.replace(/^https?:\/\//, '');
        cleanHost = cleanHost.replace(/\/+$/, '');

        const protocol = ssl ? 'https' : 'http';
        const actualPort = port || '8096';
        const baseUrl = `${protocol}://${cleanHost}:${actualPort}`;
        const sessionsUrl = `${baseUrl}/Sessions`;

        const httpModule = ssl ? https : http;

        // Create promise-based HTTP request
        const makeRequest = (): Promise<JellyfinSession[]> => {
            return new Promise((resolve, reject) => {
                const options = {
                    headers: {
                        'Authorization': `MediaBrowser Token="${apiKey}"`,
                        'X-MediaBrowser-Token': apiKey,
                        'Accept': 'application/json',
                        'User-Agent': 'Lab-Dash/1.0'
                    },
                    timeout: 10000,
                    // Allow self-signed certificates for HTTPS requests
                    rejectUnauthorized: false
                };

                const request = httpModule.get(sessionsUrl, options, (response) => {
                    let data = '';

                    response.on('data', (chunk) => {
                        data += chunk;
                    });

                    response.on('end', () => {
                        try {
                            if (response.statusCode !== 200) {
                                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                                return;
                            }

                            const sessions = JSON.parse(data) as JellyfinSession[];

                            // Filter sessions that have active playback
                            const activeSessions = sessions.filter(session => session.NowPlayingItem);

                            resolve(activeSessions);
                        } catch (parseError) {
                            reject(new Error('Failed to parse Jellyfin response'));
                        }
                    });
                });

                request.on('error', (error) => {
                    reject(new Error(`Request failed: ${error.message}`));
                });

                request.on('timeout', () => {
                    reject(new Error('Request timeout'));
                });

                request.setTimeout(10000);
            });
        };

        const sessions = await makeRequest();

        res.json({
            sessions: sessions
        });

    } catch (error) {
        console.error('Jellyfin API error:', error);

        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        res.status(500).json({
            sessions: [],
            error: errorMessage
        });
    }
});

/**
 * Get Jellyfin library statistics
 */
jellyfinRoute.get('/library-stats', async (req: Request, res: Response) => {
    try {
        const itemId = validateItemId(req);
        const connectionInfo = getItemConnectionInfo(itemId);

        if (!connectionInfo) {
            res.status(400).json({
                tvShows: 0,
                movies: 0,
                error: 'Widget configuration not found'
            });
            return;
        }

        const { host, port, ssl, apiKey } = connectionInfo;

        if (!host || !apiKey) {
            res.status(400).json({
                tvShows: 0,
                movies: 0,
                error: 'Missing required configuration: host and apiKey'
            });
            return;
        }

        console.log('Jellyfin library stats request');

        // Clean the host to remove any protocol prefix
        let cleanHost = host;
        cleanHost = cleanHost.replace(/^https?:\/\//, '');
        cleanHost = cleanHost.replace(/\/+$/, '');

        const protocol = ssl ? 'https' : 'http';
        const actualPort = port || '8096';
        const baseUrl = `${protocol}://${cleanHost}:${actualPort}`;

        const httpModule = ssl ? https : http;

        // Get library items
        const makeLibraryRequest = (itemType: string): Promise<any[]> => {
            return new Promise((resolve, reject) => {
                const libraryUrl = `${baseUrl}/Items?IncludeItemTypes=${itemType}&Recursive=true&Fields=BasicSyncInfo`;

                const options = {
                    headers: {
                        'Authorization': `MediaBrowser Token="${apiKey}"`,
                        'X-MediaBrowser-Token': apiKey,
                        'Accept': 'application/json',
                        'User-Agent': 'Lab-Dash/1.0'
                    },
                    timeout: 15000,
                    rejectUnauthorized: false
                };

                const request = httpModule.get(libraryUrl, options, (response) => {
                    let data = '';

                    response.on('data', (chunk) => {
                        data += chunk;
                    });

                    response.on('end', () => {
                        try {
                            if (response.statusCode !== 200) {
                                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                                return;
                            }

                            const result = JSON.parse(data);
                            resolve(result.Items || []);
                        } catch (parseError) {
                            reject(new Error('Failed to parse Jellyfin response'));
                        }
                    });
                });

                request.on('error', (error) => {
                    reject(new Error(`Request failed: ${error.message}`));
                });

                request.on('timeout', () => {
                    reject(new Error('Request timeout'));
                });

                request.setTimeout(15000);
            });
        };

        // Fetch both TV shows and movies
        const [tvShows, movies] = await Promise.all([
            makeLibraryRequest('Series'),
            makeLibraryRequest('Movie')
        ]);

        res.json({
            tvShows: tvShows.length,
            movies: movies.length
        });

    } catch (error) {
        console.error('Jellyfin library stats error:', error);

        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        res.status(500).json({
            tvShows: 0,
            movies: 0,
            error: errorMessage
        });
    }
});
