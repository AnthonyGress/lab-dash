import axios from 'axios';
import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const adguardRoute = Router();

// Track request timing to prevent overwhelming AdGuard Home with concurrent requests
const requestTimestamps = new Map<string, number>();

// Helper function to add a small delay between requests to the same AdGuard Home instance
const addRequestDelay = async (baseUrl: string): Promise<void> => {
    const lastRequestTime = requestTimestamps.get(baseUrl) || 0;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    // If the last request was less than 100ms ago, add a small delay
    if (timeSinceLastRequest < 100) {
        const delay = 100 - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Update the timestamp
    requestTimestamps.set(baseUrl, Date.now());
};

// Clean old request timestamps periodically
setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    let cleanedTimestamps = 0;
    requestTimestamps.forEach((timestamp, key) => {
        if (timestamp < oneHourAgo) {
            requestTimestamps.delete(key);
            cleanedTimestamps++;
        }
    });

    // Cleanup completed
}, 60000); // Check every minute

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
    
    const port = connectionInfo.port || '3000';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
};

const getCredentials = (req: Request): { username: string; password: string } | null => {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);

    let username = connectionInfo.username;
    let password = connectionInfo.password;

    if (!username || !password) {
        return null;
    }

    // Handle encrypted credentials
    if (isEncrypted(username)) {
        username = decrypt(username);
        if (!username) {
            console.warn('Failed to decrypt AdGuard username. Username may have been encrypted with a different key.');
            return null;
        }
    }

    if (isEncrypted(password)) {
        password = decrypt(password);
        if (!password) {
            console.warn('Failed to decrypt AdGuard password. Password may have been encrypted with a different key.');
            return null;
        }
    }

    return { username, password };
};

/**
 * Helper function to check if an error is a connection/network related error that should trigger a retry
 */
const isConnectionError = (error: any): boolean => {
    return error.code === 'ECONNRESET' ||
           error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('socket hang up') ||
           error.message?.includes('ECONNRESET') ||
           error.message?.includes('ECONNABORTED') ||
           error.message?.includes('timeout') ||
           error.response?.status === 401 ||
           error.response?.status === 403;
};

/**
 * Helper function to check if an error is a DNS resolution error
 */
const isDnsResolutionError = (error: any): boolean => {
    return error.code === 'ENOTFOUND' ||
           error.code === 'EAI_AGAIN' ||
           error.message?.includes('getaddrinfo') ||
           error.message?.includes('ENOTFOUND') ||
           error.message?.includes('EAI_AGAIN');
};

/**
 * Helper function to check if an error is a rate limiting error (429 Too Many Requests)
 */
const isRateLimitError = (error: any): boolean => {
    return error.response?.status === 429 ||
           error.message?.includes('429') ||
           error.message?.toLowerCase().includes('too many requests');
};

/**
 * Helper function to handle API calls with automatic retry on connection/network errors
 * This centralizes the logic for handling authentication and connection issues
 */
async function handleApiWithRetry(
    baseUrl: string,
    username: string,
    password: string,
    endpoint: string,
    method: 'get' | 'post' = 'get',
    data: any = null,
    retryAttempt = 0
): Promise<any> {
    // Maximum retry attempts to prevent infinite loops
    const MAX_RETRIES = 2;

    try {
        // Add a small delay to prevent overwhelming AdGuard Home with concurrent requests
        await addRequestDelay(baseUrl);

        // Prepare the request config with Basic Auth
        const config = {
            auth: {
                username: username,
                password: password
            },
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000 // 5 second timeout for better reliability
        };

        // Make the API request based on the method
        let response;
        const url = `${baseUrl}${endpoint}`;

        if (method === 'get') {
            response = await axios.get(url, config);
        } else if (method === 'post') {
            response = await axios.post(url, data, config);
        }

        return response;
    } catch (error: any) {
        // If this is a connection error and we haven't exceeded max retries
        if (isConnectionError(error) && retryAttempt < MAX_RETRIES) {
            // Add a longer delay before retry to give AdGuard Home time to recover
            const retryDelay = Math.min(2000 + (retryAttempt * 1000), 5000); // 2s, 3s, max 5s
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            // Retry the request
            return handleApiWithRetry(baseUrl, username, password, endpoint, method, data, retryAttempt + 1);
        }

        // If it's not a retryable error or we've exceeded retries, throw the error
        throw error;
    }
}

// Get AdGuard Home statistics
adguardRoute.get('/stats', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const credentials = getCredentials(req);

        if (!credentials) {
            res.status(400).json({
                success: false,
                code: 'ADGUARD_AUTH_ERROR',
                error: 'Username and password are required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        try {
            // Fetch both status and stats from AdGuard Home
            const [statusResponse, statsResponse] = await Promise.all([
                handleApiWithRetry(
                    baseUrl,
                    credentials.username,
                    credentials.password,
                    '/control/status'
                ),
                handleApiWithRetry(
                    baseUrl,
                    credentials.username,
                    credentials.password,
                    '/control/stats'
                )
            ]);



            if (!statusResponse.data || !statsResponse.data) {
                throw new Error('Failed to get AdGuard Home statistics');
            }

            const statusData = statusResponse.data;
            const statsData = statsResponse.data;



            // Calculate today's stats from AdGuard Home time-series data
            let dnsQueriesToday = 0;
            let blockedToday = 0;

            // AdGuard Home returns time-series data in arrays
            if (statsData.time_units && statsData.time_units === 'hours' && statsData.dns_queries && statsData.blocked_filtering) {
                // For hourly data, sum up the last 24 hours
                const hours = Math.min(24, statsData.dns_queries.length);
                for (let i = 0; i < hours; i++) {
                    dnsQueriesToday += statsData.dns_queries[i] || 0;
                    blockedToday += statsData.blocked_filtering[i] || 0;
                }
            } else if (statsData.time_units && statsData.time_units === 'days' && statsData.dns_queries && statsData.blocked_filtering) {
                // For daily data, take the first entry (today)
                dnsQueriesToday = statsData.dns_queries[0] || 0;
                blockedToday = statsData.blocked_filtering[0] || 0;
            } else {
                // Fallback to legacy format if available
                dnsQueriesToday = statsData.num_dns_queries || 0;
                blockedToday = statsData.num_blocked_filtering || 0;
            }

            // Calculate percentage
            const blockPercentage = dnsQueriesToday > 0 ? ((blockedToday / dnsQueriesToday) * 100) : 0;

            // Transform AdGuard Home format to the format our frontend expects (similar to Pi-hole)
            const transformedData = {
                domains_being_blocked: statusData.num_blocked_filtering || 0,
                dns_queries_today: dnsQueriesToday,
                ads_blocked_today: blockedToday,
                ads_percentage_today: Math.round(blockPercentage * 10) / 10, // Round to 1 decimal place
                status: statusData.protection_enabled ? 'enabled' : 'disabled'
            };



            res.status(200).json({
                success: true,
                data: transformedData
            });
        } catch (apiError: any) {
            // Check for rate limiting in API requests
            if (apiError.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to AdGuard Home API.',
                    requiresReauth: false
                });
                return;
            }

            // If we get here, it's some other API error
            throw apiError;
        }
    } catch (error: any) {
        console.error('AdGuard Home API error:', error.message);

        // Check if this is a DNS resolution error
        if (isDnsResolutionError(error)) {
            res.status(503).json({
                success: false,
                code: 'DNS_RESOLUTION_ERROR',
                error: 'Cannot connect to AdGuard Home: DNS resolution failed',
                requiresReauth: false
            });
            return;
        }

        const statusCode = error.response?.status || 500;
        let errorMessage = error.response?.data?.message || error.message || 'Failed to get AdGuard Home statistics';
        let errorCode = 'ADGUARD_API_ERROR';

        // Add specific handling for rate limiting
        if (statusCode === 429) {
            errorCode = 'TOO_MANY_REQUESTS';
            errorMessage = 'Too many requests to AdGuard Home API.';
        }

        res.status(statusCode).json({
            success: false,
            code: errorCode,
            error: errorMessage,
            requiresReauth: statusCode === 401 || statusCode === 403
        });
    }
});

// Get current AdGuard Home protection status
adguardRoute.get('/protection-status', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const credentials = getCredentials(req);

        if (!credentials) {
            res.status(400).json({
                success: false,
                code: 'ADGUARD_AUTH_ERROR',
                error: 'Username and password are required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        try {
            // Use the helper function with retry
            const statusResponse = await handleApiWithRetry(
                baseUrl,
                credentials.username,
                credentials.password,
                '/control/status'
            );

            const status = statusResponse.data.protection_enabled ? 'enabled' : 'disabled';

            res.status(200).json({
                success: true,
                data: { status }
            });
        } catch (error: any) {
            // Handle authentication errors
            if (error.response?.status === 401 || error.response?.status === 403) {
                res.status(401).json({
                    success: false,
                    code: 'ADGUARD_AUTH_ERROR',
                    error: 'Authentication failed',
                    requiresReauth: true
                });
                return;
            }

            // Check if this is a DNS resolution error
            if (isDnsResolutionError(error)) {
                res.status(503).json({
                    success: false,
                    code: 'DNS_RESOLUTION_ERROR',
                    error: 'Cannot connect to AdGuard Home: DNS resolution failed',
                    requiresReauth: false
                });
                return;
            }

            // Check for rate limiting errors
            if (error.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to AdGuard Home API.',
                    requiresReauth: false
                });
                return;
            }

            // For all other errors
            console.error('AdGuard Home protection status error:', error.message);
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.message || error.message || 'Failed to get AdGuard Home protection status';
            const errorCode = 'ADGUARD_API_ERROR';

            res.status(statusCode).json({
                success: false,
                code: errorCode,
                error: errorMessage,
                requiresReauth: statusCode === 401 || statusCode === 403
            });
        }
    } catch (error: any) {
        console.error('AdGuard Home protection status error:', error.message);

        const statusCode = error.response?.status || 500;
        let errorMessage = error.response?.data?.message || error.message || 'Failed to get AdGuard Home protection status';
        let errorCode = 'ADGUARD_API_ERROR';

        // Add specific handling for rate limiting
        if (statusCode === 429) {
            errorCode = 'TOO_MANY_REQUESTS';
            errorMessage = 'Too many requests to AdGuard Home API.';
        }

        res.status(statusCode).json({
            success: false,
            code: errorCode,
            error: errorMessage,
            requiresReauth: statusCode === 401 || statusCode === 403
        });
    }
});

// Encrypt username for storage
adguardRoute.post('/encrypt-username', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { username } = req.body;

        if (!username) {
            res.status(400).json({ error: 'Username is required' });
            return;
        }

        // Don't re-encrypt if already encrypted
        if (isEncrypted(username)) {
            res.status(200).json({ encryptedUsername: username });
            return;
        }

        const encryptedUsername = encrypt(username);
        res.status(200).json({ encryptedUsername });
    } catch (error) {
        console.error('AdGuard username encryption error:', error);
        res.status(500).json({ error: 'Failed to encrypt username' });
    }
});

// Encrypt password for storage
adguardRoute.post('/encrypt-password', authenticateToken, async (req: Request, res: Response) => {
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
        console.error('AdGuard password encryption error:', error);
        res.status(500).json({ error: 'Failed to encrypt password' });
    }
});

// Disable AdGuard Home protection (temporarily or indefinitely)
adguardRoute.post('/disable', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const credentials = getCredentials(req);
        const seconds = req.query.seconds !== undefined ? parseInt(req.query.seconds as string) : undefined;

        if (!credentials) {
            res.status(400).json({
                success: false,
                code: 'ADGUARD_AUTH_ERROR',
                error: 'Username and password are required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        // Prepare request body: enabled: false to disable protection
        // Note: AdGuard Home doesn't have built-in timer functionality like Pi-hole
        // The timer will be handled by the frontend for consistency with Pi-hole
        const requestBody = {
            enabled: false
        };

        try {
            // Use helper function with retry for disabling protection
            const response = await handleApiWithRetry(
                baseUrl,
                credentials.username,
                credentials.password,
                '/control/protection',
                'post',
                requestBody
            );

            if (response.status === 200) {
                res.status(200).json({
                    success: true,
                    message: seconds !== undefined
                        ? `AdGuard Home protection disabled for ${seconds} seconds`
                        : 'AdGuard Home protection disabled indefinitely'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to disable AdGuard Home protection'
                });
            }
        } catch (error: any) {
            // Handle authentication errors
            if (error.response?.status === 401 || error.response?.status === 403) {
                res.status(401).json({
                    success: false,
                    code: 'ADGUARD_AUTH_ERROR',
                    error: 'Authentication failed',
                    requiresReauth: true
                });
                return;
            }

            // Check for rate limiting errors
            if (error.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to AdGuard Home API.',
                    requiresReauth: false
                });
                return;
            }

            console.error('AdGuard Home disable error:', error.message);

            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.message || error.message || 'Failed to disable AdGuard Home protection';

            res.status(statusCode).json({
                success: false,
                code: 'ADGUARD_API_ERROR',
                error: errorMessage,
                requiresReauth: statusCode === 401 || statusCode === 403
            });
        }
    } catch (error: any) {
        console.error('AdGuard Home disable error:', error.message);
        res.status(500).json({
            success: false,
            code: 'ADGUARD_API_ERROR',
            error: 'Internal server error while processing the disable request',
            requiresReauth: false
        });
    }
});

// Enable AdGuard Home protection
adguardRoute.post('/enable', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const credentials = getCredentials(req);

        if (!credentials) {
            res.status(400).json({
                success: false,
                code: 'ADGUARD_AUTH_ERROR',
                error: 'Username and password are required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        // Prepare request body: protection_enabled: true to enable
        const requestBody = {
            protection_enabled: true
        };

        try {
            // Use helper function with retry for enabling protection
            const response = await handleApiWithRetry(
                baseUrl,
                credentials.username,
                credentials.password,
                '/control/dns_config',
                'post',
                requestBody
            );

            if (response.status === 200) {
                res.status(200).json({
                    success: true,
                    message: 'AdGuard Home protection enabled'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to enable AdGuard Home protection'
                });
            }
        } catch (error: any) {
            // Handle authentication errors
            if (error.response?.status === 401 || error.response?.status === 403) {
                res.status(401).json({
                    success: false,
                    code: 'ADGUARD_AUTH_ERROR',
                    error: 'Authentication failed',
                    requiresReauth: true
                });
                return;
            }

            // Check for rate limiting errors
            if (error.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to AdGuard Home API.',
                    requiresReauth: false
                });
                return;
            }

            console.error('AdGuard Home enable error:', error.message);

            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.message || error.message || 'Failed to enable AdGuard Home protection';

            res.status(statusCode).json({
                success: false,
                code: 'ADGUARD_API_ERROR',
                error: errorMessage,
                requiresReauth: statusCode === 401 || statusCode === 403
            });
        }
    } catch (error: any) {
        console.error('AdGuard Home enable error:', error.message);
        res.status(500).json({
            success: false,
            code: 'ADGUARD_API_ERROR',
            error: 'Internal server error while processing the enable request',
            requiresReauth: false
        });
    }
});
