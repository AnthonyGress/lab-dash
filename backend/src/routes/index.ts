import { Router } from 'express';

import { healthRoute } from './health.route';
import { layoutRoute } from './layout.route';
import { systemRoute } from './system.route';
import { weatherRoute } from './weather.route';

const router = Router();

router.use('/layout', layoutRoute);
router.use('/system', systemRoute);
router.use('/weather', weatherRoute);
router.use('/health', healthRoute);

export default router;
