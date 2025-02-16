import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import helmet from 'helmet';
import path from 'path';

import { errorHandler } from './src/middleware/error-handler';
import routes from './src/routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV;

const iconsPath = ENV === 'production'
    ? path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/assets')
    : path.join(__dirname, '../node_modules/@loganmarchione/homelab-svg-assets/assets');

const iconListPath = ENV === 'production'
    ? path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/icons.json')
    : path.join(__dirname, '../node_modules/@loganmarchione/homelab-svg-assets/icons.json');

console.log('Serving icons from:', iconsPath);

// Middleware
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(express.json());

// Routes
app.use('/icon-list', express.static(iconListPath));
app.use('/icons', express.static(iconsPath));
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
