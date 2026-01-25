import axios from 'axios';
import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const nzbgetRoute = Router();

// Store auth info for NZBGet sessions
interface SessionInfo {
    username: string;
    password: string;
    expires: number;
}

// Store sessions with expiration info
const sessions: Record<string, SessionInfo> = {};

// NZBGet sessions typically last for the application lifetime
const SESSION_LIFETIME = 60 * 60 * 1000; // 60 minutes in milliseconds

// Helper function to validate and get itemId
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

    const port = connectionInfo.port || '6789';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}:${port}/jsonrpc`;

    return baseUrl;
};

// Function to get credentials from item config
function getCredentials(req: Request): { username?: string; password?: string } {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    return {
        username: connectionInfo.username,
        password: connectionInfo.password
    };
}

// Function to test NZBGet connection
async function testNZBGetConnection(baseUrl: string, username?: string, password?: string): Promise<boolean> {
    try {
        // Handle encrypted password
        let decryptedPassword = password;
        if (password && isEncrypted(password)) {
            decryptedPassword = decrypt(password);
            if (!decryptedPassword) {
                console.error('NZBGet password decryption failed');
                return false;
            }
        }

        const authHeader = username && decryptedPassword ? {
            'Authorization': `Basic ${Buffer.from(`${username}:${decryptedPassword}`).toString('base64')}`
        } : {};

        const response = await axios.post(baseUrl, {
            jsonrpc: '2.0',
            method: 'version',
            id: 1
        }, {
            headers: {
                'Content-Type': 'application/json',
                ...authHeader
            },
            timeout: 10000
        });

        return response.data && response.data.result;
    } catch (error) {
        console.error('NZBGet connection test failed:', error);
        return false;
    }
}

// Make JSON-RPC request to NZBGet
async function makeNZBGetRequest(baseUrl: string, method: string, params?: any[], username?: string, password?: string): Promise<any> {
    // Handle encrypted password
    let decryptedPassword = password;
    if (password && isEncrypted(password)) {
        decryptedPassword = decrypt(password);
        if (!decryptedPassword) {
            console.error('NZBGet password decryption failed');
            decryptedPassword = undefined;
        }
    }

    const authHeader = username && decryptedPassword ? {
        'Authorization': `Basic ${Buffer.from(`${username}:${decryptedPassword}`).toString('base64')}`
    } : {};

    const response = await axios.post(baseUrl, {
        jsonrpc: '2.0',
        method: method,
        params: params || [],
        id: 1
    }, {
        headers: {
            'Content-Type': 'application/json',
            ...authHeader
        },
        timeout: 10000
    });

    if (response.data.error) {
        throw new Error(response.data.error.message || 'NZBGet API error');
    }

    return response.data.result;
}

// Function to ensure valid session
async function ensureValidSession(req: Request): Promise<{ username?: string; password?: string } | null> {
    const baseUrl = getBaseUrl(req);
    const sessionKey = req.user?.username || req.ip || 'default';
    const session = sessions[sessionKey];
    const credentials = getCredentials(req);

    // If no session exists or session expired, create new one
    if (!session || session.expires < Date.now()) {
        const cleanUsername = credentials.username && credentials.username.trim() !== '' ? credentials.username : undefined;
        const cleanPassword = credentials.password && credentials.password.trim() !== '' ? credentials.password : undefined;

        const isValid = await testNZBGetConnection(baseUrl, cleanUsername, cleanPassword);
        if (isValid) {
            sessions[sessionKey] = {
                username: cleanUsername || '',
                password: cleanPassword || '',
                expires: Date.now() + SESSION_LIFETIME
            };
            return { username: cleanUsername, password: cleanPassword };
        }
        return null;
    }

    return { username: session.username, password: session.password };
}

nzbgetRoute.post('/login', async (req: Request, res: Response) => {
    console.log('NZBGet login request');
    try {
        const itemId = validateItemId(req);
        const baseUrl = getBaseUrl(req);
        const connectionInfo = getItemConnectionInfo(itemId);

        const username = connectionInfo.username;
        const password = connectionInfo.password;

        // Handle encrypted password
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

        const isValid = await testNZBGetConnection(baseUrl, username, decryptedPassword);

        if (isValid) {
            // Store session
            const sessionKey = req.user?.username || req.ip || 'default';
            sessions[sessionKey] = {
                username: username || '',
                password: password || '',
                expires: Date.now() + SESSION_LIFETIME
            };
            res.status(200).json({ success: true });
        } else {
            res.status(401).json({ error: 'Failed to authenticate with NZBGet' });
        }
    } catch (error: any) {
        console.error('NZBGet login error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to login to NZBGet'
        });
    }
});

// Encrypt password for storage in config
nzbgetRoute.post('/encrypt-password', authenticateToken, async (req: Request, res: Response) => {
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
nzbgetRoute.get('/stats', async (req: Request, res: Response) => {
    console.log('NZBGet stats request');
    try {
        const baseUrl = getBaseUrl(req);
        const auth = await ensureValidSession(req);

        if (!auth) {
            // Return empty stats if no session
            const stats = {
                downloadSpeed: 0,
                uploadSpeed: 0,
                cumulative: {
                    downloadedBytes: 0,
                    uploadedBytes: 0
                },
                downloads: {
                    total: 0,
                    downloading: 0,
                    completed: 0,
                    paused: 0,
                    failed: 0
                }
            };
            res.status(200).json(stats);
            return;
        }

        try {
            // Get status and history
            const [status, history] = await Promise.all([
                makeNZBGetRequest(baseUrl, 'status', [], auth.username, auth.password),
                makeNZBGetRequest(baseUrl, 'history', [], auth.username, auth.password)
            ]);

            // NZBGet returns download speed in bytes/sec
            const downloadSpeed = status.DownloadRate || 0;

            // Calculate totals from history
            const monthlyBytes = status.DownloadedSizeMB ? status.DownloadedSizeMB * 1024 * 1024 : 0;

            // Count downloads by status
            const failedCount = history.filter((item: any) => item.Status === 'FAILURE' || item.Status === 'WARNING').length;

            const stats = {
                downloadSpeed: downloadSpeed,
                uploadSpeed: 0, // NZBGet doesn't upload
                cumulative: {
                    downloadedBytes: monthlyBytes,
                    uploadedBytes: 0
                },
                downloads: {
                    total: status.DownloadedFileCount || 0,
                    downloading: status.DownloadPaused ? 0 : (status.PostJobCount || 0),
                    completed: history.length - failedCount,
                    paused: status.DownloadPaused ? 1 : 0,
                    failed: failedCount
                }
            };

            res.status(200).json(stats);
        } catch (error: any) {
            console.error('NZBGet stats API error:', {
                message: error.message,
                code: error.code
            });
            // Return empty stats on error
            res.status(200).json({
                downloadSpeed: 0,
                uploadSpeed: 0,
                cumulative: {
                    downloadedBytes: 0,
                    uploadedBytes: 0
                },
                downloads: {
                    total: 0,
                    downloading: 0,
                    completed: 0,
                    paused: 0,
                    failed: 0
                }
            });
        }
    } catch (error: any) {
        console.error('NZBGet stats error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get NZBGet stats'
        });
    }
});

// Get list of all downloads
nzbgetRoute.get('/downloads', async (req: Request, res: Response) => {
    console.log('NZBGet downloads request');
    try {
        const baseUrl = getBaseUrl(req);
        const auth = await ensureValidSession(req);

        if (!auth) {
            res.status(200).json([]);
            return;
        }

        try {
            // Get status for global download speed and list of downloads
            const [status, downloads] = await Promise.all([
                makeNZBGetRequest(baseUrl, 'status', [], auth.username, auth.password),
                makeNZBGetRequest(baseUrl, 'listgroups', [], auth.username, auth.password)
            ]);

            // Get global download speed from status
            const globalDownloadSpeed = status.DownloadRate || 0;

            const formattedDownloads = downloads.map((item: any, index: number) => {
                // Calculate progress
                const totalSize = item.FileSizeMB * 1024 * 1024; // Convert MB to bytes
                const remainingSize = item.RemainingSizeMB * 1024 * 1024;
                const progress = totalSize > 0 ? (totalSize - remainingSize) / totalSize : 0;

                // Map NZBGet status to common format
                let state = 'unknown';
                if (item.Status === 'PAUSED') {
                    state = 'paused';
                } else if (item.Status === 'DOWNLOADING') {
                    state = 'downloading';
                } else if (item.Status === 'QUEUED') {
                    state = 'queued';
                } else if (item.Status === 'FETCHING') {
                    state = 'downloading';
                }

                // NZBGet typically downloads one item at a time
                // Only show download speed for the first item in "DOWNLOADING" state
                const isActiveDownload = index === 0 && (item.Status === 'DOWNLOADING' || item.Status === 'FETCHING');
                const downloadSpeed = isActiveDownload ? globalDownloadSpeed : 0;

                return {
                    hash: String(item.NZBID), // Use NZBID as hash
                    name: item.NZBName || 'Unknown',
                    state: state,
                    progress: Math.max(0, Math.min(1, progress)),
                    size: totalSize,
                    dlspeed: downloadSpeed, // Only show speed for active download
                    upspeed: 0, // NZBGet doesn't upload
                    eta: remainingSize > 0 && downloadSpeed > 0
                        ? Math.round(remainingSize / downloadSpeed)
                        : undefined
                };
            });

            res.status(200).json(formattedDownloads);
        } catch (error: any) {
            console.error('NZBGet downloads API error:', {
                message: error.message,
                code: error.code
            });
            res.status(200).json([]);
        }
    } catch (error: any) {
        console.error('NZBGet downloads error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to get NZBGet downloads'
        });
    }
});

// Pause downloads
nzbgetRoute.post('/pause', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const auth = await ensureValidSession(req);

        if (!auth) {
            res.status(401).json({ error: 'Not authenticated with NZBGet' });
            return;
        }

        const { nzbId } = req.body;

        if (nzbId) {
            // Pause specific download using editqueue with GroupPause action
            // NZBGet editqueue method signature: editqueue(Command, Offset, EditText, IDList)
            // For GroupPause, we need: "GroupPause", 0, "", [nzbId]
            const idList = [parseInt(nzbId)];
            const result = await makeNZBGetRequest(baseUrl, 'editqueue', ['GroupPause', 0, '', idList], auth.username, auth.password);
            console.log(`NZBGet pause download ${nzbId} result:`, result);
            res.status(200).json({ success: true, result });
        } else {
            // Pause entire queue
            const result = await makeNZBGetRequest(baseUrl, 'pausedownload', [], auth.username, auth.password);
            console.log('NZBGet pause all downloads result:', result);
            res.status(200).json({ success: true, result });
        }
    } catch (error: any) {
        console.error('NZBGet pause error:', error.message);
        if (error.response) {
            console.error('NZBGet pause error response:', error.response.data);
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to pause downloads'
        });
    }
});

// Resume downloads
nzbgetRoute.post('/resume', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const auth = await ensureValidSession(req);

        if (!auth) {
            res.status(401).json({ error: 'Not authenticated with NZBGet' });
            return;
        }

        const { nzbId } = req.body;

        if (nzbId) {
            // Resume specific download using editqueue with GroupResume action
            // NZBGet editqueue method signature: editqueue(Command, Offset, EditText, IDList)
            // For GroupResume, we need: "GroupResume", 0, "", [nzbId]
            const idList = [parseInt(nzbId)];
            const result = await makeNZBGetRequest(baseUrl, 'editqueue', ['GroupResume', 0, '', idList], auth.username, auth.password);
            console.log(`NZBGet resume download ${nzbId} result:`, result);
            res.status(200).json({ success: true, result });
        } else {
            // Resume entire queue
            const result = await makeNZBGetRequest(baseUrl, 'resumedownload', [], auth.username, auth.password);
            console.log('NZBGet resume all downloads result:', result);
            res.status(200).json({ success: true, result });
        }
    } catch (error: any) {
        console.error('NZBGet resume error:', error.message);
        if (error.response) {
            console.error('NZBGet resume error response:', error.response.data);
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to resume downloads'
        });
    }
});

// Delete download
nzbgetRoute.delete('/delete/:nzbId', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const auth = await ensureValidSession(req);

        if (!auth) {
            res.status(401).json({ error: 'Not authenticated with NZBGet' });
            return;
        }

        const { nzbId } = req.params;
        const deleteFiles = req.query.deleteFiles === 'true';

        // Delete the download
        // historydelete removes from history and optionally from disk
        const nzbIdNum = typeof nzbId === 'string' ? parseInt(nzbId) : parseInt(nzbId[0]);
        await makeNZBGetRequest(
            baseUrl,
            'editqueue',
            ['GroupDelete', 0, '', [nzbIdNum]],
            auth.username,
            auth.password
        );

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('NZBGet delete error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Failed to delete download'
        });
    }
});

// Logout
nzbgetRoute.post('/logout', async (req: Request, res: Response) => {
    try {
        const sessionKey = req.user?.username || req.ip || 'default';
        delete sessions[sessionKey];
        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('NZBGet logout error:', error.message);
        res.status(500).json({ error: 'Failed to logout' });
    }
});
