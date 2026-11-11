import axios from 'axios';
import { Request, Response, Router } from 'express';
import os from 'os';

export const healthRoute = Router();

// Overridable so tests can answer the lookup themselves instead of reaching the internet
const WAN_IP_LOOKUP_URL = process.env.WAN_IP_LOOKUP_URL || 'https://api.ipify.org?format=json';

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
            const response = await axios.get(WAN_IP_LOOKUP_URL, {
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
