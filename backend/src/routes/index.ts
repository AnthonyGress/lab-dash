import { Router } from 'express';

import { adguardRoute } from './adguard.route';
import { appShortcutRoute } from './app-shortcut.route';
import { authRoute } from './auth.route';
import { configRoute } from './config.route';
import { delugeRoute } from './deluge.route';
import { healthRoute } from './health.route';
import { iconsRoute } from './icons.route';
import { jellyfinRoute } from './jellyfin.route';
import { jellyseerRoute } from './jellyseerr.route';
import { notesRoute } from './notes.route';
import { nzbgetRoute } from './nzbget.route';
import { piholeV6Route } from './pihole-v6.route';
import { piholeRoute } from './pihole.route';
import { qbittorrentRoute } from './qbittorrent.route';
import { radarrRoute } from './radarr.route';
import { sabnzbdRoute } from './sabnzbd.route';
import { sonarrRoute } from './sonarr.route';
import { systemRoute } from './system.route';
import { timezoneRoute } from './timezone.route';
import { transmissionRoute } from './transmission.route';
import { uploadsRoute } from './uploads.route';
import { weatherRoute } from './weather.route';
import { widgetsRoute } from './widgets.route';
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

// Bulk loading routes for performance optimization
router.use('/icons', apiLimiter, iconsRoute);
router.use('/widgets', apiLimiter, widgetsRoute);

// Notes routes
router.use('/notes', apiLimiter, notesRoute);

// Torrent client routes
router.use('/qbittorrent', torrentApiLimiter, qbittorrentRoute);
router.use('/transmission', torrentApiLimiter, transmissionRoute);

// NZB client routes
router.use('/sabnzbd', torrentApiLimiter, sabnzbdRoute);
router.use('/nzbget', torrentApiLimiter, nzbgetRoute);

// Pi-hole routes
router.use('/pihole', apiLimiter, piholeRoute);

// Pi-hole v6 routes (separate to maintain backward compatibility)
router.use('/pihole/v6', apiLimiter, piholeV6Route);

// AdGuard Home routes
router.use('/adguard', apiLimiter, adguardRoute);

// Deluge routes
router.use('/deluge', torrentApiLimiter, delugeRoute);

// Jellyfin routes
router.use('/jellyfin', apiLimiter, jellyfinRoute);

// Jellyseerr routes
router.use('/jellyseerr', apiLimiter, jellyseerRoute);

// Sonarr routes
router.use('/sonarr', apiLimiter, sonarrRoute);

// Radarr routes
router.use('/radarr', apiLimiter, radarrRoute);

router.use('/auth', authLimiter, authRoute);

export default router;
