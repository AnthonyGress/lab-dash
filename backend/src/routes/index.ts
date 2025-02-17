import { Router } from 'express';

import { layoutRoute } from './layout.route';
import { systemRoute } from './system.route';
import { weatherRoute } from './weather.route';

const router = Router();

router.use('/layout', layoutRoute);
router.use('/system', systemRoute);
router.use('/weather', weatherRoute);

export default router;
