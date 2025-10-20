import axios from 'axios';
import { Request, Response, Router } from 'express';
import https from 'https';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const piholeRoute = Router();

// Configure HTTPS agent to allow self-signed certificates for Pi-hole connections
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Allow self-signed certificates
});

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
    
    const port = connectionInfo.port || '80';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
};

const getApiToken = (req: Request): string | null => {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    let apiToken = connectionInfo.apiToken;

    if (!apiToken) {
        return null;
    }

    // Handle encrypted API token
    if (isEncrypted(apiToken)) {
        apiToken = decrypt(apiToken);
        // Check if decryption failed (returns empty string)
        if (!apiToken) {
            console.error('API token decryption failed for Pi-hole');
            return null;
        }
    }

    return apiToken;
};

// Get Pi-hole statistics
piholeRoute.get('/stats', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const apiToken = getApiToken(req);

        if (!apiToken) {
            // Return empty stats instead of failing
            res.status(200).json({
                success: false,
                error: 'API token not configured or failed to decrypt'
            });
            return;
        }

        const response = await axios.get(`${baseUrl}/api.php`, {
            params: {
                summary: '',
                auth: apiToken
            },
            timeout: 5000, // 5 second timeout
            httpsAgent: httpsAgent // Allow self-signed certificates
        });

        if (!response.data || response.data.status === 'error') {
            throw new Error('Failed to get Pi-hole statistics');
        }

        // Add a call to get the domains on the blocklist (requires auth)
        try {
            const blocklistResponse = await axios.get(`${baseUrl}/api.php`, {
                params: {
                    list: 'domains',
                    auth: apiToken
                },
                timeout: 5000,
                httpsAgent: httpsAgent // Allow self-signed certificates
            });

            // Combine responses
            const combinedResponse = {
                ...response.data,
                domains_being_blocked: response.data.domains_being_blocked || blocklistResponse.data.length || 0
            };

            res.status(200).json({
                success: true,
                data: combinedResponse
            });
        } catch (blocklistError) {
            // If we can't get the blocklist, still return the summary stats
            console.error('Failed to get Pi-hole blocklist:', blocklistError);
            res.status(200).json({
                success: true,
                data: response.data
            });
        }
    } catch (error: any) {
        console.error('Pi-hole API error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Failed to get Pi-hole statistics'
        });
    }
});

// Encrypt API token for storage in config
piholeRoute.post('/encrypt-token', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { apiToken } = req.body;

        if (!apiToken) {
            res.status(400).json({ error: 'API token is required' });
            return;
        }

        // Don't re-encrypt if already encrypted
        if (isEncrypted(apiToken)) {
            res.status(200).json({ encryptedToken: apiToken });
            return;
        }

        const encryptedToken = encrypt(apiToken);
        res.status(200).json({ encryptedToken });
    } catch (error) {
        console.error('Pi-hole token encryption error:', error);
        res.status(500).json({ error: 'Failed to encrypt API token' });
    }
});

// Encrypt password for storage in config
piholeRoute.post('/encrypt-password', authenticateToken, async (req: Request, res: Response) => {
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
        console.error('Pi-hole password encryption error:', error);
        res.status(500).json({ error: 'Failed to encrypt password' });
    }
});

// Disable Pi-hole blocking (temporarily or indefinitely)
piholeRoute.post('/disable', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const apiToken = getApiToken(req);

        // Handle seconds parameter for timed disable
        const seconds = req.query.seconds !== undefined ? parseInt(req.query.seconds as string) : undefined;

        if (!apiToken) {
            res.status(400).json({
                success: false,
                error: 'API token is required or could not be decrypted'
            });
            return;
        }

        // Build the disable URL with or without seconds
        const disableUrl = seconds !== undefined
            ? `${baseUrl}/api.php?disable=${seconds}&auth=${apiToken}`
            : `${baseUrl}/api.php?disable&auth=${apiToken}`;

        // Call Pi-hole API to disable blocking
        const response = await axios.get(disableUrl, {
            timeout: 5000,
            httpsAgent: httpsAgent // Allow self-signed certificates
        });

        if (response.data.status === 'disabled') {
            res.status(200).json({
                success: true,
                message: seconds !== undefined
                    ? `Pi-hole blocking disabled for ${seconds} seconds`
                    : 'Pi-hole blocking disabled indefinitely',
                seconds
            });
        } else {
            throw new Error('Failed to disable Pi-hole blocking');
        }
    } catch (error: any) {
        console.error('Pi-hole disable error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Failed to disable Pi-hole blocking'
        });
    }
});

// Enable Pi-hole blocking
piholeRoute.post('/enable', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const apiToken = getApiToken(req);

        if (!apiToken) {
            res.status(400).json({
                success: false,
                error: 'API token is required or could not be decrypted'
            });
            return;
        }

        // Call Pi-hole API to enable blocking
        const response = await axios.get(`${baseUrl}/api.php?enable&auth=${apiToken}`, {
            timeout: 5000,
            httpsAgent: httpsAgent // Allow self-signed certificates
        });

        if (response.data.status === 'enabled') {
            res.status(200).json({
                success: true,
                message: 'Pi-hole blocking enabled'
            });
        } else {
            throw new Error('Failed to enable Pi-hole blocking');
        }
    } catch (error: any) {
        console.error('Pi-hole enable error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Failed to enable Pi-hole blocking'
        });
    }
});

piholeRoute.get('/blocking-status', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const apiToken = getApiToken(req);

        // Validate API token
        if (!apiToken) {
            res.status(400).json({
                success: false,
                error: 'API token is required'
            });
            return;
        }

        // Make the request to get the blocking status
        try {
            const result = await axios.get(`${baseUrl}/api.php`, {
                params: {
                    auth: apiToken,
                    status: ''
                },
                timeout: 5000
            });

            // Check if the result is valid
            if (result.data && typeof result.data === 'object') {
                res.status(200).json({
                    success: true,
                    data: {
                        status: result.data.status === 'enabled' ? 'enabled' : 'disabled'
                    }
                });
            } else {
                throw new Error('Invalid response from Pi-hole API');
            }
        } catch (apiError: any) {
            // Check for rate limiting in API requests
            if (apiError.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to Pi-hole API',
                    requiresReauth: false
                });
                return;
            }

            // If we get here, it's some other API error
            throw apiError;
        }
    } catch (error: any) {
        console.error('Pi-hole blocking status error:', error.message);

        const statusCode = error.response?.status || 500;
        let errorMessage = error.response?.data || error.message || 'Failed to get Pi-hole blocking status';
        let errorCode = 'PIHOLE_API_ERROR';

        // Add specific handling for rate limiting
        if (statusCode === 429) {
            errorCode = 'TOO_MANY_REQUESTS';
            errorMessage = 'Too many requests to Pi-hole API';
        }

        res.status(statusCode).json({
            success: false,
            code: errorCode,
            error: errorMessage
        });
    }
});
