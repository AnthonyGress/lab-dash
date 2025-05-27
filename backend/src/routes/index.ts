import { Router } from 'express';

import { appShortcutRoute } from './app-shortcut.route';
import { authRoute } from './auth.route';
import { configRoute } from './config.route';
import { delugeRoute } from './deluge.route';
import { healthRoute } from './health.route';
import { piholeV6Route } from './pihole-v6.route';
import { piholeRoute } from './pihole.route';
import { qbittorrentRoute } from './qbittorrent.route';
import { systemRoute } from './system.route';
import { timezoneRoute } from './timezone.route';
import { transmissionRoute } from './transmission.route';
import { uploadsRoute } from './uploads.route';
import { weatherRoute } from './weather.route';
import {
    apiLimiter,
    authLimiter,
    healthLimiter,
    systemMonitorLimiter,
    timezoneApiLimiter,
    torrentApiLimiter,
    weatherApiLimiter
} from '../middleware/rate-limiter';

const router = Router();

// Config routes should be protected by general rate limiter middleware already
router.use('/config', configRoute);

// System routes - use dedicated system monitor limiter
router.use('/system', systemMonitorLimiter, systemRoute);

// Health check route
router.use('/health', healthLimiter, healthRoute);

// Weather routes
router.use('/weather', weatherApiLimiter, weatherRoute);

// Timezone routes
router.use('/timezone', timezoneApiLimiter, timezoneRoute);

// App shortcut routes
router.use('/app-shortcut', apiLimiter, appShortcutRoute);

// Uploads management routes
router.use('/uploads', apiLimiter, uploadsRoute);

// Torrent client routes
router.use('/qbittorrent', torrentApiLimiter, qbittorrentRoute);
router.use('/transmission', torrentApiLimiter, transmissionRoute);

// Pi-hole routes
router.use('/pihole', apiLimiter, piholeRoute);

// Pi-hole v6 routes (separate to maintain backward compatibility)
router.use('/pihole/v6', apiLimiter, piholeV6Route);

// Deluge routes
router.use('/deluge', torrentApiLimiter, delugeRoute);

router.use('/auth', authLimiter, authRoute);

export default router;
