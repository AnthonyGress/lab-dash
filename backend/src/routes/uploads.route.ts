import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

import { UPLOAD_DIRECTORY } from '../constants/constants';
import { authenticateToken } from '../middleware/auth.middleware';

export const uploadsRoute = Router();

// Get list of all uploaded images
uploadsRoute.get('/images', authenticateToken, (req: Request, res: Response) => {
    try {
        const images: Array<{
            name: string;
            path: string;
            size: number;
            uploadDate: Date;
            type: 'app-icon' | 'background' | 'other';
        }> = [];

        // Check app-icons directory
        const appIconsPath = path.join(UPLOAD_DIRECTORY, 'app-icons');
        if (fs.existsSync(appIconsPath)) {
            const appIconFiles = fs.readdirSync(appIconsPath);
            appIconFiles.forEach(file => {
                const filePath = path.join(appIconsPath, file);
                const stats = fs.statSync(filePath);

                // Only include image files
                if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)) {
                    // Extract display name by removing timestamp suffix but keeping extension
                    const fileExtension = path.extname(file);
                    const filenameWithoutExt = path.parse(file).name;
                    const nameParts = filenameWithoutExt.split('-');

                    let displayNameWithoutExt = filenameWithoutExt;

                    // Check if the last part is a timestamp (all digits)
                    if (nameParts.length > 1 && /^\d+$/.test(nameParts[nameParts.length - 1])) {
                        // Remove the timestamp part and join the rest
                        displayNameWithoutExt = nameParts.slice(0, -1).join('-');
                    }

                    // Apply the same sanitization as in app-shortcut route
                    const sanitizeFileName = (fileName: string): string => {
                        return fileName.trim();
                    };

                    const displayName = sanitizeFileName(displayNameWithoutExt) + fileExtension;

                    images.push({
                        name: displayName,
                        path: `/uploads/app-icons/${file}`,
                        size: stats.size,
                        uploadDate: stats.birthtime,
                        type: 'app-icon'
                    });
                }
            });
        }

        // Check for background images in the main uploads directory
        if (fs.existsSync(UPLOAD_DIRECTORY)) {
            const uploadFiles = fs.readdirSync(UPLOAD_DIRECTORY);
            uploadFiles.forEach(file => {
                const filePath = path.join(UPLOAD_DIRECTORY, file);
                const stats = fs.statSync(filePath);

                // Only include image files and exclude directories
                if (stats.isFile() && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)) {
                    images.push({
                        name: file,
                        path: `/uploads/${file}`,
                        size: stats.size,
                        uploadDate: stats.birthtime,
                        type: 'background' // All images in root uploads directory are background images
                    });
                }
            });
        }

        // Sort by upload date (newest first)
        images.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());

        res.json({ images });
    } catch (error) {
        console.error('Error reading uploaded images:', error);
        res.status(500).json({ message: 'Failed to retrieve uploaded images' });
    }
});

// Delete an uploaded image
uploadsRoute.delete('/images', authenticateToken, (req: Request, res: Response) => {
    try {
        const { imagePath } = req.body;

        if (!imagePath) {
            res.status(400).json({ message: 'Image path is required' });
            return;
        }

        // Validate that the path is within the uploads directory
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

        if (!fullPath.startsWith(uploadsDir)) {
            res.status(400).json({ message: 'Invalid image path' });
            return;
        }

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }

        // Delete the file
        fs.unlinkSync(fullPath);

        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ message: 'Failed to delete image' });
    }
});
