import axios from 'axios';
import { Request, Response, Router } from 'express';

export const healthRoute = Router();

healthRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        res.status(400).json({ status: 'error', message: 'Invalid or missing URL' });
        return;
    }

    try {
        const response = await axios.get(url, { timeout: 5000 });

        res.json({ status: response.status >= 200 && response.status < 400 ? 'online' : 'offline' });
    } catch (error) {
        res.json({ status: 'offline' });
    }
});
