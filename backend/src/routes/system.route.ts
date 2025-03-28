import { NextFunction, Request, Response, Router } from 'express';
import fs from 'fs';
import StatusCodes from 'http-status-codes';
import multer, { StorageEngine } from 'multer';
import path from 'path';

import { UPLOAD_DIRECTORY } from '../constants/constants';
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
