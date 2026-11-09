import axios from 'axios';
import { execFile } from 'child_process';
import { Request, Response, Router } from 'express';
import https from 'https';
import { isIP } from 'net';
import os from 'os';

import { getOptionalUser } from '../middleware/auth.middleware';
import { isKnownHealthTarget } from '../utils/config-lookup';

export const healthRoute = Router();

// Host the frontend pings to detect internet connectivity
const INTERNET_CHECK_HOST = '8.8.8.8';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

const isValidHostname = (hostname: string): boolean => {
    if (hostname.length === 0 || hostname.length > 253) {
        return false;
    }

    if (isIP(hostname) !== 0) {
        return true;
    }

    return hostname.split('.').every((label) => (
        /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)
    ));
};

// Helper function to ping a hostname
const pingHost = (hostname: string): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!isValidHostname(hostname)) {
            resolve(false);
            return;
        }

        execFile('ping', ['-c', '1', '-W', '1', hostname], (error) => {
            resolve(!error);
        });
    });
};

healthRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    const { url, type } = req.query;

    if (!url || typeof url !== 'string') {
        res.status(400).json({ status: 'error', message: 'Invalid or missing URL' });
        return;
    }

    const checkType = type as string || 'http';

    // Only probe targets the dashboard is configured for, so this endpoint cannot be
    // used to scan the server's network. Admins may probe items they have not saved yet.
    const isInternetCheck = checkType === 'ping' && url === INTERNET_CHECK_HOST;
    if (!isInternetCheck && !isKnownHealthTarget(url) && getOptionalUser(req)?.role !== 'admin') {
        res.status(403).json({ status: 'error', message: 'Unknown health check target' });
        return;
    }

    try {
        // For ping type health checks
        if (checkType === 'ping') {
            try {
                // For ping, the URL parameter is just the hostname
                const isReachable = await pingHost(url);
                res.json({ status: isReachable ? 'online' : 'offline' });
                return;
            } catch (pingError) {
                console.log('Ping failed for', url);
                res.json({ status: 'offline' });
                return;
            }
        }

        // For HTTP health checks (default)
        const response = await axios.get(url, {
            timeout: 10000, // Increased to 10 seconds to handle slower services
            httpsAgent,
            responseType: 'text',
            validateStatus: () => true // Accept any HTTP status code
        });

        if (response.status >= 200 && response.status < 400) {
            res.json({ status: 'online' });
            return;
        }

        res.json({ status: 'offline' });
    } catch (error) {
        console.log('service is offline', req.query.url);
        res.json({ status: 'offline' });
    }
});

// Helper function to get LAN IP address
const getLanIP = (): string | null => {
    const interfaces = os.networkInterfaces();

    // Priority order: en0 (WiFi/Ethernet on macOS), eth0 (Ethernet on Linux), wlan0 (WiFi on Linux)
    const priorityInterfaces = ['en0', 'eth0', 'wlan0'];

    // First try priority interfaces
    for (const ifaceName of priorityInterfaces) {
        const iface = interfaces[ifaceName];
        if (iface) {
            for (const details of iface) {
                if (details.family === 'IPv4' && !details.internal) {
                    return details.address;
                }
            }
        }
    }

    // Fallback: find first non-internal IPv4 address
    for (const ifaceName in interfaces) {
        const iface = interfaces[ifaceName];
        if (iface) {
            for (const details of iface) {
                if (details.family === 'IPv4' && !details.internal) {
                    return details.address;
                }
            }
        }
    }

    return null;
};

// Endpoint to get both WAN and LAN IP addresses
healthRoute.get('/ip', async (req: Request, res: Response): Promise<void> => {
    try {
        // Get LAN IP synchronously
        const lanIP = getLanIP();

        // Get WAN IP asynchronously
        let wanIP: string | null = null;
        try {
            const response = await axios.get('https://api.ipify.org?format=json', {
                timeout: 5000
            });
            wanIP = response.data.ip;
        } catch (error) {
            console.error('Failed to fetch WAN IP:', error);
        }

        res.json({
            wan: wanIP,
            lan: lanIP
        });
    } catch (error) {
        console.error('Failed to fetch IP addresses:', error);
        res.status(500).json({ error: 'Failed to fetch IP addresses' });
    }
});
