import { exec } from 'child_process';
import { NextFunction, Request, Response, Router } from 'express';
import fs from 'fs';
import StatusCodes from 'http-status-codes';
import multer, { StorageEngine } from 'multer';
import { promisify } from 'util';
import wol from 'wol';

import { UPLOAD_DIRECTORY } from '../constants/constants';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { getSystemInfo } from '../system-monitor';
import { CustomError } from '../types/custom-error';
import { removeExistingFiles } from '../utils/utils';

export const systemRoute: Router = Router();

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIRECTORY)) {
    fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
}

// Configure Multer storage for file uploads
const storage: StorageEngine = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIRECTORY);
    },
    filename: (_req, file, cb) => {
        cb(null, file.originalname.trim().replaceAll(' ', '_'));
    },
});

const upload: multer.Multer = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp'];
        console.log(file);

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new CustomError('Invalid file type. Only JPEG, PNG, and GIF are allowed.', StatusCodes.BAD_REQUEST));
        }
    },
});

const execAsync = promisify(exec);

systemRoute.get('/', async (_req: Request, res: Response) => {
    try {
        const response = await getSystemInfo();
        if (response) {
            res.json(response);
        } else {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching system info' });
        }
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Unexpected error', error });
    }
});

systemRoute.post('/upload', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
    }

    try {
        // Remove all existing files except the current uploaded file
        removeExistingFiles(req.file?.filename);

        res.status(StatusCodes.OK).json({
            message: 'File uploaded successfully',
            filePath: req.file?.originalname.trim().replaceAll(' ', '_'),
        });
    } catch (error) {
        // If there's an error after file upload, delete the uploaded file
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Error removing uploaded file:', unlinkError);
            }
        }

        next(error);
    }
});

// Clean up background images (removes all files at root level in uploads directory)
systemRoute.post('/clean-background', (req: Request, res: Response) => {
    try {
        // Remove all files in the root of uploads directory
        removeExistingFiles();

        res.status(StatusCodes.OK).json({
            message: 'Background images cleaned successfully'
        });
    } catch (error) {
        console.error('Error cleaning background images:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error cleaning background images',
            error: (error as Error).message
        });
    }
});

// Update container by pulling latest image and restarting
systemRoute.post('/update-container', [authenticateToken, requireAdmin], async (req: Request, res: Response) => {
    try {
        // Execute Docker commands
        await execAsync('docker pull ghcr.io/anthonygress/lab-dash:latest');

        // Get the current container ID
        const { stdout: containerId } = await execAsync('cat /proc/self/cgroup | grep docker | head -n 1 | sed "s/.*\\///" | cut -c 1-12');

        // Restart the container
        await execAsync(`docker restart ${containerId.trim()}`);

        res.status(StatusCodes.OK).json({ message: 'Update initiated. Container will restart shortly.' });
    } catch (error) {
        console.error('Error updating container:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: JSON.stringify(error),
            error: (error as Error).message
        });
    }
});

// Wake on LAN endpoint
systemRoute.post('/wol', authenticateToken, (req: Request, res: Response) => {
    const handleWol = async () => {
        try {
            const { mac, ip, port } = req.body;

            if (!mac) {
                res.status(StatusCodes.BAD_REQUEST).json({
                    message: 'MAC address is required'
                });
                return;
            }

            // Validate MAC address format
            const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
            if (!macRegex.test(mac)) {
                res.status(StatusCodes.BAD_REQUEST).json({
                    message: 'Invalid MAC address format. Expected format: xx:xx:xx:xx:xx:xx or xx-xx-xx-xx-xx-xx'
                });
                return;
            }

            // Set default options
            const options: { address?: string; port?: number } = {};

            // Add optional parameters if provided
            if (ip) options.address = ip;
            if (port) options.port = parseInt(port, 10);

            // Send the WOL packet
            await new Promise<void>((resolve, reject) => {
                wol.wake(mac, options, (err: Error | null) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            console.log(`Wake-on-LAN packet sent to ${mac}`);
            res.status(StatusCodes.OK).json({
                message: 'Wake-on-LAN packet sent'
            });
        } catch (error) {
            console.error('Error sending Wake-on-LAN packet:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: 'Error sending Wake-on-LAN packet',
                error: (error as Error).message
            });
        }
    };

    // Execute the async function
    handleWol();
});
