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
import { weatherRoute } from './weather.route';
import {
    apiLimiter,
    authLimiter,
    healthLimiter,
    systemMonitorLimiter,
    torrentApiLimiter,
    weatherApiLimiter
} from '../middleware/rate-limiter';

const router = Router();

// Config routes should be protected by general rate limiter middleware already
router.use('/config', configRoute);

// Auth routes with stricter rate limiting
router.use('/auth', authLimiter, authRoute);

// System monitoring routes
router.use('/system', systemMonitorLimiter, systemRoute);

// Weather routes
router.use('/weather', weatherApiLimiter, weatherRoute);

// Health check routes
router.use('/health', healthLimiter, healthRoute);

// App shortcut routes
router.use('/app-shortcut', apiLimiter, appShortcutRoute);

// Torrent client routes
router.use('/qbittorrent', torrentApiLimiter, qbittorrentRoute);
router.use('/deluge', torrentApiLimiter, delugeRoute);

// Pi-hole routes
router.use('/pihole', apiLimiter, piholeRoute);
router.use('/pihole/v6', apiLimiter, piholeV6Route);

export default router;
