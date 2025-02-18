import { Request, Response, Router } from 'express';
import fsSync from 'fs';
import fs from 'fs/promises';
import StatusCodes from 'http-status-codes';
import path from 'path';

export const layoutRoute = Router();

const CONFIG_FILE = path.join(__dirname, '../config/config.json');

const loadConfig = () => {
    if (fsSync.existsSync(CONFIG_FILE)) {
        return JSON.parse(fsSync.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    return { layout: { desktop: [], mobile: [] } };
};

// GET - Retrieve the saved layout JSON from disk
layoutRoute.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const config = loadConfig();
        console.log('loading layout', config);

        res.status(StatusCodes.OK).json(config.layout);
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
        console.log('saving layout body', req.body);

        const { desktop, mobile } = req.body;
        const config = loadConfig();

        console.log('config', config);
        config.layout.desktop = desktop && desktop.length > 0 ? desktop : config.layout.desktop;
        config.layout.mobile = mobile && mobile.length > 0 ? mobile : desktop;
        console.log('config2', config);


        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        res.status(StatusCodes.OK).json({ message: 'Layout saved successfully' });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error saving layout file',
            error: (error as Error).message
        });
    }
});
