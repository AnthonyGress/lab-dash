import { Router } from 'express';

import appShortcutRoute from './app-shortcut.route';
import { authRoute } from './auth.route';
import { configRoute } from './config.route';
import { healthRoute } from './health.route';
import { systemRoute } from './system.route';
import { weatherRoute } from './weather.route';

const router = Router();

router.use('/config', configRoute);
router.use('/auth', authRoute);
router.use('/system', systemRoute);
router.use('/weather', weatherRoute);
router.use('/health', healthRoute);
router.use('/app-shortcut', appShortcutRoute);

export default router;
