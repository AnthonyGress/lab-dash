import { NextFunction, Request, Response, Router } from 'express';
import fs from 'fs';
import StatusCodes from 'http-status-codes';
import multer, { StorageEngine } from 'multer';
import path from 'path';

import { getSystemInfo } from '../system-monitor';
import { CustomError } from '../types/custom-error';

export const systemRoute: Router = Router();

// Ensure the upload directory exists
const uploadDir: string = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage for file uploads
const storage: StorageEngine = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        cb(null, file.originalname);
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

systemRoute.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
    }

    res.status(StatusCodes.OK).json({
        message: 'File uploaded successfully',
        filePath: `/uploads/${req.file?.filename}`,
    });
});
