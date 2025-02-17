import { Request, Response, Router } from 'express';
import fs from 'fs/promises';
import StatusCodes from 'http-status-codes';
import path from 'path';

export const layoutRoute = Router();

const CONFIG_FILE = path.join(__dirname, '../config/config.json');

// GET - Retrieve the saved layout JSON from disk
layoutRoute.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        const layout = JSON.parse(data);
        res.status(StatusCodes.OK).json(layout.layout);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error reading layout file',
            error: (error as Error).message
        });
    }
});

// POST - Save the incoming JSON layout to disk
layoutRoute.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const layout = req.body;

        if (!layout || typeof layout !== 'object') {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid layout data' });
            return;
        }
        // TODO: write only layout section
        await fs.writeFile(CONFIG_FILE, JSON.stringify({ layout: layout }, null, 2), 'utf-8');
        res.status(StatusCodes.OK).json({ message: 'Layout saved successfully' });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error saving layout file',
            error: (error as Error).message
        });
    }
});
