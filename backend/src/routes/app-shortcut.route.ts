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
        // Get the original filename without extension
        const originalName = path.parse(file.originalname).name;

        // Sanitize the filename (remove special characters)
        const sanitizedName = originalName
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .trim();

        // Add a timestamp prefix to ensure uniqueness
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);

        // Final format: sanitizedOriginalName-timestamp.ext
        cb(null, `${sanitizedName}-${timestamp}${ext}`);
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

    console.log('File uploaded successfully:', {
        originalName: req.file.originalname,
        sanitizedName,
        filename: req.file.filename,
        path: req.file.path
    });

    res.status(200).json({
        message: 'App icon uploaded successfully',
        filePath: `/uploads/app-icons/${req.file.filename}`,
        name: sanitizedName, // Use sanitized name
        source: 'custom'
    });
});

// Get list of custom app icons
router.get('/custom-icons', (req: Request, res: Response) => {
    try {
        const uploadPath = path.join(UPLOAD_DIRECTORY, 'app-icons');

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
            res.json({ icons: [] });
            return;
        }

        // Read the directory
        const files = fs.readdirSync(uploadPath);

        // Map files to icon objects
        const icons = files.map(file => {
            // Get the file name without extension
            const filenameWithoutExt = path.parse(file).name;

            // Extract the original name part (everything before the timestamp)
            // Format is: sanitizedName-timestamp
            const nameParts = filenameWithoutExt.split('-');

            // If the filename has our expected format with a timestamp suffix,
            // remove the timestamp; otherwise keep the full name
            let displayName = filenameWithoutExt;

            // Check if the last part is a timestamp (all digits)
            if (nameParts.length > 1 && /^\d+$/.test(nameParts[nameParts.length - 1])) {
                // Remove the timestamp part and join the rest
                displayName = nameParts.slice(0, -1).join('-');
            }

            // Ensure the display name is sanitized
            displayName = sanitizeFileName(displayName);

            // Create the icon object
            return {
                name: displayName,
                path: `/uploads/app-icons/${file}`,
                source: 'custom'
            };
        });

        res.json({ icons });
    } catch (error) {
        console.error('Error reading custom icons:', error);
        res.status(500).json({ message: 'Failed to retrieve custom icons' });
    }
});

export default router;
