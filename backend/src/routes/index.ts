import { Router } from 'express';

import { layoutRoute } from './layout.route';
import { systemRoute } from './system.route';

const router = Router();

router.use('/layout', layoutRoute);
router.use('/system', systemRoute);

export default router;
