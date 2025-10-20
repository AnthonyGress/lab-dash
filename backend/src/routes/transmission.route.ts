import axios from 'axios';
import { NextFunction, Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const transmissionRoute = Router();

// Store auth info for Transmission sessions
interface SessionInfo {
    sessionId: string;
    expires: number;
    username?: string;
    password?: string;
}

// Store sessions with expiration info
const sessions: Record<string, SessionInfo> = {};

// Transmission sessions typically last longer than qBittorrent
const SESSION_LIFETIME = 60 * 60 * 1000; // 60 minutes in milliseconds

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
    // Remove http:// or https:// if present
    host = host.replace(/^https?:\/\//, '');
    // Remove any trailing slashes
    host = host.replace(/\/+$/, '');
    
    const port = connectionInfo.port || '9091';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}:${port}/transmission/rpc`;

    return baseUrl;
};

// Function to get session ID from Transmission
async function getTransmissionSessionId(baseUrl: string, username?: string, password?: string): Promise<string | null> {
    try {
        console.log('Attempting to connect to Transmission at:', baseUrl);

        // First request to get session ID (will return 409 with X-Transmission-Session-Id header)
        const authHeader = username && password ? {
            'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        } : {};

        try {
            const response = await axios.post(baseUrl, {
                method: 'session-get'
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeader
                },
                timeout: 10000 // 10 second timeout
            });

            console.log('Unexpected success response from Transmission:', response.status);
        } catch (error: any) {
            if (error.response?.status === 409) {
                // This is expected - Transmission returns 409 with session ID
                const sessionId = error.response.headers['x-transmission-session-id'];

                if (sessionId) {
                    return sessionId;
                }
            } else {
                console.error('Unexpected Transmission response:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    message: error.message,
                    code: error.code
                });
            }
            throw error;
        }
        return null;
    } catch (error: any) {
        console.error('Transmission session ID error:', {
            message: error.message,
            code: error.code,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            } : 'No response object'
        });
        return null;
    }
}

// Function to authenticate with Transmission (if credentials provided)
async function authenticateTransmission(baseUrl: string, username?: string, password?: string): Promise<string | null> {
    try {
        // Handle encrypted password
        let decryptedPassword = password;
        if (password && isEncrypted(password)) {
            decryptedPassword = decrypt(password);
            if (!decryptedPassword) {
                console.error('Transmission password decryption failed');
                return null;
            }
        }

        return await getTransmissionSessionId(baseUrl, username, decryptedPassword);
    } catch (error) {
        console.error('Transmission authentication error:', error);
        return null;
    }
}

// Function to get credentials from item config
function getCredentials(req: Request): { username?: string; password?: string } {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    return {
        username: connectionInfo.username,
        password: connectionInfo.password
    };
}

// Function to ensure valid session
async function ensureValidSession(req: Request): Promise<string | null> {
    const baseUrl = getBaseUrl(req);
    const sessionKey = req.user?.username || req.ip || 'default';
    const session = sessions[sessionKey];
    const credentials = getCredentials(req);

    // If no session exists or session expired, create new one
    if (!session || session.expires < Date.now()) {
        // Treat empty strings as undefined for Transmission
        const cleanUsername = credentials.username && credentials.username.trim() !== '' ? credentials.username : undefined;
        const cleanPassword = credentials.password && credentials.password.trim() !== '' ? credentials.password : undefined;

        const sessionId = await authenticateTransmission(baseUrl, cleanUsername, cleanPassword);
        if (sessionId) {
            sessions[sessionKey] = {
                sessionId,
                expires: Date.now() + SESSION_LIFETIME,
                username: cleanUsername,
                password: cleanPassword
            };
            return sessionId;
        }
        return null;
    }

    return session.sessionId;
}

// Make RPC request to Transmission
async function makeTransmissionRequest(
    baseUrl: string, 
    sessionId: string, 
    method: string, 
    args?: any, 
    username?: string, 
    password?: string,
    sessionKey?: string
): Promise<any> {
    // Handle encrypted password
    let decryptedPassword = password;
    if (password && isEncrypted(password)) {
        decryptedPassword = decrypt(password);
        if (!decryptedPassword) {
            console.error('Transmission password decryption failed');
            decryptedPassword = undefined;
        }
    }

    const authHeader = username && decryptedPassword ? {
        'Authorization': `Basic ${Buffer.from(`${username}:${decryptedPassword}`).toString('base64')}`
    } : {};

    try {
        const response = await axios.post(baseUrl, {
            method,
            arguments: args || {}
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Transmission-Session-Id': sessionId,
                ...authHeader
            }
        });

        return response.data;
    } catch (error: any) {
        // Handle 409 Conflict - Transmission sends new session ID
        if (error.response?.status === 409) {
            const newSessionId = error.response.headers['x-transmission-session-id'];
            if (newSessionId) {
                console.log('Received new Transmission session ID, retrying request...');
                
                // Update the stored session if sessionKey provided
                if (sessionKey && sessions[sessionKey]) {
                    sessions[sessionKey].sessionId = newSessionId;
                    sessions[sessionKey].expires = Date.now() + SESSION_LIFETIME;
                }
                
                // Retry with new session ID
                const retryResponse = await axios.post(baseUrl, {
                    method,
                    arguments: args || {}
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Transmission-Session-Id': newSessionId,
                        ...authHeader
                    }
                });
                return retryResponse.data;
            }
        }
        throw error;
    }
}

transmissionRoute.post('/login', async (req: Request, res: Response) => {
    console.log('Transmission login request');
    try {
        const itemId = validateItemId(req);

        const baseUrl = getBaseUrl(req);
        const connectionInfo = getItemConnectionInfo(itemId);

        const username = connectionInfo.username;
        const password = connectionInfo.password;

        // For Transmission, credentials are optional
        let decryptedPassword = password;
        if (password && isEncrypted(password)) {
            decryptedPassword = decrypt(password);
            if (!decryptedPassword) {
                res.status(400).json({
                    error: 'Failed to decrypt password. It may have been encrypted with a different key. Please update your credentials.'
                });
                return;
            }
        }

        const sessionId = await authenticateTransmission(baseUrl, username, decryptedPassword);

        if (sessionId) {
            // Store session
            const sessionKey = req.user?.username || req.ip || 'default';
            sessions[sessionKey] = {
                sessionId,
                expires: Date.now() + SESSION_LIFETIME,
                username,
                password
            };
            res.status(200).json({ success: true });
        } else {
            res.status(401).json({ error: 'Failed to authenticate with Transmission' });
        }
    } catch (error: any) {
        console.error('Transmission login error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to login to Transmission'
        });
    }
});

// Encrypt password for storage in config
transmissionRoute.post('/encrypt-password', authenticateToken, async (req: Request, res: Response) => {
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
transmissionRoute.get('/stats', async (req: Request, res: Response) => {
    console.log('Transmission stats request');
    try {
        const baseUrl = getBaseUrl(req);
        const sessionKey = req.user?.username || req.ip || 'default';
        const session = sessions[sessionKey];
        const sessionId = await ensureValidSession(req);

        if (!sessionId) {
            // Return empty stats if no session
            const stats = {
                downloadSpeed: 0,
                uploadSpeed: 0,
                cumulative: {
                    downloadedBytes: 0,
                    uploadedBytes: 0
                },
                torrentCount: 0,
                activeTorrentCount: 0,
                pausedTorrentCount: 0
            };
            res.status(200).json(stats);
            return;
        }

        try {
            // Use stored session credentials if available, otherwise get from item config
            const credentials = getCredentials(req);
            const username = session?.username || credentials.username;
            const password = session?.password || credentials.password;


            const response = await makeTransmissionRequest(
                baseUrl,
                sessionId,
                'session-stats',
                {},
                username,
                password,
                sessionKey
            );

            if (response.result === 'success') {
                res.status(200).json(response.arguments);
            } else {
                throw new Error('Failed to get session stats');
            }
        } catch (error: any) {
            console.error('Transmission stats API error:', {
                message: error.message,
                code: error.code,
                response: error.response ? {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                } : 'No response object'
            });
            // Return empty stats on error
            res.status(200).json({
                downloadSpeed: 0,
                uploadSpeed: 0,
                cumulative: {
                    downloadedBytes: 0,
                    uploadedBytes: 0
                },
                torrentCount: 0,
                activeTorrentCount: 0,
                pausedTorrentCount: 0
            });
        }
    } catch (error: any) {
        console.error('Transmission stats error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get Transmission stats'
        });
    }
});

// Get list of all torrents
transmissionRoute.get('/torrents', async (req: Request, res: Response) => {
    console.log('Transmission torrents request');
    try {
        const baseUrl = getBaseUrl(req);
        const sessionKey = req.user?.username || req.ip || 'default';
        const session = sessions[sessionKey];
        const sessionId = await ensureValidSession(req);

        if (!sessionId) {
            res.status(200).json([]);
            return;
        }

        try {
            // Use stored session credentials if available, otherwise get from item config
            const credentials = getCredentials(req);
            const username = session?.username || credentials.username;
            const password = session?.password || credentials.password;



            const response = await makeTransmissionRequest(
                baseUrl,
                sessionId,
                'torrent-get',
                {
                    fields: [
                        'id',
                        'name',
                        'status',
                        'percentDone',
                        'totalSize',
                        'rateDownload',
                        'rateUpload',
                        'eta',
                        'hashString'
                    ]
                },
                username,
                password,
                sessionKey
            );

            if (response.result === 'success') {
                res.status(200).json(response.arguments.torrents);
            } else {
                res.status(200).json([]);
            }
        } catch (error: any) {
            console.error('Transmission torrents API error:', {
                message: error.message,
                code: error.code,
                response: error.response ? {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                } : 'No response object'
            });
            res.status(200).json([]);
        }
    } catch (error: any) {
        console.error('Transmission torrents error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get torrents from Transmission'
        });
    }
});

// Start torrent(s)
transmissionRoute.post('/torrents/start', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionKey = req.user?.username || req.ip || 'default';
        const session = sessions[sessionKey];
        const sessionId = await ensureValidSession(req);

        const { ids } = req.body;

        if (!sessionId) {
            res.status(401).json({ error: 'Not authenticated with Transmission' });
            return;
        }

        if (!ids) {
            res.status(400).json({ error: 'IDs parameter is required' });
            return;
        }

        // Use stored session credentials if available, otherwise get from item config
        const credentials = getCredentials(req);
        const username = session?.username || credentials.username;
        const password = session?.password || credentials.password;

        const response = await makeTransmissionRequest(
            baseUrl,
            sessionId,
            'torrent-start',
            { ids: Array.isArray(ids) ? ids : [ids] },
            username,
            password,
            sessionKey
        );

        if (response.result === 'success') {
            res.status(200).json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to start torrent' });
        }
    } catch (error: any) {
        console.error('Transmission start error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to start torrent'
        });
    }
});

// Stop torrent(s)
transmissionRoute.post('/torrents/stop', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionKey = req.user?.username || req.ip || 'default';
        const session = sessions[sessionKey];
        const sessionId = await ensureValidSession(req);

        const { ids } = req.body;

        if (!sessionId) {
            res.status(401).json({ error: 'Not authenticated with Transmission' });
            return;
        }

        if (!ids) {
            res.status(400).json({ error: 'IDs parameter is required' });
            return;
        }

        // Use stored session credentials if available, otherwise get from item config
        const credentials = getCredentials(req);
        const username = session?.username || credentials.username;
        const password = session?.password || credentials.password;

        const response = await makeTransmissionRequest(
            baseUrl,
            sessionId,
            'torrent-stop',
            { ids: Array.isArray(ids) ? ids : [ids] },
            username,
            password,
            sessionKey
        );

        if (response.result === 'success') {
            res.status(200).json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to stop torrent' });
        }
    } catch (error: any) {
        console.error('Transmission stop error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to stop torrent'
        });
    }
});

// Delete torrent(s)
transmissionRoute.post('/torrents/delete', authenticateToken, async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const sessionKey = req.user?.username || req.ip || 'default';
        const session = sessions[sessionKey];
        const sessionId = await ensureValidSession(req);

        const { ids, deleteFiles } = req.body;

        if (!sessionId) {
            res.status(401).json({ error: 'Not authenticated with Transmission' });
            return;
        }

        if (!ids) {
            res.status(400).json({ error: 'IDs parameter is required' });
            return;
        }

        // Use stored session credentials if available, otherwise get from item config
        const credentials = getCredentials(req);
        const username = session?.username || credentials.username;
        const password = session?.password || credentials.password;

        const response = await makeTransmissionRequest(
            baseUrl,
            sessionId,
            'torrent-remove',
            {
                ids: Array.isArray(ids) ? ids : [ids],
                'delete-local-data': deleteFiles === true
            },
            username,
            password,
            sessionKey
        );

        if (response.result === 'success') {
            res.status(200).json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to delete torrent' });
        }
    } catch (error: any) {
        console.error('Transmission delete error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to delete torrent'
        });
    }
});

// Logout (clear session)
transmissionRoute.post('/logout', authenticateToken, async (req: Request, res: Response) => {
    try {
        const sessionKey = req.user?.username || req.ip || 'default';
        if (sessions[sessionKey]) {
            delete sessions[sessionKey];
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Transmission logout error:', error);
        res.status(500).json({ error: 'Failed to logout from Transmission' });
    }
});
