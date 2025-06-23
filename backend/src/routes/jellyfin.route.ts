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

        const protocol = ssl ? 'https' : 'http';
        const actualPort = port || '8096';
        const baseUrl = `${protocol}://${host}:${actualPort}`;
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
                    timeout: 10000
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
