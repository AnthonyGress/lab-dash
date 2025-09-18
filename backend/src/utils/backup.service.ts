import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

import { Config } from '../types';

const CONFIG_FILE = path.join(__dirname, '../config/config.json');
const BACKUP_DIR = path.join(__dirname, '../config/backups');
const BACKUP_FILE = path.join(BACKUP_DIR, 'config-weekly-backup.json');
const BACKUP_METADATA_FILE = path.join(BACKUP_DIR, 'backup-metadata.json');

interface BackupMetadata {
    lastBackupTime: number;
    nextBackupTime: number;
    backupIntervalMs: number;
}

export class BackupService {
    private static instance: BackupService;
    private backupIntervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
    private intervalId: ReturnType<typeof setInterval> | null = null;

    private constructor() {}

    public static getInstance(): BackupService {
        if (!BackupService.instance) {
            BackupService.instance = new BackupService();
        }
        return BackupService.instance;
    }

    /**
     * Initialize the backup service and start the weekly backup schedule
     */
    public async initialize(): Promise<void> {
        try {
            // Ensure backup directory exists
            await this.ensureBackupDirectory();

            // Check if we need to perform an immediate backup
            const shouldBackup = await this.shouldPerformBackup();
            if (shouldBackup) {
                await this.performBackup();
            }

            // Start the periodic backup schedule
            this.startBackupSchedule();

            console.log('Backup service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize backup service:', error);
        }
    }

    /**
     * Stop the backup service
     */
    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Backup service stopped');
        }
    }

    /**
     * Ensure the backup directory exists
     */
    private async ensureBackupDirectory(): Promise<void> {
        try {
            await fsPromises.access(BACKUP_DIR);
        } catch {
            await fsPromises.mkdir(BACKUP_DIR, { recursive: true });
            console.log('Created backup directory:', BACKUP_DIR);
        }
    }

    /**
     * Check if a backup should be performed based on the last backup time
     */
    private async shouldPerformBackup(): Promise<boolean> {
        try {
            const metadata = await this.loadBackupMetadata();
            const currentTime = Date.now();

            // If no previous backup or it's been more than a week, perform backup
            return !metadata.lastBackupTime || (currentTime >= metadata.nextBackupTime);
        } catch {
            // If metadata doesn't exist, we should perform a backup
            return true;
        }
    }

    /**
     * Load backup metadata
     */
    private async loadBackupMetadata(): Promise<BackupMetadata> {
        try {
            const metadataContent = await fsPromises.readFile(BACKUP_METADATA_FILE, 'utf-8');
            return JSON.parse(metadataContent);
        } catch {
            // Return default metadata if file doesn't exist
            const currentTime = Date.now();
            return {
                lastBackupTime: 0,
                nextBackupTime: currentTime + this.backupIntervalMs,
                backupIntervalMs: this.backupIntervalMs
            };
        }
    }

    /**
     * Save backup metadata
     */
    private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
        await fsPromises.writeFile(BACKUP_METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    /**
     * Perform the actual backup
     */
    public async performBackup(): Promise<void> {
        try {
            // Check if config file exists
            if (!fs.existsSync(CONFIG_FILE)) {
                console.warn('Config file does not exist, skipping backup');
                return;
            }

            // Read the current config
            const configContent = await fsPromises.readFile(CONFIG_FILE, 'utf-8');
            const config: Config = JSON.parse(configContent);

            // Create backup with timestamp comment
            const backupData = {
                ...config,
                _backupMetadata: {
                    createdAt: new Date().toISOString(),
                    backupVersion: '1.0',
                    originalConfigPath: CONFIG_FILE
                }
            };

            // Write backup file (this will overwrite the previous backup)
            await fsPromises.writeFile(BACKUP_FILE, JSON.stringify(backupData, null, 2), 'utf-8');

            // Update metadata
            const currentTime = Date.now();
            const metadata: BackupMetadata = {
                lastBackupTime: currentTime,
                nextBackupTime: currentTime + this.backupIntervalMs,
                backupIntervalMs: this.backupIntervalMs
            };
            await this.saveBackupMetadata(metadata);

            console.log(`Config backup created successfully at: ${new Date().toISOString()}`);
        } catch (error) {
            console.error('Failed to perform backup:', error);
            throw error;
        }
    }

    /**
     * Start the periodic backup schedule
     */
    private startBackupSchedule(): void {
        // Clear any existing interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        // Check every hour if a backup is needed
        this.intervalId = setInterval(async () => {
            try {
                const shouldBackup = await this.shouldPerformBackup();
                if (shouldBackup) {
                    await this.performBackup();
                }
            } catch (error) {
                console.error('Error during scheduled backup check:', error);
            }
        }, 60 * 60 * 1000); // Check every hour

        console.log('Backup schedule started');
    }

    /**
     * Get backup status and next backup time
     */
    public async getBackupStatus(): Promise<{
        lastBackupTime: string | null;
        nextBackupTime: string;
        backupExists: boolean;
    }> {
        try {
            const metadata = await this.loadBackupMetadata();
            const backupExists = fs.existsSync(BACKUP_FILE);

            return {
                lastBackupTime: metadata.lastBackupTime ? new Date(metadata.lastBackupTime).toISOString() : null,
                nextBackupTime: new Date(metadata.nextBackupTime).toISOString(),
                backupExists
            };
        } catch (error) {
            console.error('Error getting backup status:', error);
            return {
                lastBackupTime: null,
                nextBackupTime: new Date(Date.now() + this.backupIntervalMs).toISOString(),
                backupExists: false
            };
        }
    }

    /**
     * Manually trigger a backup (useful for testing or manual backups)
     */
    public async triggerManualBackup(): Promise<void> {
        await this.performBackup();
    }

    /**
     * Restore from backup
     */
    public async restoreFromBackup(): Promise<void> {
        try {
            if (!fs.existsSync(BACKUP_FILE)) {
                throw new Error('No backup file found');
            }

            // Read backup file
            const backupContent = await fsPromises.readFile(BACKUP_FILE, 'utf-8');
            const backupData = JSON.parse(backupContent);

            // Remove backup metadata before restoring
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _backupMetadata, ...configData } = backupData;

            // Write to config file
            await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(configData, null, 2), 'utf-8');

            console.log('Config restored from backup successfully');
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            throw error;
        }
    }
}

export default BackupService;
