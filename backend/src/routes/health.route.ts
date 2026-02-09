import axios from 'axios';
import { exec } from 'child_process';
import { Request, Response, Router } from 'express';
import https from 'https';
import { URL } from 'url';

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

// Endpoint to get public IP address
healthRoute.get('/public-ip', async (req: Request, res: Response): Promise<void> => {
    try {
        const response = await axios.get('https://api.ipify.org?format=json', {
            timeout: 5000
        });
        res.json({ ip: response.data.ip });
    } catch (error) {
        console.error('Failed to fetch public IP:', error);
        res.status(500).json({ error: 'Failed to fetch public IP' });
    }
});
