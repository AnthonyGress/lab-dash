import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import path from 'path';

import { UPLOAD_DIRECTORY } from './src/constants/constants';
import { errorHandler } from './src/middleware/error-handler';
import { authLimiter, generalLimiter } from './src/middleware/rate-limiter';
import routes from './src/routes';
import { BackupService } from './src/utils/backup.service';

dotenv.config();

const app: Application = express();
const PORT = Number(process.env.PORT) || 2022;

const iconsPath = path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/assets');
const iconListPath = path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/icons.json');

// allow running the server behind a proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiter to all requests
app.use(generalLimiter);

// Routes
app.use('/icon-list', express.static(iconListPath));
app.use('/icons', express.static(iconsPath));
app.use('/uploads', express.static(UPLOAD_DIRECTORY));
app.use('/api', routes);
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}, accessible via LAN`);

    // Initialize backup service
    try {
        const backupService = BackupService.getInstance();
        await backupService.initialize();
    } catch (error) {
        console.error('Failed to initialize backup service:', error);
    }
});
