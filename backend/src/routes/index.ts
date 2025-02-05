import { Router } from 'express';

import { systemRoute } from './system.route';

const router = Router();

router.use('/system', systemRoute);

export default router;
