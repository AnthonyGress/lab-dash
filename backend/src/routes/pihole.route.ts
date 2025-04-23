import axios from 'axios';
import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const piholeRoute = Router();

const getBaseUrl = (req: Request): string => {
    const host = req.query.host as string || 'localhost';
    const port = req.query.port as string || '80';
    const ssl = req.query.ssl === 'true';
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}/admin`;
};

const getApiToken = (req: Request): string => {
    let apiToken = req.query.apiToken as string || '';

    // Handle encrypted API token
    if (isEncrypted(apiToken)) {
        apiToken = decrypt(apiToken);
        // Check if decryption failed (returns empty string)
        if (!apiToken) {
            console.warn('Failed to decrypt Pi-hole API token. Token may have been encrypted with a different key.');
            return '';
        }
    }

    return apiToken;
};

// Get Pi-hole statistics
piholeRoute.get('/stats', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        let apiToken = req.query.apiToken as string || '';

        // Handle encrypted API token
        if (isEncrypted(apiToken)) {
            apiToken = decrypt(apiToken);
            // Check if decryption failed (returns empty string)
            if (!apiToken) {
                console.warn('Failed to decrypt Pi-hole API token. Token may have been encrypted with a different key.');
                // Return empty stats instead of failing
                res.status(200).json({
                    success: false,
                    decryptionError: true,
                    error: 'Failed to decrypt API token'
                });
                return;
            }
        }

        const response = await axios.get(`${baseUrl}/api.php`, {
            params: {
                summary: '',
                auth: apiToken
            },
            timeout: 5000 // 5 second timeout
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
                timeout: 5000
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
        const response = await axios.get(disableUrl, { timeout: 5000 });

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
        const response = await axios.get(`${baseUrl}/api.php?enable&auth=${apiToken}`, { timeout: 5000 });

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
