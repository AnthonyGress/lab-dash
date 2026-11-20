// Must stay first: .env has to be loaded before any module below reads SECRET
import 'dotenv/config';
import { createServer } from 'http';

import { createApp } from './src/app';
import { attachRealtime } from './src/realtime';
import { BackupService } from './src/utils/backup.service';
import { warnIfWeakSecret } from './src/utils/secret';

const server = createServer(createApp(__dirname));
const PORT = Number(process.env.PORT) || 2022;

// Live widget data travels over a WebSocket on the same port
attachRealtime(server);

// Start Server
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}, accessible via LAN`);
    warnIfWeakSecret();

    // Initialize backup service
    try {
        const backupService = BackupService.getInstance();
        await backupService.initialize();
    } catch (error) {
        console.error('Failed to initialize backup service:', error);
    }
});
