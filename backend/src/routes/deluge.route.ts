import axios from 'axios';
import { Request, Response, Router } from 'express';
import qs from 'querystring';

import { authenticateToken } from '../middleware/auth.middleware';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const delugeRoute = Router();

// Store auth cookies for Deluge sessions
const sessions: Record<string, string> = {};

// Helper: Get Deluge base URL from request
const getBaseUrl = (req: Request): string => {
    const host = req.query.host as string || 'localhost';
    const port = req.query.port as string || '8112';
    const ssl = req.query.ssl === 'true';
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}/json`;
};

// Login to Deluge and store auth cookie
delugeRoute.post('/login', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { username } = req.body;
        let { password } = req.body;
        const baseUrl = getBaseUrl(req);

        if (!password) {
            res.status(400).json({ error: 'Password is required' });
            return;
        }

        // Handle encrypted password
        if (isEncrypted(password)) {
            password = decrypt(password);
        }

        // Deluge WebUI uses a different auth mechanism
        const response = await axios.post(`${baseUrl}`,
            {
                method: 'auth.login',
                params: [password],
                id: 1
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

        // Check if login was successful
        if (response.data.result !== true) {
            res.status(401).json({
                error: 'Failed to login to Deluge'
            });
            return;
        }

        // Store cookie for future requests
        const sessionId = req.user?.username || 'default';
        if (response.headers['set-cookie']) {
            sessions[sessionId] = response.headers['set-cookie'][0];
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Deluge login error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to login to Deluge'
        });
    }
});

// Get current download stats
delugeRoute.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with Deluge' });
            return;
        }

        // Get session status (download/upload speeds)
        const sessionResponse = await axios.post(`${baseUrl}`,
            {
                method: 'web.update_ui',
                params: [
                    ['download_rate', 'upload_rate', 'total_download', 'total_upload'],
                    {}
                ],
                id: 2
            },
            {
                headers: { Cookie: cookie }
            });

        // Format response to match qBittorrent structure
        const stats = {
            dl_info_speed: sessionResponse.data.result.stats.download_rate || 0,
            up_info_speed: sessionResponse.data.result.stats.upload_rate || 0,
            dl_info_data: sessionResponse.data.result.stats.total_download || 0,
            up_info_data: sessionResponse.data.result.stats.total_upload || 0,
            torrents: {
                total: 0,
                downloading: 0,
                seeding: 0,
                completed: 0,
                paused: 0
            }
        };

        // Get torrent list to count by status
        const torrentsResponse = await axios.post(`${baseUrl}`,
            {
                method: 'web.update_ui',
                params: [
                    ['state', 'progress'],
                    {}
                ],
                id: 3
            },
            {
                headers: { Cookie: cookie }
            });

        // Count torrents by state
        const torrents = torrentsResponse.data.result.torrents || {};
        stats.torrents.total = Object.keys(torrents).length;

        Object.values(torrents).forEach((torrent: any) => {
            const state = torrent.state.toLowerCase();
            if (state === 'downloading') {
                stats.torrents.downloading++;
            } else if (state === 'seeding') {
                stats.torrents.seeding++;
            } else if (state === 'paused') {
                stats.torrents.paused++;
            }

            if (torrent.progress === 100) {
                stats.torrents.completed++;
            }
        });

        res.status(200).json(stats);
    } catch (error: any) {
        console.error('Deluge stats error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get Deluge stats'
        });
    }
});

// Get list of all torrents
delugeRoute.get('/torrents', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with Deluge' });
            return;
        }

        // Get torrent list with key properties
        const response = await axios.post(`${baseUrl}`,
            {
                method: 'web.update_ui',
                params: [
                    ['name', 'state', 'progress', 'download_payload_rate', 'upload_payload_rate', 'total_size', 'eta'],
                    {}
                ],
                id: 4
            },
            {
                headers: { Cookie: cookie }
            });

        // Transform Deluge torrents to match qBittorrent format for API compatibility
        const delugeTorrents = response.data.result.torrents || {};
        const formattedTorrents = Object.keys(delugeTorrents).map(hash => {
            const torrent = delugeTorrents[hash];

            // Map Deluge states to qBittorrent states
            let state = 'unknown';
            const delugeState = torrent.state.toLowerCase();

            if (delugeState === 'downloading') {
                state = 'downloading';
            } else if (delugeState === 'seeding') {
                state = 'seeding';
            } else if (delugeState === 'paused') {
                state = 'pausedDL';
            } else if (delugeState === 'queued') {
                state = 'stalledDL';
            } else if (delugeState === 'checking') {
                state = 'checkingUP';
            }

            return {
                hash,
                name: torrent.name,
                state,
                progress: torrent.progress / 100, // Deluge uses 0-100, qBittorrent uses 0-1
                dlspeed: torrent.download_payload_rate,
                upspeed: torrent.upload_payload_rate,
                size: torrent.total_size,
                eta: torrent.eta // Add ETA in seconds
            };
        });

        res.status(200).json(formattedTorrents);
    } catch (error: any) {
        console.error('Deluge torrents error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get torrents from Deluge'
        });
    }
});

// Logout
delugeRoute.post('/logout', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        if (cookie) {
            // Call Deluge logout endpoint
            await axios.post(`${baseUrl}`,
                {
                    method: 'auth.logout',
                    params: [],
                    id: 5
                },
                {
                    headers: { Cookie: cookie }
                });

            // Delete the session
            delete sessions[sessionId];
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Deluge logout error:', error);
        res.status(500).json({ error: 'Failed to logout from Deluge' });
    }
});

// Resume torrent(s)
delugeRoute.post('/torrents/resume', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];
        const { hash } = req.body;

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with Deluge' });
            return;
        }

        if (!hash) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        // Call Deluge resume method
        const response = await axios.post(`${baseUrl}`,
            {
                method: 'core.resume_torrent',
                params: [[hash]],
                id: 6
            },
            {
                headers: { Cookie: cookie }
            });

        // Check the response
        if (response.data.error) {
            throw new Error(response.data.error.message || 'Failed to resume torrent');
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Deluge resume error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to resume torrent'
        });
    }
});

// Pause torrent(s)
delugeRoute.post('/torrents/pause', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];
        const { hash } = req.body;

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with Deluge' });
            return;
        }

        if (!hash) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        // Call Deluge pause method
        const response = await axios.post(`${baseUrl}`,
            {
                method: 'core.pause_torrent',
                params: [[hash]],
                id: 7
            },
            {
                headers: { Cookie: cookie }
            });

        // Check the response
        if (response.data.error) {
            throw new Error(response.data.error.message || 'Failed to pause torrent');
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Deluge pause error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to pause torrent'
        });
    }
});

// Delete torrent(s)
delugeRoute.post('/torrents/delete', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];
        const { hash, deleteFiles } = req.body;

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with Deluge' });
            return;
        }

        if (!hash) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        // Call Deluge remove_torrent method
        const response = await axios.post(`${baseUrl}`,
            {
                method: 'core.remove_torrent',
                params: [hash, deleteFiles === true],
                id: 8
            },
            {
                headers: { Cookie: cookie }
            });

        // Check the response
        if (response.data.error) {
            throw new Error(response.data.error.message || 'Failed to delete torrent');
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Deluge delete error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to delete torrent'
        });
    }
});
