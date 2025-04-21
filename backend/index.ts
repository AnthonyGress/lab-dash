import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import path from 'path';

import { UPLOAD_DIRECTORY } from './src/constants/constants';
import { errorHandler } from './src/middleware/error-handler';
import routes from './src/routes';

dotenv.config();

const app: Application = express();
const PORT = Number(process.env.PORT) || 2022;

const iconsPath = path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/assets');
const iconListPath = path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/icons.json');

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

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/qbittorrent/torrents/')) {
        console.log('DEBUG - Incoming request:', {
            method: req.method,
            path: req.path,
            headers: req.headers,
            body: req.body,
            contentType: req.headers['content-type']
        });
    }
    next();
});

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}, accessible via LAN`);
});
