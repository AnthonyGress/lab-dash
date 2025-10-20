import axios from 'axios';
import { Request, Response, Router } from 'express';
import qs from 'querystring';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const delugeRoute = Router();

// Store auth cookies for Deluge sessions with expiration timestamps
interface SessionInfo {
    cookie: string;
    expires: number; // Timestamp when the session expires
    host?: string;
    port?: string;
    ssl?: boolean;
}

// Store sessions with expiration info
const sessions: Record<string, SessionInfo> = {};

// Deluge sessions typically last about 30 minutes
const SESSION_LIFETIME = 25 * 60 * 1000; // 25 minutes in milliseconds

// Clean expired sessions periodically
setInterval(async () => {
    const now = Date.now();
    let expiredCount = 0;
    let logoutCount = 0;

    // Collect expired sessions
    const expiredSessions: Array<{sessionId: string; session: SessionInfo}> = [];
    Object.entries(sessions).forEach(([sessionId, session]) => {
        if (session.expires < now) {
            expiredSessions.push({ sessionId, session });
        }
    });

    if (expiredSessions.length > 0) {
        // Process all expired sessions with proper logout
        const logoutPromises = expiredSessions.map(async ({ sessionId, session }) => {
            try {
                const baseUrl = getBaseUrlFromSession(session);
                if (baseUrl) {
                    const logoutSuccess = await logoutDelugeSession(baseUrl, session.cookie);
                    if (logoutSuccess) {
                        logoutCount++;
                    }
                }

                // Remove from cache regardless of logout success
                delete sessions[sessionId];
                expiredCount++;
            } catch (error) {
                console.error('Error logging out expired Deluge session:', error);
                // Still remove the expired session from cache
                delete sessions[sessionId];
                expiredCount++;
            }
        });

        // Wait for all logout operations to complete
        await Promise.all(logoutPromises);

        if (expiredCount > 0) {
            console.log(`Cleaned up ${expiredCount} expired Deluge sessions (${logoutCount} successful logouts)`);
        }
    }
}, 60000); // Check every minute

// Helper function to create base URL from session info
const getBaseUrlFromSession = (session: SessionInfo): string | null => {
    if (!session.host) return null;
    const port = session.port || '8112';
    const protocol = session.ssl ? 'https' : 'http';
    return `${protocol}://${session.host}:${port}/json`;
};

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
    
    const port = connectionInfo.port || '8112';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}/json`;
};

// Function to get connection info from item config
function getConnectionDetails(req: Request) {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    // Try different possible password field names
    const password = connectionInfo.password || (connectionInfo as any).webPassword || (connectionInfo as any).auth?.password;

    return {
        password: password,
        host: connectionInfo.host || 'localhost',
        port: connectionInfo.port || '8112',
        ssl: connectionInfo.ssl || false
    };
}

// Helper function to logout a Deluge session
async function logoutDelugeSession(baseUrl: string, cookie: string): Promise<boolean> {
    try {
        await axios.post(`${baseUrl}`,
            {
                method: 'auth.logout',
                params: [],
                id: 5
            },
            {
                headers: { Cookie: cookie },
                timeout: 5000
            });

        console.log(`Successfully logged out Deluge session from ${baseUrl}`);
        return true;
    } catch (error: any) {
        console.error(`Deluge logout error for ${baseUrl}:`, error.message);
        // Log more detailed error information
        if (error.response) {
            console.error('Logout error response:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        return false;
    }
}

// Clean up all sessions when the process terminates
process.on('SIGINT', async () => {
    // Count active sessions
    const activeSessionCount = Object.keys(sessions).length;
    if (activeSessionCount === 0) {
        process.exit(0);
    }

    console.log(`Cleaning up ${activeSessionCount} Deluge sessions before shutdown...`);

    // Logout all active sessions
    const logoutPromises: Promise<boolean>[] = [];
    Object.entries(sessions).forEach(([sessionId, session]) => {
        try {
            const baseUrl = getBaseUrlFromSession(session);
            if (baseUrl) {
                logoutPromises.push(logoutDelugeSession(baseUrl, session.cookie));
            }
        } catch (error) {
            console.error('Error during shutdown session cleanup:', error);
        }
    });

    try {
        // Wait for all logout operations with a timeout
        await Promise.race([
            Promise.all(logoutPromises),
            new Promise(resolve => setTimeout(resolve, 3000)) // 3 second timeout
        ]);
    } catch (error) {
        console.error('Error during Deluge sessions cleanup:', error);
    }

    // Clear all sessions
    Object.keys(sessions).forEach(key => delete sessions[key]);
    process.exit(0);
});

delugeRoute.post('/login', async (req: Request, res: Response) => {
    console.log('Deluge login request');
    try {
        const itemId = validateItemId(req);

        const baseUrl = getBaseUrl(req);
        const connectionInfo = getItemConnectionInfo(itemId);


        // Try different possible password field names
        let password = connectionInfo.password;
        const host = connectionInfo.host;
        const port = connectionInfo.port;
        const ssl = connectionInfo.ssl;

        if (!password) {
            console.error('Deluge authentication failed - missing password. Ensure the password is configured for this item.');
            res.status(400).json({ error: 'Password must be configured for this item' });
            return;
        }

        // Handle encrypted password
        if (isEncrypted(password)) {
            password = decrypt(password);
            // Check if decryption failed (returns empty string)
            if (!password) {
                console.error('Deluge password decryption failed');
                res.status(400).json({
                    error: 'Failed to decrypt password. It may have been encrypted with a different key. Please update your credentials.'
                });
                return;
            }
        }

        console.log('Deluge login attempt');
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
            console.error('Deluge login failed: Invalid credentials');
            res.status(401).json({
                error: 'Failed to login to Deluge'
            });
            return;
        }

        // Store cookie for future requests
        // Use a unique identifier or default to IP address if no user
        const sessionId = req.user?.username || req.ip || 'default';
        if (response.headers['set-cookie']) {
            sessions[sessionId] = {
                cookie: response.headers['set-cookie'][0],
                expires: Date.now() + SESSION_LIFETIME,
                host,
                port,
                ssl
            };
            console.log('Deluge login successful');
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
delugeRoute.get('/stats', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        console.log('Deluge stats request');

        // Use IP address as identifier for non-authenticated users
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];
        let cookie = session?.cookie;

        // If no cookie exists, try to use credentials from item config
        if (!cookie) {
            try {
                const connectionDetails = getConnectionDetails(req);
                let password = connectionDetails.password;
                const host = connectionDetails.host;
                const port = connectionDetails.port;
                const ssl = connectionDetails.ssl;

                if (!password) {
                    // No password configured, return empty stats
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

                console.log('Deluge auto-login attempt');

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                    // Check if decryption failed (returns empty string)
                    if (!password) {
                        console.error('Deluge password decryption failed');
                        // Return basic stats instead of failing
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
                            },
                            decryptionError: true
                        };
                        res.status(200).json(stats);
                        return;
                    }
                }

                // Attempt to login with provided credentials
                try {
                    const loginResponse = await axios.post(`${baseUrl}`,
                        {
                            method: 'auth.login',
                            params: [password],
                            id: 1
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            timeout: 1000
                        });

                    // Store the cookie for future requests
                    if (loginResponse.data.result === true && loginResponse.headers['set-cookie']) {
                        cookie = loginResponse.headers['set-cookie'][0];
                        sessions[sessionId] = {
                            cookie,
                            expires: Date.now() + SESSION_LIFETIME,
                            host,
                            port,
                            ssl
                        };
                        console.log('Deluge auto-login successful');
                    } else {
                        console.log('Deluge login failed: Invalid credentials or response format');
                    }
                } catch (connErr: any) {
                    if (connErr.code === 'ECONNREFUSED' || connErr.code === 'ETIMEDOUT' || connErr.code === 'ECONNABORTED') {
                        console.log(`Deluge service offline: ${baseUrl}`);
                    } else {
                        console.error('Deluge auto-login error:', connErr.message);
                    }
                    // Continue without cookie - will return default stats
                }
            } catch (loginErr: any) {
                console.error('Deluge auto-login failed:', loginErr.message);
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

        try {
            // Get session status (download/upload speeds)
            const sessionResponse = await axios.post(`${baseUrl}`,
                {
                    method: 'web.update_ui',
                    params: [
                        ['download_rate', 'upload_rate'],
                        {}
                    ],
                    id: 2
                },
                {
                    headers: { Cookie: cookie },
                    timeout: 1000
                });

            // Get session totals data (total upload/download)
            let totalDownload = 0;
            let totalUpload = 0;
            try {
                const sessionStatus = await axios.post(`${baseUrl}`,
                    {
                        method: 'core.get_session_status',
                        params: [
                            ['total_upload', 'total_download', 'total_payload_upload', 'total_payload_download']
                        ],
                        id: 4
                    },
                    {
                        headers: { Cookie: cookie }
                    });

                // Extract values with fallbacks to 0
                totalDownload = sessionStatus.data.result?.total_download || 0;
                totalUpload = sessionStatus.data.result?.total_upload || 0;
            } catch (sessionErr: any) {
                console.error('Failed to get Deluge session totals:', sessionErr.message);
                // Continue with zero values if this fails
            }

            // Format response to match qBittorrent structure
            const stats = {
                dl_info_speed: sessionResponse.data.result.stats.download_rate || 0,
                up_info_speed: sessionResponse.data.result.stats.upload_rate || 0,
                dl_info_data: totalDownload,
                up_info_data: totalUpload,
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
        } catch (apiErr: any) {
            console.error('Deluge stats API error:', apiErr.message);
            if (apiErr.code === 'ECONNREFUSED' || apiErr.code === 'ETIMEDOUT' || apiErr.code === 'ECONNABORTED') {
                console.log(`Deluge service offline: ${baseUrl}`);
            }
            res.status(apiErr.response?.status || 500).json({
                error: apiErr.response?.data || 'Failed to get Deluge stats'
            });
        }
    } catch (mainErr: any) {
        console.error('Deluge stats general error:', mainErr.message);
        res.status(mainErr.response?.status || 500).json({
            error: mainErr.response?.data || 'Failed to get Deluge stats'
        });
    }
});

// Get list of all torrents
delugeRoute.get('/torrents', async (req: Request, res: Response) => {
    console.log('Deluge torrents request');
    try {
        const baseUrl = getBaseUrl(req);
        // Use IP address as identifier for non-authenticated users
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];
        let cookie = session?.cookie;

        // If no cookie exists, try to use credentials from item config
        if (!cookie) {
            try {
                const connectionDetails = getConnectionDetails(req);
                let password = connectionDetails.password;
                const host = connectionDetails.host;
                const port = connectionDetails.port;
                const ssl = connectionDetails.ssl;

                if (!password) {
                    // No password configured, return empty array
                    res.status(200).json([]);
                    return;
                }

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                    // Check if decryption failed (returns empty string)
                    if (!password) {
                        // Return empty array instead of failing
                        res.status(200).json([]);
                        return;
                    }
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(`${baseUrl}`,
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

                // Store the cookie for future requests
                if (loginResponse.data.result === true && loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = {
                        cookie,
                        expires: Date.now() + SESSION_LIFETIME,
                        host,
                        port,
                        ssl
                    };
                }
            } catch (loginError: any) {
                console.error('Deluge login attempt failed:', loginError.message);
                // Continue without cookie - will return empty array
            }
        }

        if (!cookie) {
            // If not authenticated and couldn't auto-login, return empty array
            res.status(200).json([]);
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
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];

        if (session) {
            // Call Deluge logout endpoint using the helper function
            await logoutDelugeSession(baseUrl, session.cookie);

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
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];
        let cookie = session?.cookie;
        const { hash } = req.body;

        // If no cookie exists, try to use credentials from item config
        if (!cookie) {
            try {
                const connectionDetails = getConnectionDetails(req);
                let password = connectionDetails.password;
                const host = connectionDetails.host;
                const port = connectionDetails.port;
                const ssl = connectionDetails.ssl;

                if (!password) {
                    res.status(401).json({ error: 'Not authenticated with Deluge' });
                    return;
                }

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                    // Check if decryption failed (returns empty string)
                    if (!password) {
                        res.status(400).json({
                            error: 'Failed to decrypt password. It may have been encrypted with a different key. Please update your credentials.'
                        });
                        return;
                    }
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(`${baseUrl}`,
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

                // Store the cookie for future requests
                if (loginResponse.data.result === true && loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = {
                        cookie,
                        expires: Date.now() + SESSION_LIFETIME,
                        host,
                        port,
                        ssl
                    };
                }
            } catch (loginError: any) {
                console.error('Deluge login attempt failed:', loginError.message);
                // Continue with existing cookie if available, otherwise will return an error below
            }
        }

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
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];
        let cookie = session?.cookie;
        const { hash } = req.body;

        // If no cookie exists, try to use credentials from item config
        if (!cookie) {
            try {
                const connectionDetails = getConnectionDetails(req);
                let password = connectionDetails.password;
                const host = connectionDetails.host;
                const port = connectionDetails.port;
                const ssl = connectionDetails.ssl;

                if (!password) {
                    res.status(401).json({ error: 'Not authenticated with Deluge' });
                    return;
                }

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                    // Check if decryption failed (returns empty string)
                    if (!password) {
                        res.status(400).json({
                            error: 'Failed to decrypt password. It may have been encrypted with a different key. Please update your credentials.'
                        });
                        return;
                    }
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(`${baseUrl}`,
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

                // Store the cookie for future requests
                if (loginResponse.data.result === true && loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = {
                        cookie,
                        expires: Date.now() + SESSION_LIFETIME,
                        host,
                        port,
                        ssl
                    };
                }
            } catch (loginError: any) {
                console.error('Deluge login attempt failed:', loginError.message);
                // Continue with existing cookie if available, otherwise will return an error below
            }
        }

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
        const sessionId = req.user?.username || req.ip || 'default';
        const session = sessions[sessionId];
        let cookie = session?.cookie;
        const { hash, deleteFiles } = req.body;

        // If no cookie exists, try to use credentials from item config
        if (!cookie) {
            try {
                const connectionDetails = getConnectionDetails(req);
                let password = connectionDetails.password;
                const host = connectionDetails.host;
                const port = connectionDetails.port;
                const ssl = connectionDetails.ssl;

                if (!password) {
                    res.status(401).json({ error: 'Not authenticated with Deluge' });
                    return;
                }

                // Handle encrypted password
                if (isEncrypted(password)) {
                    password = decrypt(password);
                    // Check if decryption failed (returns empty string)
                    if (!password) {
                        res.status(400).json({
                            error: 'Failed to decrypt password. It may have been encrypted with a different key. Please update your credentials.'
                        });
                        return;
                    }
                }

                // Attempt to login with provided credentials
                const loginResponse = await axios.post(`${baseUrl}`,
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

                // Store the cookie for future requests
                if (loginResponse.data.result === true && loginResponse.headers['set-cookie']) {
                    cookie = loginResponse.headers['set-cookie'][0];
                    sessions[sessionId] = {
                        cookie,
                        expires: Date.now() + SESSION_LIFETIME,
                        host,
                        port,
                        ssl
                    };
                }
            } catch (loginError: any) {
                console.error('Deluge login attempt failed:', loginError.message);
                // Continue with existing cookie if available, otherwise will return an error below
            }
        }

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
