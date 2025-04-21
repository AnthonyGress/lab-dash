import axios from 'axios';
import { NextFunction, Request, Response, Router } from 'express';
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

// Middleware to allow direct access with credentials in query params
const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    // If username and password are provided in query params, bypass auth
    const { username, password } = req.query;

    if (username && password) {
        console.log('Using direct credentials from query params for qBittorrent API access');
        next();
    } else {
        // Otherwise, use the standard auth middleware
        authenticateToken(req, res, next);
    }
};

// Login to qBittorrent and store auth cookie
qbittorrentRoute.post('/login', async (req: Request, res: Response) => {
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
        // Use a unique identifier or default to IP address if no user
        const sessionId = req.ip || 'default';
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
qbittorrentRoute.get('/stats', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        // Use IP address as identifier for non-authenticated users
        const sessionId = req.user?.username || req.ip || 'default';
        let cookie = sessions[sessionId];

        // If no cookie exists, try to use credentials from config if available
        if (!cookie && req.query.username && req.query.password) {
            try {
                let password = req.query.password as string;
                const username = req.query.username as string;

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(
                    `${baseUrl}/auth/login`,
                    qs.stringify({ username, password }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Store the cookie for future requests
                if (loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = cookie;
                }
            } catch (loginError) {
                console.error('qBittorrent login attempt failed:', loginError);
                // Continue without cookie - will return default stats
            }
        }

        if (!cookie) {
            // If not authenticated and couldn't auto-login, provide basic response with empty/zero values
            const stats = {
                dl_info_speed: 0,
                up_info_speed: 0,
                dl_info_data: 0,
                up_info_data: 0,
                torrents: {
                    total: 0,
                    downloading: 0,
                    seeding: 0,
                    completed: 0,
                    paused: 0
                }
            };
            res.status(200).json(stats);
            return;
        }

        const transferInfo = await axios.get(`${baseUrl}/transfer/info`, {
            headers: { Cookie: cookie }
        });

        const torrentsMaindata = await axios.get(`${baseUrl}/torrents/info`, {
            headers: { Cookie: cookie }
        });

        // Count torrents by state
        const torrents = torrentsMaindata.data || [];
        const stats = {
            dl_info_speed: transferInfo.data.dl_info_speed || 0,
            up_info_speed: transferInfo.data.up_info_speed || 0,
            dl_info_data: transferInfo.data.dl_info_data || 0,
            up_info_data: transferInfo.data.up_info_data || 0,
            torrents: {
                total: torrents.length,
                downloading: torrents.filter((t: any) => t.state === 'downloading').length,
                seeding: torrents.filter((t: any) => t.state === 'seeding' || t.state === 'uploading').length,
                completed: torrents.filter((t: any) => t.progress === 1).length,
                paused: torrents.filter((t: any) => t.state === 'pausedDL' || t.state === 'pausedUP').length
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
qbittorrentRoute.get('/torrents', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        // Use IP address as identifier for non-authenticated users
        const sessionId = req.user?.username || req.ip || 'default';
        let cookie = sessions[sessionId];

        // If no cookie exists, try to use credentials from config if available
        if (!cookie && req.query.username && req.query.password) {
            try {
                let password = req.query.password as string;
                const username = req.query.username as string;

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(
                    `${baseUrl}/auth/login`,
                    qs.stringify({ username, password }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Store the cookie for future requests
                if (loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = cookie;
                }
            } catch (loginError) {
                console.error('qBittorrent login attempt failed:', loginError);
                // Continue without cookie - will return empty array
            }
        }

        if (!cookie) {
            // If not authenticated and couldn't auto-login, return empty array
            res.status(200).json([]);
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
        let cookie = sessions[sessionId];

        // Extract hashes from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;

        // If no cookie exists or we have new credentials, try to use credentials from query params
        if ((!cookie || req.query.username) && req.query.username && req.query.password) {
            try {
                let password = req.query.password as string;
                const username = req.query.username as string;

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(
                    `${baseUrl}/auth/login`,
                    qs.stringify({ username, password }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Store the cookie for future requests
                if (loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = cookie;
                }
            } catch (loginError) {
                console.error('qBittorrent login attempt failed:', loginError);
                // Continue with existing cookie if available, otherwise will return an error below
            }
        }

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        const requestBody = { hashes };

        const response = await axios.post(`${baseUrl}/torrents/start`,
            qs.stringify(requestBody),
            {
                headers: {
                    Cookie: cookie,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('qBittorrent start error:', error.message);
        if (error.response) {
            console.error('Response details:', {
                status: error.response.status,
                data: error.response.data
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
        let cookie = sessions[sessionId];

        // Extract hashes from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;

        // If no cookie exists or we have new credentials, try to use credentials from query params
        if ((!cookie || req.query.username) && req.query.username && req.query.password) {
            try {
                let password = req.query.password as string;
                const username = req.query.username as string;

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(
                    `${baseUrl}/auth/login`,
                    qs.stringify({ username, password }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Store the cookie for future requests
                if (loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = cookie;
                }
            } catch (loginError) {
                console.error('qBittorrent login attempt failed:', loginError);
                // Continue with existing cookie if available, otherwise will return an error below
            }
        }

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        try {
            // Using the correct format for qBittorrent API which expects URL-encoded form data
            const requestBody = { hashes };

            const response = await axios.post(`${baseUrl}/torrents/stop`,
                qs.stringify(requestBody),
                {
                    headers: {
                        Cookie: cookie,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            res.status(200).json({ success: true });
        } catch (innerError: any) {
            console.error('qBittorrent stop request failed:', innerError.message);
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
                data: error.response.data
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
        let cookie = sessions[sessionId];

        // Extract parameters from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;
        const deleteFiles = req.body.deleteFiles;

        // If no cookie exists or we have new credentials, try to use credentials from query params
        if ((!cookie || req.query.username) && req.query.username && req.query.password) {
            try {
                let password = req.query.password as string;
                const username = req.query.username as string;

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(
                    `${baseUrl}/auth/login`,
                    qs.stringify({ username, password }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Store the cookie for future requests
                if (loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = cookie;
                }
            } catch (loginError) {
                console.error('qBittorrent login attempt failed:', loginError);
                // Continue with existing cookie if available, otherwise will return an error below
            }
        }

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        const requestBody = {
            hashes,
            deleteFiles: deleteFiles === true
        };

        const response = await axios.post(`${baseUrl}/torrents/delete`,
            qs.stringify(requestBody),
            {
                headers: {
                    Cookie: cookie,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('qBittorrent delete error:', error.message);
        if (error.response) {
            console.error('Response details:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to delete torrent'
        });
    }
});
