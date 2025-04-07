import { Request, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

import { UPLOAD_DIRECTORY } from '../constants/constants';

const router = Router();

// Helper function to sanitize filenames
const sanitizeFileName = (fileName: string): string => {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // Replace special characters and normalize spaces
    return nameWithoutExt
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, ' ')  // Replace multiple spaces/underscores/hyphens with a single space
        .trim();                   // Trim leading/trailing spaces
};

// Configure storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(UPLOAD_DIRECTORY, 'app-icons');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage });

// Upload app icon
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }

    // Sanitize the file name for display
    const sanitizedName = sanitizeFileName(req.file.originalname);

    res.status(200).json({
        message: 'App icon uploaded successfully',
        filePath: `/uploads/app-icons/${req.file.filename}`,
        name: sanitizedName, // Use sanitized name
        source: 'custom'
    });
});

export default router;
