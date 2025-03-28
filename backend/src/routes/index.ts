import { Router } from 'express';

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

export default router;
