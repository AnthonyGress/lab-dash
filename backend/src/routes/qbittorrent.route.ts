import axios from 'axios';
import { NextFunction, Request, Response, Router } from 'express';
import qs from 'querystring';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const qbittorrentRoute = Router();

// Store auth cookies for qBittorrent sessions with expiration timestamps
interface SessionInfo {
    cookie: string;
    expires: number; // Timestamp when the session expires
    username?: string;
    password?: string; // Store encrypted password for auto-renewal
}

// Store sessions with expiration info
const sessions: Record<string, SessionInfo> = {};

// qBittorrent sessions typically last about 30 minutes
const SESSION_LIFETIME = 25 * 60 * 1000; // 25 minutes in milliseconds

const getBaseUrl = (req: Request): string => {
    const itemId = req.query.itemId as string;

    if (!itemId) {
        throw new Error('itemId parameter is required');
    }

    const connectionInfo = getItemConnectionInfo(itemId);
    
    // Clean the host to remove any protocol prefix
    let host = connectionInfo.host || 'localhost';
    host = host.replace(/^https?:\/\//, '');
    host = host.replace(/\/+$/, '');
    
    const port = connectionInfo.port || '8080';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}/api/v2`;
};

// Function to authenticate with qBittorrent API
async function authenticateQBittorrent(baseUrl: string, username: string, password: string): Promise<string | null> {
    try {
        // Handle encrypted password
        let decryptedPassword = password;
        if (isEncrypted(password)) {
            decryptedPassword = decrypt(password);
            // Check if decryption failed (returns empty string)
            if (!decryptedPassword) {
                console.error('qBittorrent password decryption failed');
                return null;
            }
        }

        const response = await axios.post(`${baseUrl}/auth/login`,
            qs.stringify({ username, password: decryptedPassword }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

        // Return cookie if login successful
        if (response.headers['set-cookie'] && response.headers['set-cookie'].length > 0) {
            return response.headers['set-cookie'][0];
        }
        return null;
    } catch (error) {
        console.error('qBittorrent authentication error:', error);
        return null;
    }
}

// Function to get credentials from item config
function getCredentials(req: Request): { username?: string; password?: string } {
    const itemId = req.query.itemId as string;

    if (!itemId) {
        throw new Error('itemId parameter is required');
    }

    const connectionInfo = getItemConnectionInfo(itemId);
    return {
        username: connectionInfo.username,
        password: connectionInfo.password
    };
}

// Function to check and renew session if needed
async function ensureValidSession(req: Request): Promise<string | null> {
    const baseUrl = getBaseUrl(req);
    const sessionId = req.user?.username || req.ip || 'default';
    const session = sessions[sessionId];
    const credentials = getCredentials(req);

    // If no session exists, try to create one
    if (!session) {
        // If credentials provided, try to authenticate
        if (credentials.username && credentials.password) {
            const cookie = await authenticateQBittorrent(baseUrl, credentials.username, credentials.password);
            if (cookie) {
                // Store session with expiration
                sessions[sessionId] = {
                    cookie,
                    expires: Date.now() + SESSION_LIFETIME,
                    username: credentials.username,
                    password: credentials.password // Store encrypted password for renewal
                };
                return cookie;
            }
        }
        return null;
    }

    // If session exists but may be expired
    if (session.expires < Date.now() + 60000) { // Renew if less than 1 minute left
        console.log('qBittorrent session renewing...');

        // Try to use stored credentials for renewal
        if (session.username && session.password) {
            const cookie = await authenticateQBittorrent(baseUrl, session.username, session.password);
            if (cookie) {
                // Update session with new cookie and expiration
                sessions[sessionId] = {
                    ...session,
                    cookie,
                    expires: Date.now() + SESSION_LIFETIME
                };
                return cookie;
            }
        }

        // If no stored credentials or renewal failed, try with current credentials
        if (credentials.username && credentials.password) {
            const cookie = await authenticateQBittorrent(baseUrl, credentials.username, credentials.password);
            if (cookie) {
                // Store session with expiration
                sessions[sessionId] = {
                    cookie,
                    expires: Date.now() + SESSION_LIFETIME,
                    username: credentials.username,
                    password: credentials.password
                };
                return cookie;
            }
        }
    }

    // If session is still valid, return the cookie
    return session.cookie;
}

qbittorrentRoute.post('/login', async (req: Request, res: Response) => {
    console.log('qBittorrent login request');
    try {
        const itemId = req.query.itemId as string;

        if (!itemId) {
            res.status(400).json({ error: 'itemId parameter is required' });
            return;
        }

        const connectionInfo = getItemConnectionInfo(itemId);
        const baseUrl = getBaseUrl(req);
        const username = connectionInfo.username;
        const password = connectionInfo.password;

        if (!username || !password) {
            console.error('qBittorrent authentication failed - missing password. Ensure the password is configured for this item.');
            res.status(400).json({ error: 'Username and password must be configured for this item' });
            return;
        }

        // Handle encrypted password
        let decryptedPassword = password;
        if (isEncrypted(password)) {
            decryptedPassword = decrypt(password);
            // Check if decryption failed (returns empty string)
            if (!decryptedPassword) {
                console.error('qBittorrent password decryption failed');
                res.status(400).json({
                    error: 'Failed to decrypt password. It may have been encrypted with a different key. Please update your credentials.'
                });
                return;
            }
        }


        const response = await axios.post(`${baseUrl}/auth/login`,
            qs.stringify({ username, password: decryptedPassword }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

        // Store cookie for future requests
        const sessionId = req.user?.username || req.ip || 'default';
        if (response.headers['set-cookie']) {
            sessions[sessionId] = {
                cookie: response.headers['set-cookie'][0],
                expires: Date.now() + SESSION_LIFETIME,
                username,
                password // Store encrypted password for renewal
            };
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
    console.log('qBittorrent stats request');
    try {
        const baseUrl = getBaseUrl(req);

        // Get or create a valid session
        const cookie = await ensureValidSession(req);

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

        try {
            const transferInfo = await axios.get(`${baseUrl}/transfer/info`, {
                headers: { Cookie: cookie },
                timeout: 1000
            });

            const torrentsMaindata = await axios.get(`${baseUrl}/torrents/info`, {
                headers: { Cookie: cookie },
                timeout: 1000
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
        } catch (apiErr: any) {
            // If we get a 403 (Forbidden), the session has likely expired
            if (apiErr.response?.status === 403) {
                console.log('qBittorrent session expired, renewing...');
                // Clear the invalid session
                const sessionId = req.user?.username || req.ip || 'default';
                if (sessions[sessionId]) {
                    const sessionInfo = sessions[sessionId];

                    // Try to renew the session
                    if (sessionInfo.username && sessionInfo.password) {
                        try {
                            const newCookie = await authenticateQBittorrent(
                                baseUrl,
                                sessionInfo.username,
                                sessionInfo.password
                            );

                            if (newCookie) {
                                console.log('qBittorrent session renewed successfully');
                                // Update session with new cookie
                                sessions[sessionId] = {
                                    ...sessionInfo,
                                    cookie: newCookie,
                                    expires: Date.now() + SESSION_LIFETIME
                                };

                                // Retry the request with the new cookie
                                try {
                                    const transferInfo = await axios.get(`${baseUrl}/transfer/info`, {
                                        headers: { Cookie: newCookie },
                                        timeout: 1000
                                    });

                                    const torrentsMaindata = await axios.get(`${baseUrl}/torrents/info`, {
                                        headers: { Cookie: newCookie },
                                        timeout: 1000
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
                                    return;
                                } catch (retryErr: any) {
                                    console.error('Error after session renewal:', retryErr.message);
                                    // Fall through to the error handling below
                                }
                            }
                        } catch (renewErr: any) {
                            console.error('Failed to renew qBittorrent session:', renewErr.message);
                        }
                    }

                    // If renewal failed or no credentials, delete the session
                    console.log('qBittorrent session renewal failed');
                    delete sessions[sessionId];
                }

                // Return empty stats
                res.status(200).json({
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
                    },
                    sessionExpired: true
                });
                return;
            }

            // Check for connection errors
            if (apiErr.code === 'ECONNREFUSED' || apiErr.code === 'ETIMEDOUT' || apiErr.code === 'ECONNABORTED') {
                console.log(`qBittorrent service offline: ${baseUrl}`);
            }

            throw apiErr; // Re-throw for the outer catch
        }
    } catch (mainErr: any) {
        console.error('qBittorrent stats error:', mainErr.message);
        res.status(mainErr.response?.status || 500).json({
            error: mainErr.response?.data || 'Failed to get qBittorrent stats'
        });
    }
});

// Get list of all torrents
qbittorrentRoute.get('/torrents', async (req: Request, res: Response) => {
    console.log('qBittorrent torrents request');
    try {
        const baseUrl = getBaseUrl(req);
        // Get or create a valid session
        const cookie = await ensureValidSession(req);

        if (!cookie) {
            // If not authenticated and couldn't auto-login, return empty array
            res.status(200).json([]);
            return;
        }

        try {
            const response = await axios.get(`${baseUrl}/torrents/info`, {
                headers: { Cookie: cookie }
            });

            res.status(200).json(response.data);
        } catch (error: any) {
            // If we get a 403 (Forbidden), the session has likely expired
            if (error.response?.status === 403) {
                // Session expired, return empty array with flag
                res.status(200).json([]);
                return;
            }

            throw error; // Re-throw for the outer catch
        }
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
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];

        if (session) {
            // Call qBittorrent logout endpoint
            await logoutQBittorrentSession(baseUrl, session.cookie);

            // Delete the session
            delete sessions[sessionId];
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('qBittorrent logout error:', error);
        res.status(500).json({ error: 'Failed to logout from qBittorrent' });
    }
});

// Start torrent(s)
qbittorrentRoute.post('/torrents/start', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        // Get or create a valid session
        const cookie = await ensureValidSession(req);

        // Extract hashes from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;

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
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookie
                }
            });

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('qBittorrent start error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to start torrent'
        });
    }
});

// Stop torrent(s)
qbittorrentRoute.post('/torrents/stop', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        // Get or create a valid session
        const cookie = await ensureValidSession(req);

        // Extract hashes from either JSON body or form-urlencoded body
        const hashes = req.body.hashes;

        if (!cookie) {
            res.status(401).json({ error: 'Not authenticated with qBittorrent' });
            return;
        }

        if (!hashes) {
            res.status(400).json({ error: 'Hash parameter is required' });
            return;
        }

        try {
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
        // Get or create a valid session
        const cookie = await ensureValidSession(req);

        // Extract parameters
        const hashes = req.body.hashes;
        const deleteFiles = req.body.deleteFiles === true;

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

// Function to logout from qBittorrent session
async function logoutQBittorrentSession(baseUrl: string, sessionId: string): Promise<boolean> {
    try {
        await axios.post(`${baseUrl}/auth/logout`, null, {
            headers: {
                'Cookie': sessionId
            }
        });
        return true;
    } catch (error) {
        console.error('Error logging out qBittorrent session:', error);
        return false;
    }
}
