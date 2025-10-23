import axios from 'axios';
import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const sabnzbdRoute = Router();

// Store API keys for SABnzbd sessions
interface SessionInfo {
    apiKey: string;
    expires: number; // Timestamp when the session expires
}

// Store sessions with expiration info
const sessions: Record<string, SessionInfo> = {};

// SABnzbd API key sessions typically don't expire but we'll cache for performance
const SESSION_LIFETIME = 60 * 60 * 1000; // 1 hour in milliseconds

const getBaseUrl = (req: Request): string => {
    const itemId = req.query.itemId as string;

    if (!itemId) {
        throw new Error('itemId parameter is required');
    }

    const connectionInfo = getItemConnectionInfo(itemId);
    
    // Clean the host to remove any protocol prefix
    let host = connectionInfo.host || 'localhost';
    // Remove http:// or https:// if present
    host = host.replace(/^https?:\/\//, '');
    // Remove any trailing slashes
    host = host.replace(/\/+$/, '');
    
    const port = connectionInfo.port || '8080';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}:${port}/api`;
    return baseUrl;
};

// Function to get credentials from item config
function getCredentials(req: Request): { username?: string; password?: string; apiKey?: string } {
    const itemId = req.query.itemId as string;

    if (!itemId) {
        throw new Error('itemId parameter is required');
    }

    const connectionInfo = getItemConnectionInfo(itemId);
    return {
        username: connectionInfo.username,
        password: connectionInfo.password,
        apiKey: (connectionInfo as any).apiKey // Type assertion since apiKey might not be in the base type
    };
}

// Function to get API key (from password field or apiKey field)
function getApiKey(req: Request): string | null {
    const credentials = getCredentials(req);

    // SABnzbd uses API key authentication - can be stored in password or apiKey field
    let apiKey = credentials.apiKey || credentials.password;

    if (!apiKey) {
        return null;
    }

    // Handle encrypted API key
    if (isEncrypted(apiKey)) {
        apiKey = decrypt(apiKey);
        if (!apiKey) {
            return null;
        }
    }

    return apiKey;
}

// Function to test API key validity
async function testApiKey(baseUrl: string, apiKey: string): Promise<boolean> {
    try {
        const response = await axios.get(`${baseUrl}`, {
            params: {
                mode: 'version',
                output: 'json',
                apikey: apiKey
            },
            timeout: 5000
        });

        return response.data && response.data.version;
    } catch (error) {
        return false;
    }
}

// Function to ensure valid API key
async function ensureValidApiKey(req: Request): Promise<string | null> {
    const sessionId = req.user?.username || req.ip || 'default';
    const session = sessions[sessionId];
    const apiKey = getApiKey(req);

    if (!apiKey) {
        return null;
    }

    // If no session exists or session expired, test the API key
    if (!session || session.expires < Date.now()) {
        const baseUrl = getBaseUrl(req);
        const isValid = await testApiKey(baseUrl, apiKey);

        if (isValid) {
            // Store session with expiration
            sessions[sessionId] = {
                apiKey,
                expires: Date.now() + SESSION_LIFETIME
            };
            return apiKey;
        }
        return null;
    }

    // If session is still valid, return the API key
    return session.apiKey;
}

sabnzbdRoute.post('/login', async (req: Request, res: Response) => {
    console.log('SABnzbd login request');
    try {
        const itemId = req.query.itemId as string;

        if (!itemId) {
            res.status(400).json({ error: 'itemId parameter is required' });
            return;
        }

        const apiKey = getApiKey(req);

        if (!apiKey) {
            res.status(400).json({ error: 'API key must be configured for this item' });
            return;
        }

        const baseUrl = getBaseUrl(req);
        const isValid = await testApiKey(baseUrl, apiKey);

        if (isValid) {
            // Store session
            const sessionId = req.user?.username || req.ip || 'default';
            sessions[sessionId] = {
                apiKey,
                expires: Date.now() + SESSION_LIFETIME
            };

            res.status(200).json({ success: true, message: 'SABnzbd authentication successful' });
        } else {
            res.status(401).json({ error: 'Invalid SABnzbd API key' });
        }
    } catch (error: any) {
        console.error('SABnzbd login error:', error.message);
        res.status(500).json({ error: 'Failed to authenticate with SABnzbd' });
    }
});

// Encrypt password for storage in config
sabnzbdRoute.post('/encrypt-password', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;

        if (!password) {
            res.status(400).json({ error: 'Password (API key) is required' });
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
        console.error('SABnzbd password encryption error:', error);
        res.status(500).json({ error: 'Failed to encrypt password' });
    }
});

sabnzbdRoute.get('/stats', async (req: Request, res: Response) => {
    console.log('SABnzbd stats request');
    try {
        const apiKey = await ensureValidApiKey(req);
        if (!apiKey) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const baseUrl = getBaseUrl(req);

        // Get queue, history, and server stats
        const [queueResponse, historyResponse, serverStatsResponse] = await Promise.all([
            axios.get(`${baseUrl}`, {
                params: {
                    mode: 'queue',
                    output: 'json',
                    apikey: apiKey
                },
                timeout: 5000
            }),
            axios.get(`${baseUrl}`, {
                params: {
                    mode: 'history',
                    output: 'json',
                    limit: 50,
                    apikey: apiKey
                },
                timeout: 5000
            }),
            axios.get(`${baseUrl}`, {
                params: {
                    mode: 'server_stats',
                    output: 'json',
                    apikey: apiKey
                },
                timeout: 5000
            })
        ]);

        const queueData = queueResponse.data.queue;
        const historyData = historyResponse.data.history;
        const serverStats = serverStatsResponse.data;

        // Get monthly download total from server stats
        // SABnzbd returns monthly data directly in serverStats.month (in bytes)
        const monthlyBytes = serverStats.month || 0;

        // Calculate stats similar to torrent clients
        const stats = {
            dl_info_speed: parseFloat(queueData.kbpersec || '0') * 1024, // Convert KB/s to B/s
            dl_info_data: monthlyBytes || 0, // Monthly download total in bytes
            up_info_speed: 0, // SABnzbd doesn't upload
            up_info_data: 0, // SABnzbd doesn't upload
            downloads: {
                total: (queueData.noofslots || 0) + (historyData.total_size || 0),
                downloading: queueData.noofslots || 0,
                completed: historyData.total_size || 0,
                paused: queueData.paused ? 1 : 0,
                failed: historyData.slots ? historyData.slots.filter((item: any) => item.status === 'Failed').length : 0
            },
            // Include the raw server stats for frontend processing
            server_stats: serverStats
        };

        res.status(200).json(stats);
    } catch (error: any) {
        console.error('SABnzbd stats error:', error.message);
        res.status(500).json({ error: 'Failed to get SABnzbd statistics' });
    }
});

sabnzbdRoute.get('/downloads', async (req: Request, res: Response) => {
    console.log('SABnzbd downloads request');
    try {
        const apiKey = await ensureValidApiKey(req);
        if (!apiKey) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const baseUrl = getBaseUrl(req);

        // Get queue items
        const response = await axios.get(`${baseUrl}`, {
            params: {
                mode: 'queue',
                output: 'json',
                apikey: apiKey
            },
            timeout: 5000
        });

        const queueData = response.data.queue;

        const downloads = (queueData.slots || []).map((item: any, index: number) => {
            // Calculate progress with fallback methods
            let progress = 0;
            const percentage = parseFloat(item.percentage || '0');

            if (percentage > 0) {
                // Use percentage if available and valid
                progress = percentage / 100;
            } else {
                // Fallback: calculate from size fields
                const totalMB = parseFloat(item.mb || '0');
                const leftMB = parseFloat(item.mbleft || '0');

                // Calculate progress if we have valid size data
                if (totalMB > 0) {
                    // If mbleft is defined and valid, calculate actual progress
                    if (item.mbleft !== undefined && item.mbleft !== null && item.mbleft !== '' && !isNaN(leftMB)) {
                        progress = Math.max(0, Math.min(1, (totalMB - leftMB) / totalMB));
                        // Show actual progress only - don't add artificial 1% for queued items
                    } else {
                        // If mbleft is not available, keep progress as 0 (queued)
                        progress = 0;
                    }
                }
            }

            // SABnzb typically downloads one item at a time
            // Only show download speed for the first item in "Downloading" state
            const isActiveDownload = index === 0 && item.status && item.status.toLowerCase() === 'downloading';
            const downloadSpeed = isActiveDownload ? parseFloat(queueData.kbpersec || '0') * 1024 : 0;



            return {
                hash: item.nzo_id, // Use nzo_id as hash equivalent
                name: item.filename || 'Unknown',
                state: (item.status || 'unknown').toLowerCase(), // 'downloading', 'paused', etc.
                progress: progress,
                size: parseFloat(item.mb || '0') * 1024 * 1024, // Convert MB to bytes
                dlspeed: downloadSpeed, // Only show speed for active download
                upspeed: 0, // SABnzbd doesn't upload
                eta: parseTimeLeft(item.timeleft || '0:00:00')
            };
        });

        res.status(200).json(downloads);
    } catch (error: any) {
        console.error('SABnzbd downloads error:', error.message);
        res.status(500).json({ error: 'Failed to get SABnzbd downloads' });
    }
});

sabnzbdRoute.post('/pause/:nzoId', async (req: Request, res: Response) => {
    try {
        const apiKey = await ensureValidApiKey(req);
        if (!apiKey) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const baseUrl = getBaseUrl(req);
        const { nzoId } = req.params;

        // SABnzbd pause API - simple global pause
        const pauseResponse = await axios.get(`${baseUrl}`, {
            params: {
                mode: 'pause',
                apikey: apiKey
            },
            timeout: 5000
        });

        res.status(200).json({
            success: true,
            message: 'SABnzbd download paused'
        });
    } catch (error: any) {
        console.error('SABnzbd pause error:', error.message);
        res.status(500).json({ error: 'Failed to pause SABnzbd download' });
    }
});

sabnzbdRoute.post('/resume/:nzoId', async (req: Request, res: Response) => {
    try {
        const apiKey = await ensureValidApiKey(req);
        if (!apiKey) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const baseUrl = getBaseUrl(req);
        const { nzoId } = req.params;

        // SABnzbd resume API - simple global resume
        const resumeResponse = await axios.get(`${baseUrl}`, {
            params: {
                mode: 'resume',
                apikey: apiKey
            },
            timeout: 5000
        });

        res.status(200).json({
            success: true,
            message: 'SABnzbd download resumed'
        });
    } catch (error: any) {
        console.error('SABnzbd resume error:', error.message);
        res.status(500).json({ error: 'Failed to resume SABnzbd download' });
    }
});

sabnzbdRoute.delete('/delete/:nzoId', async (req: Request, res: Response) => {
    try {
        const apiKey = await ensureValidApiKey(req);
        if (!apiKey) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const { nzoId } = req.params;
        const deleteFiles = req.query.deleteFiles === 'true';
        const baseUrl = getBaseUrl(req);

        // Use the correct SABnzbd API format for deleting items
        await axios.get(`${baseUrl}`, {
            params: {
                mode: 'queue',
                name: 'delete',
                value: nzoId,
                del_files: deleteFiles ? '1' : '0',
                output: 'json',
                apikey: apiKey
            },
            timeout: 5000
        });

        res.status(200).json({ success: true, message: 'Download deleted successfully' });
    } catch (error: any) {
        console.error('SABnzbd delete error:', error.message);
        res.status(500).json({ error: 'Failed to delete download' });
    }
});

sabnzbdRoute.post('/logout', async (req: Request, res: Response) => {
    try {
        const sessionId = req.user?.username || req.ip || 'default';
        delete sessions[sessionId];
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
        console.error('SABnzbd logout error:', error.message);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Helper function to parse SABnzbd time format (HH:MM:SS or DD:HH:MM:SS) to seconds
function parseTimeLeft(timeStr: string): number | undefined {
    if (!timeStr || timeStr === '0:00:00') return undefined;

    const parts = timeStr.split(':');
    if (parts.length !== 3 && parts.length !== 4) return undefined;

    let totalSeconds = 0;

    if (parts.length === 3) {
        // Format: HH:MM:SS
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        totalSeconds = hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 4) {
        // Format: DD:HH:MM:SS
        const days = parseInt(parts[0]) || 0;
        const hours = parseInt(parts[1]) || 0;
        const minutes = parseInt(parts[2]) || 0;
        const seconds = parseInt(parts[3]) || 0;
        totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }

    return totalSeconds > 0 ? totalSeconds : undefined;
}
