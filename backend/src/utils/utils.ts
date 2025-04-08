import fs from 'fs';
import path from 'path';

import { UPLOAD_DIRECTORY } from '../constants/constants';

export const removeExistingFiles = (exceptFileName?: string) => {
    try {
        const files = fs.readdirSync(UPLOAD_DIRECTORY);
        files.forEach(file => {
            // If an exception filename is provided, skip that file
            if (exceptFileName && file === exceptFileName) {
                return;
            }

            const filePath = path.join(UPLOAD_DIRECTORY, file);

            // Skip directories
            if (fs.statSync(filePath).isDirectory()) {
                return;
            }

            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error('Error removing existing files:', error);
    }
};
