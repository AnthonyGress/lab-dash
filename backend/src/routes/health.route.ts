import axios from 'axios';
import { Request, Response, Router } from 'express';
import https from 'https';

export const healthRoute = Router();

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

healthRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        res.status(400).json({ status: 'error', message: 'Invalid or missing URL' });
        return;
    }

    try {
        const response = await axios.get(url, {
            timeout: 5000,
            httpsAgent,
            responseType: 'text',
            validateStatus: () => true // Accept any HTTP status code
        });

        // Check for meta refresh tags in response regardless of content type
        if (typeof response.data === 'string' && (
            response.data.includes('<meta http-equiv="refresh"') ||
            response.data.includes('<meta http-equiv=\'refresh\'') ||
            response.data.includes('<meta http-equiv=refresh')
        )) {
            res.json({ status: 'online' });
            return;
        }

        res.json({ status: response.status >= 200 && response.status < 400 ? 'online' : 'offline' });
    } catch (error) {
        res.json({ status: 'offline' });
    }
});
