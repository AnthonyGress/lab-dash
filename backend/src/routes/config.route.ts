import { Request, Response, Router } from 'express';
import fsSync from 'fs';
import fs from 'fs/promises';
import StatusCodes from 'http-status-codes';
import path from 'path';

import {  authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { Config } from '../types';
export const configRoute = Router();

const CONFIG_FILE = path.join(__dirname, '../config/config.json');

const loadConfig = () => {
    if (fsSync.existsSync(CONFIG_FILE)) {
        return JSON.parse(fsSync.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    return { layout: { desktop: [], mobile: [] } };
};

// GET - Retrieve the saved layout JSON from disk (public access)
configRoute.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const config = loadConfig();
        console.log('loading layout');
        res.status(StatusCodes.OK).json(config);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error reading config file',
            error: (error as Error).message
        });
    }
});

// GET - Export the config file as a download (admin only)
configRoute.get('/export', [authenticateToken, requireAdmin], async (_req: Request, res: Response): Promise<void> => {
    try {
        const config = loadConfig();
        const fileName = `lab-dash-backup-${new Date().toISOString().slice(0, 10)}.json`;

        // Set headers to force download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        // Send the formatted JSON as the response
        res.status(StatusCodes.OK).send(JSON.stringify(config, null, 2));
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error exporting config file',
            error: (error as Error).message
        });
    }
});

// POST - Save the incoming JSON layout to disk (admin only)
configRoute.post('/', [authenticateToken, requireAdmin], async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('Saving config body:', req.body);

        const updates = req.body; // Get all key-value pairs from the request
        const config: Config = loadConfig(); // Load current config

        // Apply updates dynamically
        Object.keys(updates).forEach((key) => {
            if (updates[key] !== undefined) {
                (config as any)[key] = updates[key]; // Update the key dynamically
            }
        });

        // ✅ Ensure mobile layout defaults to desktop layout if not provided
        // if (updates.layout) {
        //     config.layout.desktop = updates.layout.desktop?.length ? updates.layout.desktop : config.layout.desktop;
        //     config.layout.mobile = updates.layout.mobile?.length ? updates.layout.mobile : config.layout.desktop;
        // }

        console.log('Updated Config:', JSON.stringify(config));

        // Save the updated config to file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

        res.status(StatusCodes.OK).json({ message: 'Config saved successfully', updatedConfig: config });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error saving config file',
            error: (error as Error).message
        });
    }
});
