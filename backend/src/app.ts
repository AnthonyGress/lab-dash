import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import path from 'path';

import { UPLOAD_DIRECTORY } from './constants/constants';
import { errorHandler } from './middleware/error-handler';
import { generalLimiter } from './middleware/rate-limiter';
import routes from './routes';
import { trackRequestOrigin } from './utils/request-origin';

/**
 * Builds the Express app without starting it.
 * @param rootDir Directory that holds `public/` and `node_modules/` (the entry file's directory)
 */
export const createApp = (rootDir: string): Application => {
    const app: Application = express();

    const iconsPath = path.join(rootDir, './node_modules/@loganmarchione/homelab-svg-assets/assets');
    const iconListPath = path.join(rootDir, './node_modules/@loganmarchione/homelab-svg-assets/icons.json');

    // allow running the server behind a proxy
    app.set('trust proxy', 1);

    // Middleware
    app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id']
    }));
    app.use(cookieParser());
    // Config saves and imports carry the whole dashboard, far past the 100kb default
    app.use('/api/config', express.json({ limit: '10mb' }));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Apply general rate limiter to all requests
    app.use(generalLimiter);

    // Routes
    app.use('/icon-list', express.static(iconListPath));
    app.use('/icons', express.static(iconsPath));
    app.use('/uploads', express.static(UPLOAD_DIRECTORY));
    app.use('/api', trackRequestOrigin, routes);
    app.use(express.static(path.join(rootDir, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(rootDir, 'public', 'index.html'));
    });

    // Global Error Handler
    app.use(errorHandler);

    return app;
};
