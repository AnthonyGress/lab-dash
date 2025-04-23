import { Router } from 'express';

import { appShortcutRoute } from './app-shortcut.route';
import { authRoute } from './auth.route';
import { configRoute } from './config.route';
import { delugeRoute } from './deluge.route';
import { healthRoute } from './health.route';
import { piholeRoute } from './pihole.route';
import { piholeV6Route } from './pihole-v6.route';
import { qbittorrentRoute } from './qbittorrent.route';
import { systemRoute } from './system.route';
import { weatherRoute } from './weather.route';

const router = Router();

router.use('/config', configRoute);
router.use('/auth', authRoute);
router.use('/system', systemRoute);
router.use('/weather', weatherRoute);
router.use('/health', healthRoute);
router.use('/app-shortcut', appShortcutRoute);
router.use('/qbittorrent', qbittorrentRoute);
router.use('/deluge', delugeRoute);
router.use('/pihole', piholeRoute);
router.use('/pihole/v6', piholeV6Route);

export default router;
