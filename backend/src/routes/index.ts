import { Router } from 'express';

import { appShortcutRoute } from './app-shortcut.route';
import { authRoute } from './auth.route';
import { configRoute } from './config.route';
import { healthRoute } from './health.route';
import { notesRoute } from './notes.route';
import { systemRoute } from './system.route';
import { timezoneRoute } from './timezone.route';
import { uploadsRoute } from './uploads.route';
import {
    apiLimiter,
    authLimiter,
    healthLimiter,
    systemMonitorLimiter,
    timezoneApiLimiter
} from '../middleware/rate-limiter';

const router = Router();

// Config routes should be protected by general rate limiter middleware already
router.use('/config', configRoute);

// System routes - use dedicated system monitor limiter
router.use('/system', systemMonitorLimiter, systemRoute);

// Health check route
router.use('/health', healthLimiter, healthRoute);

// Timezone routes
router.use('/timezone', timezoneApiLimiter, timezoneRoute);

// App shortcut routes
router.use('/app-shortcut', apiLimiter, appShortcutRoute);

// Uploads management routes
router.use('/uploads', apiLimiter, uploadsRoute);

// Notes routes
router.use('/notes', apiLimiter, notesRoute);

router.use('/auth', authLimiter, authRoute);

// Unknown API paths answer as an API, not with the single-page app's HTML
router.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
});

export default router;
