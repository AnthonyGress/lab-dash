import dotenv from 'dotenv';

import { createApp } from './src/app';
import { BackupService } from './src/utils/backup.service';
import { warnIfWeakSecret } from './src/utils/secret';

dotenv.config();

const app = createApp(__dirname);
const PORT = Number(process.env.PORT) || 2022;

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
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
