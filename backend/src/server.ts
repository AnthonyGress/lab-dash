import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import helmet from 'helmet';
import path from 'path';

import { errorHandler } from './middleware/error-handler';
import routes from './routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

const iconsPath = path.join(__dirname, '../node_modules/@loganmarchione/homelab-svg-assets/assets');
const iconListPath = path.join(__dirname, '../node_modules/@loganmarchione/homelab-svg-assets/icons.json');

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
