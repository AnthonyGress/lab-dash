import axios from 'axios';
import { Request, Response, Router } from 'express';
import https from 'https';

import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const piholeV6Route = Router();

// Configure HTTPS agent to allow self-signed certificates for Pi-hole connections
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Allow self-signed certificates
});

// Session cache to store active SIDs and avoid creating too many sessions
interface SessionInfo {
    sid: string;
    csrf: string;
    expires: number; // Unix timestamp when this session expires
}

// Store sessions by host+password hash to reuse sessions until they expire
const sessionCache = new Map<string, SessionInfo>();

// Track request timing to prevent overwhelming Pi-hole with concurrent requests
const requestTimestamps = new Map<string, number>();

// Generate a cache key from host and password (without storing the actual password)
const getCacheKey = (baseUrl: string, password: string): string => {
    // Simple hash function - do not use the password directly as a key
    const hash = Array.from(password).reduce((h, c) =>
        (h << 5) - h + c.charCodeAt(0) | 0, 0) + baseUrl.length;
    return `${baseUrl}:${hash}`;
};

// Helper function to add a small delay between requests to the same Pi-hole instance
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

// Clean expired sessions periodically
setInterval(async () => {
    const now = Date.now();
    let expiredCount = 0;
    let logoutCount = 0;

    // Collect expired sessions
    const expiredSessions: Array<{key: string; session: SessionInfo}> = [];
    sessionCache.forEach((session, key) => {
        if (session.expires < now) {
            expiredSessions.push({ key, session });
        }
    });

    if (expiredSessions.length > 0) {
        // Process all expired sessions with proper logout
        const logoutPromises = expiredSessions.map(async ({ key, session }) => {
            try {
                // Extract baseUrl from the cache key (format: baseUrl:hash)
                const baseUrl = key.split(':')[0];
                if (baseUrl && baseUrl.startsWith('http')) {
                    const logoutSuccess = await logoutPiholeSession(baseUrl, session.sid, session.csrf);
                    if (logoutSuccess) {
                        logoutCount++;
                    }
                }

                // Remove from cache regardless of logout success
                sessionCache.delete(key);
                expiredCount++;
            } catch (error) {
                console.error('Error logging out expired session:', error);
                // Still remove the expired session from cache
                sessionCache.delete(key);
                expiredCount++;
            }
        });

        // Wait for all logout operations to complete
        await Promise.all(logoutPromises);
    }

    // Clean up old request timestamps (older than 1 hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    let cleanedTimestamps = 0;
    requestTimestamps.forEach((timestamp, key) => {
        if (timestamp < oneHourAgo) {
            requestTimestamps.delete(key);
            cleanedTimestamps++;
        }
    });

    if (expiredCount > 0 || cleanedTimestamps > 0) {
        console.log(`Pi-hole cleanup: ${expiredCount} expired sessions, ${logoutCount} successful logouts, ${cleanedTimestamps} old timestamps cleaned`);
    }
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
    
    const port = connectionInfo.port || '80';
    const ssl = connectionInfo.ssl || false;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
};

const getPassword = (req: Request): string | null => {
    const itemId = validateItemId(req);
    const connectionInfo = getItemConnectionInfo(itemId);
    let password = connectionInfo.password;

    if (!password) {
        return null;
    }

    // Handle encrypted password
    if (isEncrypted(password)) {
        password = decrypt(password);
        // Check if decryption failed (returns empty string)
        if (!password) {
            console.warn('Failed to decrypt Pi-hole password. Password may have been encrypted with a different key.');
            return '';
        }
    }

    return password;
};

/**
 * Helper function to check if an error is a connection/session related error that should trigger a retry
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

// Login to Pi-hole v6 API and get a session ID (SID), or use cached session if available
async function authenticatePihole(baseUrl: string, password: string): Promise<{ sid: string; csrf: string }> {
    // Check for a valid cached session first
    const cacheKey = getCacheKey(baseUrl, password);
    const cachedSession = sessionCache.get(cacheKey);
    const now = Date.now();

    if (cachedSession && cachedSession.expires > now) {
        // If the session is about to expire soon (within 60 seconds), don't use it
        // This gives us more buffer to avoid edge cases where sessions expire during requests
        if (cachedSession.expires - now > 60000) {
            return {
                sid: cachedSession.sid,
                csrf: cachedSession.csrf
            };
        } else {
            // Session is expiring soon, remove it from cache
            console.log('Pi-hole session expiring soon, removing from cache');
            sessionCache.delete(cacheKey);
        }
    }

    try {
        console.log(`Authenticating with Pi-hole at ${baseUrl}`);

        const response = await axios.post(
            `${baseUrl}/api/auth`,
            { password },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000, // Increased timeout for authentication
                httpsAgent: httpsAgent // Allow self-signed certificates
            }
        );

        if (response.data?.session?.valid && response.data?.session?.sid) {
            // Calculate expiration based on validity period (in seconds) returned by the API
            // Default to 1800 seconds (30 minutes) if not provided, which is Pi-hole v6's default
            const validitySeconds = response.data.session.validity || 1800;
            // Reduce the validity by 10% to ensure we refresh before actual expiration
            const adjustedValiditySeconds = Math.floor(validitySeconds * 0.9);
            const expiresAt = now + (adjustedValiditySeconds * 1000);

            console.log(`Pi-hole session created, expires in ${adjustedValiditySeconds} seconds`);

            // Store the session in cache
            const sessionInfo: SessionInfo = {
                sid: response.data.session.sid,
                csrf: response.data.session.csrf,
                expires: expiresAt
            };

            sessionCache.set(cacheKey, sessionInfo);

            return {
                sid: response.data.session.sid,
                csrf: response.data.session.csrf
            };
        }

        console.error('Pi-hole v6 auth failed: Invalid session data structure');
        console.error('Response data:', JSON.stringify(response.data, null, 2));
        throw new Error('Authentication failed: Invalid or missing session information');
    } catch (error: any) {
        console.error('Pi-hole v6 authentication error:', error.message);

        // Clear any cached session as it might be invalid
        sessionCache.delete(cacheKey);

        // Enhanced error handling for connection issues
        if (error.message?.includes('socket hang up') || error.code === 'ECONNRESET') {
            throw {
                status: 503,
                message: 'Connection to Pi-hole failed (socket hang up). The Pi-hole server may be overloaded or experiencing network issues.',
                code: 'CONNECTION_ERROR'
            };
        }

        // Check for rate limiting (429 Too Many Requests)
        if (isRateLimitError(error)) {
            throw {
                status: 429,
                message: 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.',
                code: 'TOO_MANY_REQUESTS'
            };
        }

        if (error.response?.status === 401) {
            // For 401 errors, provide a more specific error message
            const errorMessage = error.response?.data?.error?.message || 'Unauthorized';
            const errorHint = error.response?.data?.error?.hint || null;

            // Create a more informative error message
            let detailedMessage = 'Authentication failed: Invalid password';
            if (errorHint) {
                detailedMessage += ` (${errorHint})`;
            }

            throw {
                status: 401,
                message: detailedMessage,
                code: 'INVALID_PASSWORD'
            };
        }

        // Check for timeout errors
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            throw {
                status: 504,
                message: 'Authentication timeout. Pi-hole server may be slow to respond.',
                code: 'TIMEOUT_ERROR'
            };
        }

        throw {
            status: error.response?.status || 500,
            message: error.response?.data?.error?.message || error.message || 'Authentication failed',
            code: 'AUTH_ERROR'
        };
    }
}

/**
 * Helper function to handle API calls with automatic retry on connection/session errors
 * This centralizes the logic for handling expired sessions and connection issues
 */
async function handleApiWith401Retry(
    baseUrl: string,
    password: string,
    endpoint: string,
    method: 'get' | 'post' | 'delete' = 'get',
    data: any = null,
    retryAttempt = 0
): Promise<any> {
    // Maximum retry attempts to prevent infinite loops
    const MAX_RETRIES = 2;

    try {
        // Add a small delay to prevent overwhelming Pi-hole with concurrent requests
        await addRequestDelay(baseUrl);

        // First authenticate to get a session
        const authInfo = await authenticatePihole(baseUrl, password);

        // Prepare the request config with increased timeout for better reliability
        const config = {
            params: { sid: authInfo.sid },
            headers: { 'X-FTL-CSRF': authInfo.csrf, 'Content-Type': 'application/json' },
            timeout: 5000, // Increased from 2000ms to 5000ms for better reliability
            httpsAgent: httpsAgent // Allow self-signed certificates
        };

        // Make the API request based on the method
        let response;
        const url = `${baseUrl}${endpoint}`;

        if (method === 'get') {
            response = await axios.get(url, config);
        } else if (method === 'post') {
            response = await axios.post(url, data, config);
        } else if (method === 'delete') {
            response = await axios.delete(url, config);
        }

        return response;
    } catch (error: any) {
        console.error(`Pi-hole API error on ${endpoint} (attempt ${retryAttempt + 1}):`, {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            data: error.response?.data
        });

        // If this is a connection error (including socket hang up) and we haven't exceeded max retries
        if (isConnectionError(error) && retryAttempt < MAX_RETRIES) {
            console.log(`Connection error detected on ${endpoint}, clearing session and retrying...`);

            // Clear the cached session as it's likely invalid
            const cacheKey = getCacheKey(baseUrl, password);
            sessionCache.delete(cacheKey);

            // Add a longer delay before retry to give Pi-hole time to recover
            const retryDelay = Math.min(2000 + (retryAttempt * 1000), 5000); // 2s, 3s, max 5s
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            // Retry the request with a fresh authentication
            return handleApiWith401Retry(baseUrl, password, endpoint, method, data, retryAttempt + 1);
        }

        // If it's not a retryable error or we've exceeded retries, throw the error
        throw error;
    }
}

// Get Pi-hole v6 statistics
piholeV6Route.get('/stats', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const password = getPassword(req);

        if (!password) {
            res.status(400).json({
                success: false,
                code: 'PIHOLE_AUTH_ERROR',
                error: 'Password is required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        // Authenticate with Pi-hole v6
        let authInfo;
        try {
            authInfo = await authenticatePihole(baseUrl, password);
        } catch (authError: any) {
            // Check if this is a DNS resolution error
            if (isDnsResolutionError(authError)) {
                res.status(503).json({
                    success: false,
                    code: 'DNS_RESOLUTION_ERROR',
                    error: `Cannot connect to Pi-hole: DNS resolution failed for ${baseUrl}`,
                    requiresReauth: false
                });
                return;
            }

            // Check for rate limiting errors
            if (authError.code === 'TOO_MANY_REQUESTS') {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: authError.message,
                    requiresReauth: false
                });
                return;
            }

            res.status(authError.status || 401).json({
                success: false,
                code: 'PIHOLE_AUTH_ERROR',
                error: authError.message || 'Authentication failed',
                requiresReauth: true
            });
            return;
        }

        // Use the sid to fetch stats
        try {
            // Use the new helper function for the summary request with 401 retry
            const summaryResponse = await handleApiWith401Retry(
                baseUrl,
                password,
                '/api/stats/summary'
            );

            if (!summaryResponse.data) {
                throw new Error('Failed to get Pi-hole statistics');
            }

            // Extract and transform the data directly from the response
            // The v6 API might not have the expected "summary" structure, so we need to be flexible
            let apiData = summaryResponse.data;

            // If there's a summary field, use that as the base for our data
            if (apiData.summary) {
                apiData = apiData.summary;
            }

            // Now also fetch the current blocking status with 401 retry
            const blockingResponse = await handleApiWith401Retry(
                baseUrl,
                password,
                '/api/dns/blocking'
            );

            // Get blocking status and timer details
            let status = 'enabled'; // Default status
            let timerValue = null;

            if (blockingResponse.data) {
                // Check if blocking is false or the string "disabled"
                if (blockingResponse.data.blocking === false ||
                    blockingResponse.data.blocking === 'disabled' ||
                    blockingResponse.data.blocking === 'false') {
                    status = 'disabled';

                    // Check if there's a timer value for how long it's disabled
                    if (blockingResponse.data.timer !== undefined) {
                        // If timer is a number or can be converted to a number, represents remaining seconds
                        if (typeof blockingResponse.data.timer === 'number' ||
                            !isNaN(parseFloat(blockingResponse.data.timer))) {
                            // Ensure it's a number and round to avoid floating point issues
                            timerValue = Math.round(parseFloat(blockingResponse.data.timer));
                        }
                    }
                }
            }

            // Transform Pi-hole v6 format to the format our frontend expects
            let domainsBeingBlocked = 0;
            let dnsQueriesToday = 0;
            let adsBlockedToday = 0;
            let adsPercentageToday = 0;

            // Try different possible paths for these values
            // Domains being blocked
            if (apiData.gravity && typeof apiData.gravity === 'object' && apiData.gravity.domains_being_blocked !== undefined) {
                domainsBeingBlocked = apiData.gravity.domains_being_blocked;
            } else if (apiData.domains_being_blocked !== undefined) {
                domainsBeingBlocked = apiData.domains_being_blocked;
            } else if (typeof apiData.gravity === 'number') {
                domainsBeingBlocked = apiData.gravity;
            }

            // DNS queries today
            if (apiData.queries && typeof apiData.queries === 'object' && apiData.queries.total !== undefined) {
                dnsQueriesToday = apiData.queries.total;
            } else if (apiData.dns_queries_today !== undefined) {
                dnsQueriesToday = apiData.dns_queries_today;
            }

            // Ads blocked today
            if (apiData.queries && typeof apiData.queries === 'object' && apiData.queries.blocked !== undefined) {
                adsBlockedToday = apiData.queries.blocked;
            } else if (apiData.ads_blocked_today !== undefined) {
                adsBlockedToday = apiData.ads_blocked_today;
            }

            // Ads percentage today
            if (apiData.queries && typeof apiData.queries === 'object' && apiData.queries.percent_blocked !== undefined) {
                adsPercentageToday = apiData.queries.percent_blocked;
            } else if (apiData.ads_percentage_today !== undefined) {
                adsPercentageToday = apiData.ads_percentage_today;
            }

            // Create the transformed data object that matches the expected format
            const transformedData: {
                domains_being_blocked: number;
                dns_queries_today: number;
                ads_blocked_today: number;
                ads_percentage_today: number;
                status: string;
                timer?: number;
            } = {
                domains_being_blocked: domainsBeingBlocked,
                dns_queries_today: dnsQueriesToday,
                ads_blocked_today: adsBlockedToday,
                ads_percentage_today: adsPercentageToday,
                status: status
            };

            // Only include timer if it's not null
            if (timerValue !== null) {
                transformedData.timer = timerValue;
            }

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
                    error: 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.',
                    requiresReauth: false
                });
                return;
            }

            // If we get here, it's some other API error
            throw apiError;
        }
    } catch (error: any) {
        console.error('Pi-hole v6 API error:', error.message);
        console.error('Error details:', {
            status: error.response?.status,
            data: error.response?.data,
            stack: error.stack
        });

        const statusCode = error.response?.status || 500;
        let errorMessage = error.response?.data?.error?.message || error.message || 'Failed to get Pi-hole statistics';
        let errorCode = 'PIHOLE_API_ERROR';

        // Add specific handling for rate limiting
        if (statusCode === 429) {
            errorCode = 'TOO_MANY_REQUESTS';
            errorMessage = 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.';
        }

        res.status(statusCode).json({
            success: false,
            code: errorCode,
            error: errorMessage,
            requiresReauth: statusCode === 401 || statusCode === 403
        });
    }
});

// Get current Pi-hole v6 blocking status
piholeV6Route.get('/blocking-status', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const password = getPassword(req);

        if (!password) {
            res.status(400).json({
                success: false,
                code: 'PIHOLE_AUTH_ERROR',
                error: 'Password is required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        // Authenticate with Pi-hole v6
        try {
            // Use the helper function with 401 retry
            const blockingResponse = await handleApiWith401Retry(
                baseUrl,
                password,
                '/api/dns/blocking'
            );

            // Get blocking status and timer details
            let status = 'enabled'; // Default status
            let timerValue = null;

            if (blockingResponse.data) {
                // Check if blocking is false or the string "disabled"
                if (blockingResponse.data.blocking === false ||
                    blockingResponse.data.blocking === 'disabled' ||
                    blockingResponse.data.blocking === 'false') {
                    status = 'disabled';

                    // Check if there's a timer value for how long it's disabled
                    if (blockingResponse.data.timer !== undefined) {
                        // If timer is a number or can be converted to a number, represents remaining seconds
                        if (typeof blockingResponse.data.timer === 'number' ||
                            !isNaN(parseFloat(blockingResponse.data.timer))) {
                            // Ensure it's a number and round to avoid floating point issues
                            timerValue = Math.round(parseFloat(blockingResponse.data.timer));
                        }
                    }
                }
            }

            // Return only the status and timer (if exists)
            const responseData: { status: string; timer?: number } = {
                status: status
            };

            // Only include timer if it's not null
            if (timerValue !== null) {
                responseData.timer = timerValue;
            }

            res.status(200).json({
                success: true,
                data: responseData
            });
        } catch (error: any) {
            // Handle authentication errors
            if (error.code === 'INVALID_PASSWORD' || error.code === 'AUTH_ERROR' ||
                error.code === 'PIHOLE_AUTH_ERROR') {
                res.status(401).json({
                    success: false,
                    code: error.code || 'PIHOLE_AUTH_ERROR',
                    error: error.message || 'Authentication failed',
                    requiresReauth: true
                });
                return;
            }

            // Check if this is a DNS resolution error
            if (isDnsResolutionError(error)) {
                res.status(503).json({
                    success: false,
                    code: 'DNS_RESOLUTION_ERROR',
                    error: `Cannot connect to Pi-hole: DNS resolution failed for ${baseUrl}`,
                    requiresReauth: false
                });
                return;
            }

            // Check for rate limiting errors
            if (error.code === 'TOO_MANY_REQUESTS' || error.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.',
                    requiresReauth: false
                });
                return;
            }

            // For all other errors
            console.error('Pi-hole v6 blocking status error:', error.message);
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to get Pi-hole blocking status';
            const errorCode = 'PIHOLE_API_ERROR';

            res.status(statusCode).json({
                success: false,
                code: errorCode,
                error: errorMessage,
                requiresReauth: statusCode === 401 || statusCode === 403
            });
        }
    } catch (error: any) {
        console.error('Pi-hole v6 blocking status error:', error.message);
        console.error('Error details:', {
            status: error.response?.status,
            data: error.response?.data,
            stack: error.stack
        });

        const statusCode = error.response?.status || 500;
        let errorMessage = error.response?.data?.error?.message || error.message || 'Failed to get Pi-hole blocking status';
        let errorCode = 'PIHOLE_API_ERROR';

        // Add specific handling for rate limiting
        if (statusCode === 429) {
            errorCode = 'TOO_MANY_REQUESTS';
            errorMessage = 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.';
        }

        res.status(statusCode).json({
            success: false,
            code: errorCode,
            error: errorMessage,
            requiresReauth: statusCode === 401 || statusCode === 403
        });
    }
});

// Encrypt password for storage
piholeV6Route.post('/encrypt-password', async (req: Request, res: Response) => {
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

// Disable Pi-hole blocking using v6 API
piholeV6Route.post('/disable', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const password = getPassword(req);
        const seconds = req.query.seconds !== undefined ? parseInt(req.query.seconds as string) : undefined;

        if (!password) {
            res.status(400).json({
                success: false,
                code: 'PIHOLE_AUTH_ERROR',
                error: 'Password is required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        // Prepare request body: blocking: false to disable, with timer if specified
        // Use null for infinite disabling (not 0)
        const requestBody = {
            blocking: false,
            timer: seconds !== undefined ? seconds : null // null means indefinite
        };

        try {
            // Use helper function with 401 retry for disabling blocking
            const response = await handleApiWith401Retry(
                baseUrl,
                password,
                '/api/dns/blocking',
                'post',
                requestBody
            );

            if (response.data?.status === 'disabled' || response.status === 200) {
                res.status(200).json({
                    success: true,
                    message: seconds !== undefined
                        ? `Pi-hole blocking disabled for ${seconds} seconds`
                        : 'Pi-hole blocking disabled indefinitely'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to disable Pi-hole blocking'
                });
            }
        } catch (error: any) {
            // Handle authentication errors
            if (error.code === 'INVALID_PASSWORD' || error.code === 'AUTH_ERROR' ||
                error.code === 'PIHOLE_AUTH_ERROR') {
                res.status(401).json({
                    success: false,
                    code: error.code || 'PIHOLE_AUTH_ERROR',
                    error: error.message || 'Authentication failed',
                    requiresReauth: true
                });
                return;
            }

            // Check for rate limiting errors
            if (error.code === 'TOO_MANY_REQUESTS' || error.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.',
                    requiresReauth: false
                });
                return;
            }

            console.error('Pi-hole v6 disable error:', error.message);
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to disable Pi-hole blocking';

            res.status(statusCode).json({
                success: false,
                code: 'PIHOLE_API_ERROR',
                error: errorMessage,
                requiresReauth: statusCode === 401 || statusCode === 403
            });
        }
    } catch (error: any) {
        console.error('Pi-hole v6 disable error:', error.message);
        res.status(500).json({
            success: false,
            code: 'PIHOLE_API_ERROR',
            error: 'Internal server error while processing the disable request',
            requiresReauth: false
        });
    }
});

// Enable Pi-hole blocking using v6 API
piholeV6Route.post('/enable', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const password = getPassword(req);

        if (!password) {
            res.status(400).json({
                success: false,
                code: 'PIHOLE_AUTH_ERROR',
                error: 'Password is required or could not be decrypted',
                requiresReauth: true
            });
            return;
        }

        // Prepare request body: blocking: true to enable, explicitly set timer to null
        const requestBody = {
            blocking: true,
            timer: null // Explicitly clear any timer
        };

        try {
            // Use helper function with 401 retry for enabling blocking
            const response = await handleApiWith401Retry(
                baseUrl,
                password,
                '/api/dns/blocking',
                'post',
                requestBody
            );

            if (response.data?.status === 'enabled' || response.status === 200) {
                res.status(200).json({
                    success: true,
                    message: 'Pi-hole blocking enabled'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to enable Pi-hole blocking'
                });
            }
        } catch (error: any) {
            // Handle authentication errors
            if (error.code === 'INVALID_PASSWORD' || error.code === 'AUTH_ERROR' ||
                error.code === 'PIHOLE_AUTH_ERROR') {
                res.status(401).json({
                    success: false,
                    code: error.code || 'PIHOLE_AUTH_ERROR',
                    error: error.message || 'Authentication failed',
                    requiresReauth: true
                });
                return;
            }

            // Check for rate limiting errors
            if (error.code === 'TOO_MANY_REQUESTS' || error.response?.status === 429) {
                res.status(429).json({
                    success: false,
                    code: 'TOO_MANY_REQUESTS',
                    error: 'Too many requests to Pi-hole API. The default session limit is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.',
                    requiresReauth: false
                });
                return;
            }

            console.error('Pi-hole v6 enable error:', error.message);
            console.error('Enable error details:', {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to enable Pi-hole blocking';

            res.status(statusCode).json({
                success: false,
                code: 'PIHOLE_API_ERROR',
                error: errorMessage,
                requiresReauth: statusCode === 401 || statusCode === 403
            });
        }
    } catch (error: any) {
        console.error('Pi-hole v6 enable error:', error.message);
        res.status(500).json({
            success: false,
            code: 'PIHOLE_API_ERROR',
            error: 'Internal server error while processing the enable request',
            requiresReauth: false
        });
    }
});

// Helper function to logout and clear a session
async function logoutPiholeSession(baseUrl: string, sid: string, csrf: string): Promise<boolean> {
    try {
        // Validate URL before attempting to use it
        if (!baseUrl || !baseUrl.startsWith('http')) {
            console.error(`Invalid Pi-hole URL for logout: ${baseUrl}`);
            return false;
        }

        // Ensure URL is properly formatted
        const url = new URL('/api/auth', baseUrl);

        await axios.delete(url.toString(), {
            params: { sid },
            headers: {
                'X-FTL-CSRF': csrf,
                'Content-Type': 'application/json'
            },
            timeout: 1000,
            httpsAgent: httpsAgent // Allow self-signed certificates
        });

        console.log(`Successfully logged out Pi-hole session from ${baseUrl}`);
        return true;
    } catch (error: any) {
        console.error(`Pi-hole v6 logout error for ${baseUrl}:`, error.message);
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

// Add a route to explicitly logout a session
piholeV6Route.post('/logout', async (req: Request, res: Response) => {
    try {
        const baseUrl = getBaseUrl(req);
        const password = getPassword(req);

        if (!password) {
            res.status(400).json({
                success: false,
                error: 'Password is required or could not be decrypted'
            });
            return;
        }

        // Find the cached session
        const cacheKey = getCacheKey(baseUrl, password);
        const cachedSession = sessionCache.get(cacheKey);

        if (cachedSession) {
            // Attempt to logout the session
            await logoutPiholeSession(baseUrl, cachedSession.sid, cachedSession.csrf);

            // Remove from cache regardless of logout success
            sessionCache.delete(cacheKey);
        }

        res.status(200).json({
            success: true,
            message: 'Pi-hole session logged out'
        });
    } catch (error: any) {
        console.error('Pi-hole v6 logout route error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout Pi-hole session'
        });
    }
});

// Clean up all sessions when the process terminates
process.on('SIGINT', async () => {
    // Count active sessions
    const activeSessionCount = sessionCache.size;
    if (activeSessionCount === 0) {
        process.exit(0);
    }

    // Logout all active sessions
    const logoutPromises: Promise<boolean>[] = [];
    sessionCache.forEach((session, key) => {
        try {
            // Extract baseUrl from the cache key (format: baseUrl:hash)
            const baseUrl = key.split(':')[0];
            if (baseUrl && baseUrl.startsWith('http')) {
                logoutPromises.push(logoutPiholeSession(baseUrl, session.sid, session.csrf));
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
        console.error('Error during Pi-hole v6 sessions cleanup:', error);
    }

    // Clear the cache
    sessionCache.clear();
    process.exit(0);
});
