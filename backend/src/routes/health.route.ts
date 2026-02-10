import axios from 'axios';
import { exec } from 'child_process';
import { Request, Response, Router } from 'express';
import https from 'https';
import os from 'os';

export const healthRoute = Router();

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

// Helper function to ping a hostname
const pingHost = (hostname: string): Promise<boolean> => {
    return new Promise((resolve) => {
        exec(`ping -c 1 -W 1 ${hostname}`, (error) => {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
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
