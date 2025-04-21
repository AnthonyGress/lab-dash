import axios from 'axios';
import { Request, Response, Router } from 'express';
import qs from 'querystring';

import { authenticateToken } from '../middleware/auth.middleware';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const qbittorrentRoute = Router();

// Store auth cookies for qBittorrent sessions
const sessions: Record<string, string> = {};

// Helper: Get qBittorrent base URL from request
const getBaseUrl = (req: Request): string => {
    const host = req.query.host as string || 'localhost';
    const port = req.query.port as string || '8080';
    const ssl = req.query.ssl === 'true';
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}/api/v2`;
};

// Login to qBittorrent and store auth cookie
qbittorrentRoute.post('/login', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { username } = req.body;
        let { password } = req.body;
        const baseUrl = getBaseUrl(req);

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        // Handle encrypted password
        if (isEncrypted(password)) {
            password = decrypt(password);
        }

        const response = await axios.post(`${baseUrl}/auth/login`,
            qs.stringify({ username, password }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

        // Store cookie for future requests
        const sessionId = req.user?.username || 'default';
        if (response.headers['set-cookie']) {
            sessions[sessionId] = response.headers['set-cookie'][0];
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('qBittorrent login error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to login to qBittorrent'
        });
    }
});

// Encrypt password for storage in config
qbittorrentRoute.post('/encrypt-password', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;

        if (!password) {
            res.status(400).json({ error: 'Password is required' });
            return;
        }

        // Don't re-encrypt if already encrypted
        if (isEncrypted(password)) {
            res.status(200).json({ encryptedPassword: password });
            return;
        }

        const encryptedPassword = encrypt(password);
        res.status(200).json({ encryptedPassword });
    } catch (error) {
        console.error('Password encryption error:', error);
        res.status(500).json({ error: 'Failed to encrypt password' });
    }
});

// Get current download stats
qbittorrentRoute.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        // Get transfer information (download/upload speeds, etc.)
        const transferResponse = await axios.get(`${baseUrl}/transfer/info`, {
            headers: { Cookie: cookie }
        });

        // Get torrent list (to count active, completed, etc.)
        const torrentsResponse = await axios.get(`${baseUrl}/torrents/info`, {
            headers: { Cookie: cookie }
        });

        // Create a simplified stats object
        const torrents = torrentsResponse.data || [];
        const stats = {
            ...transferResponse.data,
            torrents: {
                total: torrents.length,
                downloading: torrents.filter((t: any) => t.state === 'downloading').length,
                seeding: torrents.filter((t: any) => t.state === 'seeding' || t.state === 'uploading').length,
                completed: torrents.filter((t: any) => t.progress === 1).length,
                stopd: torrents.filter((t: any) => t.state === 'stopdDL' || t.state === 'stopdUP').length
            }
        };

        res.status(200).json(stats);
    } catch (error: any) {
        console.error('qBittorrent stats error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get qBittorrent stats'
        });
    }
});

// Get list of all torrents
qbittorrentRoute.get('/torrents', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        const response = await axios.get(`${baseUrl}/torrents/info`, {
            headers: { Cookie: cookie }
        });

        res.status(200).json(response.data);
    } catch (error: any) {
        console.error('qBittorrent torrents error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get torrents from qBittorrent'
        });
    }
});

// Logout
qbittorrentRoute.post('/logout', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        if (cookie) {
            // Call qBittorrent logout endpoint
            await axios.post(`${baseUrl}/auth/logout`, {}, {
                headers: { Cookie: cookie }
            });

            // Delete the session
            delete sessions[sessionId];
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('qBittorrent logout error:', error);
        res.status(500).json({ error: 'Failed to logout from qBittorrent' });
    }
});

// start torrent(s)
qbittorrentRoute.post('/torrents/start', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        // Extract hashes from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;

        console.log('qBittorrent start request received:', {
            body: req.body,
            bodyType: typeof req.body,
            hashesParsed: hashes,
            requestContentType: req.headers['content-type']
        });

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        console.log('Sending start request to qBittorrent for hash:', hashes);

        const requestBody = { hashes };
        console.log('Formatted request body:', qs.stringify(requestBody));

        const response = await axios.post(`${baseUrl}/torrents/start`,
            qs.stringify(requestBody),
            {
                headers: {
                    Cookie: cookie,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('qBittorrent start response:', response.status, response.data);
        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('qBittorrent start error:', error.message);
        if (error.response) {
            console.error('Response details:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to start torrent'
        });
    }
});

// stop torrent(s)
qbittorrentRoute.post('/torrents/stop', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        // Extract hashes from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;

        console.log('qBittorrent stop request received:', {
            body: req.body,
            bodyType: typeof req.body,
            hashesParsed: hashes,
            requestContentType: req.headers['content-type']
        });

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        console.log('Sending stop request to qBittorrent for hash:', hashes);
        console.log('Full qBittorrent API URL:', `${baseUrl}/torrents/stop`);

        try {
            // Using the correct format for qBittorrent API which expects URL-encoded form data
            const requestBody = { hashes };

            console.log('Formatted request body:', qs.stringify(requestBody));

            const response = await axios.post(`${baseUrl}/torrents/stop`,
                qs.stringify(requestBody),
                {
                    headers: {
                        Cookie: cookie,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            console.log('qBittorrent stop response:', response.status, response.data);
            res.status(200).json({ success: true });
        } catch (innerError: any) {
            console.error('qBittorrent stop request failed:', innerError.message);
            console.error('Request URL:', `${baseUrl}/torrents/stop`);
            console.error('Request data:', { hashes });

            if (innerError.response) {
                console.error('Response status:', innerError.response.status);
                console.error('Response data:', innerError.response.data);
            }

            throw innerError; // Rethrow to be caught by the outer catch block
        }
    } catch (error: any) {
        console.error('qBittorrent stop error:', error.message);
        if (error.response) {
            console.error('Response details:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to stop torrent'
        });
    }
});

// Delete torrent(s)
qbittorrentRoute.post('/torrents/delete', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionId = req.user?.username || 'default';
        const cookie = sessions[sessionId];

        // Extract parameters from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;
        const deleteFiles = req.body.deleteFiles;

        console.log('qBittorrent delete request received:', {
            body: req.body,
            bodyType: typeof req.body,
            hashesParsed: hashes,
            deleteFilesParsed: deleteFiles,
            requestContentType: req.headers['content-type']
        });

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        console.log('Sending delete request to qBittorrent for hash:', hashes, 'deleteFiles:', deleteFiles);

        const requestBody = {
            hashes,
            deleteFiles: deleteFiles === true
        };
        console.log('Formatted request body:', qs.stringify(requestBody));

        const response = await axios.post(`${baseUrl}/torrents/delete`,
            qs.stringify(requestBody),
            {
                headers: {
                    Cookie: cookie,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('qBittorrent delete response:', response.status, response.data);
        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('qBittorrent delete error:', error.message);
        if (error.response) {
            console.error('Response details:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to delete torrent'
        });
    }
});
