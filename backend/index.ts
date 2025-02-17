import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import helmet from 'helmet';
import path from 'path';

import { errorHandler } from './src/middleware/error-handler';
import routes from './src/routes';

dotenv.config();

const app: Application = express();
const PORT = Number(process.env.PORT) || 2022;

const iconsPath = path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/assets');
const iconListPath = path.join(__dirname, './node_modules/@loganmarchione/homelab-svg-assets/icons.json');


console.log('Serving icons from:', iconsPath);

// Middleware
app.use(cors());
// app.use(helmet({ crossOriginOpenerPolicy: false, hsts: false }));
app.use(express.json());

// Routes
app.use('/icon-list', express.static(iconListPath));
app.use('/icons', express.static(iconsPath));
app.use('/api', routes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}, accessible via LAN`);
});
