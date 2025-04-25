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
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        res.status(400).json({ status: 'error', message: 'Invalid or missing URL' });
        return;
    }

    try {
        // First attempt with axios
        const response = await axios.get(url, {
            timeout: 5000,
            httpsAgent,
            responseType: 'text',
            validateStatus: () => true // Accept any HTTP status code
        });

        if (response.status >= 200 && response.status < 400) {
            res.json({ status: 'online' });
            return;
        }

        // If axios doesn't return valid status, try ping as fallback
        // try {
        //     const parsedUrl = new URL(url);
        //     const isReachable = await pingHost(parsedUrl.hostname);

        //     res.json({ status: isReachable ? 'online' : 'offline' });
        // } catch (pingError) {
        //     res.json({ status: 'offline' });
        // }
    } catch (error) {
        console.log('service is offline', req.query.url);
        res.json({ status: 'offline' });
    }
});
