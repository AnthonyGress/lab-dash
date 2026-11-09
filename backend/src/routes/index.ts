import { Router } from 'express';

import { appShortcutRoute } from './app-shortcut.route';
import { authRoute } from './auth.route';
import { configRoute } from './config.route';
import { healthRoute } from './health.route';
import { iconsRoute } from './icons.route';
import { jellyfinRoute } from './jellyfin.route';
import { jellyseerRoute } from './jellyseerr.route';
import { notesRoute } from './notes.route';
import { radarrRoute } from './radarr.route';
import { sonarrRoute } from './sonarr.route';
import { systemRoute } from './system.route';
import { timezoneRoute } from './timezone.route';
import { uploadsRoute } from './uploads.route';
import { weatherRoute } from './weather.route';
import { widgetsRoute } from './widgets.route';
import { itemAccess } from '../middleware/auth.middleware';
import {
    apiLimiter,
    authLimiter,
    healthLimiter,
    systemMonitorLimiter,
    timezoneApiLimiter,
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

// Integration proxy routes act with the owner's stored credentials, so every one
// sits behind itemAccess: guests may only read items that are publicly visible.

// Jellyfin routes
router.use('/jellyfin', apiLimiter, itemAccess, jellyfinRoute);

// Jellyseerr routes
router.use('/jellyseerr', apiLimiter, itemAccess, jellyseerRoute);

// Sonarr routes
router.use('/sonarr', apiLimiter, itemAccess, sonarrRoute);

// Radarr routes
router.use('/radarr', apiLimiter, itemAccess, radarrRoute);

router.use('/auth', authLimiter, authRoute);

// Unknown API paths answer as an API, not with the single-page app's HTML
router.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
});

export default router;
