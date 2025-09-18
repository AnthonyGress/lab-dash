import { Request, Response, Router } from 'express';
import fsSync from 'fs';
import fs from 'fs/promises';
import StatusCodes from 'http-status-codes';
import jwt from 'jsonwebtoken';
import path from 'path';

import {  authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { Config } from '../types';
import { BackupService } from '../utils/backup.service';

export const configRoute = Router();

const CONFIG_FILE = path.join(__dirname, '../config/config.json');
const JWT_SECRET = process.env.SECRET || '@jZCgtn^qg8So*^^6A2M';

// Helper function to check if user is authenticated and is admin
const isUserAdmin = (req: Request): boolean => {
    try {
        // Check for token in cookies first
        const tokenFromCookie = req.cookies?.access_token;
        // Then check Authorization header
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader && authHeader.split(' ')[1];

        const token = tokenFromCookie || tokenFromHeader;

        if (!token) {
            return false;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return decoded && decoded.role === 'admin';
    } catch (error) {
        return false;
    }
};

// Helper function to filter admin-only items from config
const filterAdminOnlyItems = (config: any): any => {
    const filteredConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    const filterItems = (items: any[]) => {
        return items.filter(item => {
            // Remove admin-only items
            if (item.adminOnly === true) {
                return false;
            }

            // Handle group widget items recursively
            if (item.type === 'group-widget' && item.config?.items) {
                item.config.items = filterItems(item.config.items);
            }

            return true;
        });
    };

    // Filter desktop and mobile layouts
    if (filteredConfig.layout) {
        if (filteredConfig.layout.desktop) {
            filteredConfig.layout.desktop = filterItems(filteredConfig.layout.desktop);
        }
        if (filteredConfig.layout.mobile) {
            filteredConfig.layout.mobile = filterItems(filteredConfig.layout.mobile);
        }
    }

    // Filter pages
    if (filteredConfig.pages) {
        filteredConfig.pages = filteredConfig.pages
            .filter((page: any) => !page.adminOnly) // Filter out admin-only pages
            .map((page: any) => ({
                ...page,
                layout: {
                    desktop: page.layout.desktop ? filterItems(page.layout.desktop) : [],
                    mobile: page.layout.mobile ? filterItems(page.layout.mobile) : []
                }
            }));
    }

    return filteredConfig;
};
const loadConfig = () => {
    if (fsSync.existsSync(CONFIG_FILE)) {
        try {
            const fileContent = fsSync.readFileSync(CONFIG_FILE, 'utf-8');
            if (!fileContent.trim()) {
                console.error('Config file is empty, returning default config');
                return { layout: { desktop: [], mobile: [] } };
            }
            const config = JSON.parse(fileContent);
            return config;
        } catch (error) {
            console.error('Error parsing config file:', error);
            console.error('Config file content length:', fsSync.readFileSync(CONFIG_FILE, 'utf-8').length);

            // Try to read the first and last 100 characters to help debug
            try {
                const content = fsSync.readFileSync(CONFIG_FILE, 'utf-8');
                console.error('First 100 chars:', content.substring(0, 100));
                console.error('Last 100 chars:', content.substring(Math.max(0, content.length - 100)));
            } catch (readError) {
                console.error('Could not read config file for debugging:', readError);
            }

            // Return default config if parsing fails
            return { layout: { desktop: [], mobile: [] } };
        }
    }
    return { layout: { desktop: [], mobile: [] } };
};

// Helper function to filter sensitive data from config before sending to frontend
const filterSensitiveData = (config: any): any => {
    const filteredConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    const processItems = (items: any[]) => {
        return items.map(item => {
            if (!item.config) return item;

            const newConfig = { ...item.config };

            // Handle Pi-hole widget sensitive data
            if (newConfig.apiToken) {
                newConfig._hasApiToken = true;
                delete newConfig.apiToken;
            }
            if (newConfig.password) {
                newConfig._hasPassword = true;
                delete newConfig.password;
            }

            // Handle AdGuard Home widget sensitive data
            if (item.type === 'adguard-widget') {
                if (newConfig.username) {
                    newConfig._hasUsername = true;
                    delete newConfig.username;
                }
                if (newConfig.password) {
                    newConfig._hasPassword = true;
                    delete newConfig.password;
                }
            }

            // Handle download client (torrent/NZB) sensitive data
            if ((item.type === 'download-client' || item.type === 'torrent-client') && newConfig.password) {
                newConfig._hasPassword = true;
                delete newConfig.password;
            }

            // Handle media server widget sensitive data
            if (item.type === 'media-server-widget' && newConfig.apiKey) {
                newConfig._hasApiKey = true;
                delete newConfig.apiKey;
            }

            // Handle Sonarr widget sensitive data
            if (item.type === 'sonarr-widget' && newConfig.apiKey) {
                newConfig._hasApiKey = true;
                delete newConfig.apiKey;
            }

            // Handle Radarr widget sensitive data
            if (item.type === 'radarr-widget' && newConfig.apiKey) {
                newConfig._hasApiKey = true;
                delete newConfig.apiKey;
            }

            // Handle Media Request Manager widget sensitive data
            if (item.type === 'media-request-manager-widget' && newConfig.apiKey) {
                newConfig._hasApiKey = true;
                delete newConfig.apiKey;
            }

            // Handle dual widget sensitive data
            if (item.type === 'dual-widget') {
                if (newConfig.topWidget?.config) {
                    if (newConfig.topWidget.config.apiToken) {
                        newConfig.topWidget.config._hasApiToken = true;
                        delete newConfig.topWidget.config.apiToken;
                    }
                    if (newConfig.topWidget.config.password) {
                        newConfig.topWidget.config._hasPassword = true;
                        delete newConfig.topWidget.config.password;
                    }
                    // Handle AdGuard Home username in dual widget
                    if (newConfig.topWidget.config.username) {
                        newConfig.topWidget.config._hasUsername = true;
                        delete newConfig.topWidget.config.username;
                    }
                }
                if (newConfig.bottomWidget?.config) {
                    if (newConfig.bottomWidget.config.apiToken) {
                        newConfig.bottomWidget.config._hasApiToken = true;
                        delete newConfig.bottomWidget.config.apiToken;
                    }
                    if (newConfig.bottomWidget.config.password) {
                        newConfig.bottomWidget.config._hasPassword = true;
                        delete newConfig.bottomWidget.config.password;
                    }
                    // Handle AdGuard Home username in dual widget
                    if (newConfig.bottomWidget.config.username) {
                        newConfig.bottomWidget.config._hasUsername = true;
                        delete newConfig.bottomWidget.config.username;
                    }
                }
            }

            // Handle group widget items (recursively)
            if (item.type === 'group-widget' && newConfig.items) {
                newConfig.items = processItems(newConfig.items);
            }

            return { ...item, config: newConfig };
        });
    };

    // Process desktop and mobile layouts
    if (filteredConfig.layout) {
        if (filteredConfig.layout.desktop) {
            filteredConfig.layout.desktop = processItems(filteredConfig.layout.desktop);
        }
        if (filteredConfig.layout.mobile) {
            filteredConfig.layout.mobile = processItems(filteredConfig.layout.mobile);
        }
    }

    // Process pages
    if (filteredConfig.pages) {
        filteredConfig.pages = filteredConfig.pages.map((page: any) => ({
            ...page,
            layout: {
                desktop: page.layout.desktop ? processItems(page.layout.desktop) : [],
                mobile: page.layout.mobile ? processItems(page.layout.mobile) : []
            }
        }));
    }

    return filteredConfig;
};

// Helper function to restore sensitive data when saving config
const restoreSensitiveData = (newConfig: any, existingConfig: any): any => {
    const restoredConfig = JSON.parse(JSON.stringify(newConfig)); // Deep clone

    // Create a global map of all existing items by ID for cross-location lookups
    const createGlobalItemMap = (config: any): Map<string, any> => {
        const globalMap = new Map();

        // Helper to add items from a layout to the global map
        const addItemsToMap = (items: any[]) => {
            items.forEach(item => {
                globalMap.set(item.id, item);

                // Also add group widget items
                if (item.type === 'group-widget' && item.config?.items) {
                    item.config.items.forEach((groupItem: any) => {
                        globalMap.set(groupItem.id, groupItem);
                    });
                }
            });
        };

        // Add items from main dashboard
        if (config.layout?.desktop) addItemsToMap(config.layout.desktop);
        if (config.layout?.mobile) addItemsToMap(config.layout.mobile);

        // Add items from all pages
        if (config.pages) {
            config.pages.forEach((page: any) => {
                if (page.layout?.desktop) addItemsToMap(page.layout.desktop);
                if (page.layout?.mobile) addItemsToMap(page.layout.mobile);
            });
        }

        return globalMap;
    };

    const globalExistingItemsMap = createGlobalItemMap(existingConfig);

    const restoreItemSensitiveData = (newItem: any, existingItem: any): any => {
        if (!newItem.config) return newItem;

        const restoredItemConfig = { ...newItem.config };

        // Handle duplication: if this is a duplicated item, copy credentials from source item
        if (newItem.config._duplicatedFrom) {
            const sourceItem = globalExistingItemsMap.get(newItem.config._duplicatedFrom);
            if (sourceItem?.config) {
                console.log(`Copying credentials from source item ${newItem.config._duplicatedFrom} to duplicated item ${newItem.id}`);

                // Copy encrypted credentials directly from source item
                if (sourceItem.config.apiToken) {
                    restoredItemConfig.apiToken = sourceItem.config.apiToken;
                }
                if (sourceItem.config.password) {
                    restoredItemConfig.password = sourceItem.config.password;
                }
                if (sourceItem.config.username) {
                    restoredItemConfig.username = sourceItem.config.username;
                }
                if (sourceItem.config.apiKey) {
                    restoredItemConfig.apiKey = sourceItem.config.apiKey;
                }

                // Handle dual widget credential copying
                if (newItem.type === 'dual-widget' && sourceItem.config.topWidget?.config) {
                    if (restoredItemConfig.topWidget?.config) {
                        if (sourceItem.config.topWidget.config.apiToken) {
                            restoredItemConfig.topWidget.config.apiToken = sourceItem.config.topWidget.config.apiToken;
                        }
                        if (sourceItem.config.topWidget.config.password) {
                            restoredItemConfig.topWidget.config.password = sourceItem.config.topWidget.config.password;
                        }
                        if (sourceItem.config.topWidget.config.username) {
                            restoredItemConfig.topWidget.config.username = sourceItem.config.topWidget.config.username;
                        }
                        if (sourceItem.config.topWidget.config.apiKey) {
                            restoredItemConfig.topWidget.config.apiKey = sourceItem.config.topWidget.config.apiKey;
                        }
                    }
                }
                if (newItem.type === 'dual-widget' && sourceItem.config.bottomWidget?.config) {
                    if (restoredItemConfig.bottomWidget?.config) {
                        if (sourceItem.config.bottomWidget.config.apiToken) {
                            restoredItemConfig.bottomWidget.config.apiToken = sourceItem.config.bottomWidget.config.apiToken;
                        }
                        if (sourceItem.config.bottomWidget.config.password) {
                            restoredItemConfig.bottomWidget.config.password = sourceItem.config.bottomWidget.config.password;
                        }
                        if (sourceItem.config.bottomWidget.config.username) {
                            restoredItemConfig.bottomWidget.config.username = sourceItem.config.bottomWidget.config.username;
                        }
                        if (sourceItem.config.bottomWidget.config.apiKey) {
                            restoredItemConfig.bottomWidget.config.apiKey = sourceItem.config.bottomWidget.config.apiKey;
                        }
                    }
                }

                // Clean up and return early since we've copied everything we need
                delete restoredItemConfig._hasApiToken;
                delete restoredItemConfig._hasApiKey;
                delete restoredItemConfig._hasPassword;
                delete restoredItemConfig._hasUsername;
                delete restoredItemConfig._duplicatedFrom;
                if (restoredItemConfig.topWidget?.config) {
                    delete restoredItemConfig.topWidget.config._hasApiToken;
                    delete restoredItemConfig.topWidget.config._hasApiKey;
                    delete restoredItemConfig.topWidget.config._hasPassword;
                    delete restoredItemConfig.topWidget.config._hasUsername;
                }
                if (restoredItemConfig.bottomWidget?.config) {
                    delete restoredItemConfig.bottomWidget.config._hasApiToken;
                    delete restoredItemConfig.bottomWidget.config._hasApiKey;
                    delete restoredItemConfig.bottomWidget.config._hasPassword;
                    delete restoredItemConfig.bottomWidget.config._hasUsername;
                }

                return { ...newItem, config: restoredItemConfig };
            }
        }

        if (!existingItem?.config) {
            // Even if no existing item, we still need to clean up security flags
            // Clean up security flags and duplication metadata (they're only for communication, not storage)
            delete restoredItemConfig._hasApiToken;
            delete restoredItemConfig._hasApiKey;
            delete restoredItemConfig._hasPassword;
            delete restoredItemConfig._hasUsername;
            delete restoredItemConfig._duplicatedFrom;
            if (restoredItemConfig.topWidget?.config) {
                delete restoredItemConfig.topWidget.config._hasApiToken;
                delete restoredItemConfig.topWidget.config._hasApiKey;
                delete restoredItemConfig.topWidget.config._hasPassword;
                delete restoredItemConfig.topWidget.config._hasUsername;
            }
            if (restoredItemConfig.bottomWidget?.config) {
                delete restoredItemConfig.bottomWidget.config._hasApiToken;
                delete restoredItemConfig.bottomWidget.config._hasApiKey;
                delete restoredItemConfig.bottomWidget.config._hasPassword;
                delete restoredItemConfig.bottomWidget.config._hasUsername;
            }

            return { ...newItem, config: restoredItemConfig };
        }

        // Handle group widget items (recursively)
        if (newItem.type === 'group-widget' && restoredItemConfig.items && existingItem.config.items) {
            restoredItemConfig.items = restoreItemsArray(restoredItemConfig.items, existingItem.config.items);
        }

        // Restore Pi-hole sensitive data if flags indicate existing data should be preserved
        if (newItem.config._hasApiToken && !newItem.config.apiToken && existingItem.config.apiToken) {
            restoredItemConfig.apiToken = existingItem.config.apiToken;
        }
        if (newItem.config._hasPassword && !newItem.config.password && existingItem.config.password) {
            restoredItemConfig.password = existingItem.config.password;
        }

        // Handle AdGuard Home sensitive data
        if (newItem.type === 'adguard-widget') {
            if (newItem.config._hasUsername && !newItem.config.username && existingItem.config.username) {
                restoredItemConfig.username = existingItem.config.username;
            }
            if (newItem.config._hasPassword && !newItem.config.password && existingItem.config.password) {
                restoredItemConfig.password = existingItem.config.password;
            }
        }

        // Handle download client (torrent/NZB) sensitive data
        if (newItem.type === 'download-client' || newItem.type === 'torrent-client') {
            if (newItem.config._hasPassword && !newItem.config.password && existingItem.config.password) {
                restoredItemConfig.password = existingItem.config.password;
            }
        }

        // Handle media server widget sensitive data
        if (newItem.type === 'media-server-widget') {
            if (newItem.config._hasApiKey && !newItem.config.apiKey && existingItem.config.apiKey) {
                restoredItemConfig.apiKey = existingItem.config.apiKey;
            }
        }

        // Handle Sonarr widget sensitive data
        if (newItem.type === 'sonarr-widget') {
            if (newItem.config._hasApiKey && !newItem.config.apiKey && existingItem.config.apiKey) {
                restoredItemConfig.apiKey = existingItem.config.apiKey;
            }
        }

        // Handle Radarr widget sensitive data
        if (newItem.type === 'radarr-widget') {
            if (newItem.config._hasApiKey && !newItem.config.apiKey && existingItem.config.apiKey) {
                restoredItemConfig.apiKey = existingItem.config.apiKey;
            }
        }

        // Handle Media Request Manager widget sensitive data
        if (newItem.type === 'media-request-manager-widget') {
            if (newItem.config._hasApiKey && !newItem.config.apiKey && existingItem.config.apiKey) {
                restoredItemConfig.apiKey = existingItem.config.apiKey;
            }
        }

        // Handle dual widget sensitive data
        if (newItem.type === 'dual-widget') {
            if (restoredItemConfig.topWidget?.config && existingItem.config.topWidget?.config) {
                if (restoredItemConfig.topWidget.config._hasApiToken && !restoredItemConfig.topWidget.config.apiToken && existingItem.config.topWidget.config.apiToken) {
                    restoredItemConfig.topWidget.config.apiToken = existingItem.config.topWidget.config.apiToken;
                }
                if (restoredItemConfig.topWidget.config._hasPassword && !restoredItemConfig.topWidget.config.password && existingItem.config.topWidget.config.password) {
                    restoredItemConfig.topWidget.config.password = existingItem.config.topWidget.config.password;
                }
                // Handle AdGuard Home username restoration in dual widget
                if (restoredItemConfig.topWidget.config._hasUsername && !restoredItemConfig.topWidget.config.username && existingItem.config.topWidget.config.username) {
                    restoredItemConfig.topWidget.config.username = existingItem.config.topWidget.config.username;
                }
            }
            if (restoredItemConfig.bottomWidget?.config && existingItem.config.bottomWidget?.config) {
                if (restoredItemConfig.bottomWidget.config._hasApiToken && !restoredItemConfig.bottomWidget.config.apiToken && existingItem.config.bottomWidget.config.apiToken) {
                    restoredItemConfig.bottomWidget.config.apiToken = existingItem.config.bottomWidget.config.apiToken;
                }
                if (restoredItemConfig.bottomWidget.config._hasPassword && !restoredItemConfig.bottomWidget.config.password && existingItem.config.bottomWidget.config.password) {
                    restoredItemConfig.bottomWidget.config.password = existingItem.config.bottomWidget.config.password;
                }
                // Handle AdGuard Home username restoration in dual widget
                if (restoredItemConfig.bottomWidget.config._hasUsername && !restoredItemConfig.bottomWidget.config.username && existingItem.config.bottomWidget.config.username) {
                    restoredItemConfig.bottomWidget.config.username = existingItem.config.bottomWidget.config.username;
                }
            }
        }

        // Clean up security flags and duplication metadata (they're only for communication, not storage)
        delete restoredItemConfig._hasApiToken;
        delete restoredItemConfig._hasApiKey;
        delete restoredItemConfig._hasPassword;
        delete restoredItemConfig._hasUsername;
        delete restoredItemConfig._duplicatedFrom;
        if (restoredItemConfig.topWidget?.config) {
            delete restoredItemConfig.topWidget.config._hasApiToken;
            delete restoredItemConfig.topWidget.config._hasApiKey;
            delete restoredItemConfig.topWidget.config._hasPassword;
            delete restoredItemConfig.topWidget.config._hasUsername;
        }
        if (restoredItemConfig.bottomWidget?.config) {
            delete restoredItemConfig.bottomWidget.config._hasApiToken;
            delete restoredItemConfig.bottomWidget.config._hasApiKey;
            delete restoredItemConfig.bottomWidget.config._hasPassword;
            delete restoredItemConfig.bottomWidget.config._hasUsername;
        }

        return { ...newItem, config: restoredItemConfig };
    };

    const restoreItemsArray = (newItems: any[], existingItems: any[]): any[] => {
        const existingItemsMap = new Map(existingItems.map(item => [item.id, item]));

        return newItems.map(newItem => {
            // First try to find the item in the local existing items (for normal updates)
            let existingItem = existingItemsMap.get(newItem.id);

            // If not found locally, try the global map (for item moves)
            if (!existingItem) {
                existingItem = globalExistingItemsMap.get(newItem.id);
            }

            // Always call restoreItemSensitiveData, even if no existing item found
            // This ensures duplication logic and cleanup always runs
            return restoreItemSensitiveData(newItem, existingItem);
        });
    };

    // Restore desktop and mobile layouts
    if (restoredConfig.layout && existingConfig.layout) {
        if (restoredConfig.layout.desktop && existingConfig.layout.desktop) {
            restoredConfig.layout.desktop = restoreItemsArray(restoredConfig.layout.desktop, existingConfig.layout.desktop);
        }
        if (restoredConfig.layout.mobile && existingConfig.layout.mobile) {
            restoredConfig.layout.mobile = restoreItemsArray(restoredConfig.layout.mobile, existingConfig.layout.mobile);
        }
    }

    // Restore pages
    if (restoredConfig.pages && existingConfig.pages) {
        const existingPagesMap = new Map(existingConfig.pages.map((page: any) => [page.id, page]));

        restoredConfig.pages = restoredConfig.pages.map((newPage: any) => {
            const existingPage = existingPagesMap.get(newPage.id) as any;
            if (!existingPage || !existingPage.layout) return newPage;
            if (!newPage.layout) return newPage;

            const newPageWithLayout = newPage as any;
            const existingPageWithLayout = existingPage as any;

            return {
                ...newPage,
                layout: {
                    desktop: (newPageWithLayout.layout.desktop && existingPageWithLayout.layout.desktop) ?
                        restoreItemsArray(newPageWithLayout.layout.desktop, existingPageWithLayout.layout.desktop) :
                        (newPageWithLayout.layout.desktop || []),
                    mobile: (newPageWithLayout.layout.mobile && existingPageWithLayout.layout.mobile) ?
                        restoreItemsArray(newPageWithLayout.layout.mobile, existingPageWithLayout.layout.mobile) :
                        (newPageWithLayout.layout.mobile || [])
                }
            };
        });
    }

    return restoredConfig;
};

// GET - Return the config file with sensitive data filtered and admin-only items filtered based on user role
configRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const config = loadConfig();

        // Filter sensitive data (passwords/tokens) and add security flags
        let filteredConfig = filterSensitiveData(config);

        // Filter admin-only items if user is not admin
        if (!isUserAdmin(req)) {
            filteredConfig = filterAdminOnlyItems(filteredConfig);
        }

        res.status(StatusCodes.OK).json(filteredConfig);
    } catch (error) {
        console.error('Error loading config:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error loading config file',
            error: (error as Error).message
        });
    }
});

// GET - Export the config file as a download (admin only)
configRoute.get('/export', [authenticateToken, requireAdmin], async (_req: Request, res: Response): Promise<void> => {
    try {
        const config = loadConfig();
        const fileName = `lab-dash-backup-${new Date().toISOString().slice(0, 10)}.json`;

        // Set headers to force download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        // Send the formatted JSON as the response (with sensitive data for backup)
        res.status(StatusCodes.OK).send(JSON.stringify(config, null, 2));
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error exporting config file',
            error: (error as Error).message
        });
    }
});

// POST - Save the incoming JSON layout to disk (admin only)
configRoute.post('/', [authenticateToken, requireAdmin], async (req: Request, res: Response): Promise<void> => {
    try {
        const updates = req.body;
        const existingConfig: Config = loadConfig();

        // Restore sensitive data from existing config before saving
        const configToSave = restoreSensitiveData(updates, existingConfig);

        // Apply updates to existing config
        Object.keys(configToSave).forEach((key) => {
            if (configToSave[key] !== undefined) {
                (existingConfig as any)[key] = configToSave[key];
            }
        });

        // Ensure the config has all required properties
        if (!existingConfig.layout) {
            existingConfig.layout = { desktop: [], mobile: [] };
        }
        if (!existingConfig.pages) {
            existingConfig.pages = [];
        }

        // Save the updated config to file (with sensitive data preserved)
        await fs.writeFile(CONFIG_FILE, JSON.stringify(existingConfig, null, 2), 'utf-8');

        // Return filtered config to frontend (without sensitive data)
        const filteredConfig = filterSensitiveData(existingConfig);

        res.status(StatusCodes.OK).json({
            message: 'Config saved successfully',
            updatedConfig: filteredConfig
        });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error saving config file',
            error: (error as Error).message
        });
    }
});

// POST - Import a complete configuration file and replace existing config (admin only)
configRoute.post('/import', [authenticateToken, requireAdmin], async (req: Request, res: Response): Promise<void> => {
    try {
        // Get the complete config object from the request body
        const importedConfig = req.body;

        // console.log('Importing config:', importedConfig);

        // Validate the imported config structure
        if (!importedConfig || typeof importedConfig !== 'object') {
            res.status(StatusCodes.BAD_REQUEST).json({
                message: 'Invalid configuration format'
            });
            return;
        }

        // Ensure layout property exists to avoid errors
        if (!importedConfig.layout) {
            importedConfig.layout = { desktop: [], mobile: [] };
        }

        // Write the imported config directly to the config file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(importedConfig, null, 2), 'utf-8');

        // Return filtered config to frontend
        const filteredConfig = filterSensitiveData(importedConfig);
        res.status(StatusCodes.OK).json({
            message: 'Configuration imported successfully',
            updatedConfig: filteredConfig
        });
    } catch (error) {
        console.error('Error importing config:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error importing configuration file',
            error: (error as Error).message
        });
    }
});

// GET - Get backup status (admin only)
configRoute.get('/backup/status', [authenticateToken, requireAdmin], async (_req: Request, res: Response): Promise<void> => {
    try {
        const backupService = BackupService.getInstance();
        const status = await backupService.getBackupStatus();
        res.status(StatusCodes.OK).json(status);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error getting backup status',
            error: (error as Error).message
        });
    }
});

// POST - Trigger manual backup (admin only)
configRoute.post('/backup/trigger', [authenticateToken, requireAdmin], async (_req: Request, res: Response): Promise<void> => {
    try {
        const backupService = BackupService.getInstance();
        await backupService.triggerManualBackup();
        res.status(StatusCodes.OK).json({
            message: 'Backup created successfully'
        });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error creating backup',
            error: (error as Error).message
        });
    }
});

// POST - Restore from backup (admin only)
configRoute.post('/backup/restore', [authenticateToken, requireAdmin], async (_req: Request, res: Response): Promise<void> => {
    try {
        const backupService = BackupService.getInstance();
        await backupService.restoreFromBackup();
        res.status(StatusCodes.OK).json({
            message: 'Configuration restored from backup successfully'
        });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error restoring from backup',
            error: (error as Error).message
        });
    }
});
