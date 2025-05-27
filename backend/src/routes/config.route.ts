import { Request, Response, Router } from 'express';
import fsSync from 'fs';
import fs from 'fs/promises';
import StatusCodes from 'http-status-codes';
import path from 'path';

import {  authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { Config } from '../types';
export const configRoute = Router();

const CONFIG_FILE = path.join(__dirname, '../config/config.json');

// Helper function to ensure security flags are present for backwards compatibility
const ensureSecurityFlags = (config: any): any => {
    const processItems = (items: any[]) => {
        return items.map(item => {
            if (item.config) {
                const newConfig = { ...item.config };

                // Handle Pi-hole widget sensitive data
                if (newConfig.apiToken && !newConfig._hasApiToken) {
                    newConfig._hasApiToken = true;
                }
                if (newConfig.password && !newConfig._hasPassword) {
                    newConfig._hasPassword = true;
                }

                // Handle torrent client sensitive data
                if (item.type === 'torrent-client' && newConfig.password && !newConfig._hasPassword) {
                    newConfig._hasPassword = true;
                }

                // Handle dual widget sensitive data
                if (item.type === 'dual-widget') {
                    if (newConfig.topWidget?.config) {
                        if (newConfig.topWidget.config.apiToken && !newConfig.topWidget.config._hasApiToken) {
                            newConfig.topWidget.config._hasApiToken = true;
                        }
                        if (newConfig.topWidget.config.password && !newConfig.topWidget.config._hasPassword) {
                            newConfig.topWidget.config._hasPassword = true;
                        }
                    }
                    if (newConfig.bottomWidget?.config) {
                        if (newConfig.bottomWidget.config.apiToken && !newConfig.bottomWidget.config._hasApiToken) {
                            newConfig.bottomWidget.config._hasApiToken = true;
                        }
                        if (newConfig.bottomWidget.config.password && !newConfig.bottomWidget.config._hasPassword) {
                            newConfig.bottomWidget.config._hasPassword = true;
                        }
                    }
                }

                // Handle group widget items
                if (item.type === 'group-widget' && newConfig.items) {
                    newConfig.items = processItems(newConfig.items);
                }

                return { ...item, config: newConfig };
            }
            return item;
        });
    };

    const updatedConfig = { ...config };

    // Process desktop and mobile layouts
    if (updatedConfig.layout) {
        if (updatedConfig.layout.desktop) {
            updatedConfig.layout.desktop = processItems(updatedConfig.layout.desktop);
        }
        if (updatedConfig.layout.mobile) {
            updatedConfig.layout.mobile = processItems(updatedConfig.layout.mobile);
        }
    }

    // Process pages
    if (updatedConfig.pages) {
        updatedConfig.pages = updatedConfig.pages.map((page: any) => ({
            ...page,
            layout: {
                desktop: page.layout.desktop ? processItems(page.layout.desktop) : [],
                mobile: page.layout.mobile ? processItems(page.layout.mobile) : []
            }
        }));
    }

    return updatedConfig;
};

const loadConfig = () => {
    if (fsSync.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fsSync.readFileSync(CONFIG_FILE, 'utf-8'));

        // Ensure security flags are present for backwards compatibility
        const configWithFlags = ensureSecurityFlags(config);

        // If flags were added, save the updated config
        if (JSON.stringify(config) !== JSON.stringify(configWithFlags)) {
            console.log('Adding missing security flags for backwards compatibility');
            fsSync.writeFileSync(CONFIG_FILE, JSON.stringify(configWithFlags, null, 2), 'utf-8');
        }

        return configWithFlags;
    }
    return { layout: { desktop: [], mobile: [] } };
};

// Helper function to filter sensitive data from config before sending to frontend
const filterSensitiveData = (config: any): any => {
    const filteredConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    const processItems = (items: any[]) => {
        return items.map(item => {
            if (item.config) {
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

                // Handle torrent client sensitive data
                if (item.type === 'torrent-client') {
                    if (newConfig.password) {
                        newConfig._hasPassword = true;
                        delete newConfig.password;
                    }
                    // Always preserve _hasPassword flag if it exists (for backwards compatibility)
                    if (newConfig._hasPassword !== undefined) {
                        newConfig._hasPassword = true;
                    }
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
                    }
                }

                // Handle group widget items
                if (item.type === 'group-widget' && newConfig.items) {
                    newConfig.items = processItems(newConfig.items);
                }

                return { ...item, config: newConfig };
            }
            return item;
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

// Helper function to merge sensitive data back when saving config
const mergeSensitiveData = (newConfig: any, existingConfig: any): any => {
    const mergedConfig = JSON.parse(JSON.stringify(newConfig)); // Deep clone

    // Helper function to find an item by ID across all layouts in the existing config
    const findItemById = (itemId: string): any => {
        // Search in main desktop layout
        let foundItem = existingConfig.layout?.desktop?.find((item: any) => item.id === itemId);
        if (foundItem) return foundItem;

        // Search in main mobile layout
        foundItem = existingConfig.layout?.mobile?.find((item: any) => item.id === itemId);
        if (foundItem) return foundItem;

        // Search in pages if they exist
        if (existingConfig.pages) {
            for (const page of existingConfig.pages) {
                // Search in page desktop layout
                foundItem = page.layout?.desktop?.find((item: any) => item.id === itemId);
                if (foundItem) return foundItem;

                // Search in page mobile layout
                foundItem = page.layout?.mobile?.find((item: any) => item.id === itemId);
                if (foundItem) return foundItem;
            }
        }

        return null;
    };

    const mergeItems = (newItems: any[], existingItems: any[]) => {
        return newItems.map(newItem => {
            // First try to find in the same layout array (for normal updates)
            let existingItem = existingItems.find(item => item.id === newItem.id);

            // If not found in same layout, search across all layouts (for moved items)
            if (!existingItem) {
                existingItem = findItemById(newItem.id);
            }

            if (existingItem?.config && newItem.config) {
                const mergedItemConfig = { ...newItem.config };

                // Restore Pi-hole sensitive data if not being updated
                if (newItem.config._hasApiToken && !newItem.config.apiToken && existingItem.config.apiToken) {
                    mergedItemConfig.apiToken = existingItem.config.apiToken;
                }
                if (newItem.config._hasPassword && !newItem.config.password && existingItem.config.password) {
                    mergedItemConfig.password = existingItem.config.password;
                }

                // Handle torrent client sensitive data
                if (newItem.type === 'torrent-client') {
                    // Restore password if not being updated
                    if (newItem.config._hasPassword && !newItem.config.password && existingItem.config.password) {
                        mergedItemConfig.password = existingItem.config.password;
                    }
                    // Always preserve _hasPassword flag if existing item has a password
                    if (existingItem.config.password || existingItem.config._hasPassword) {
                        mergedItemConfig._hasPassword = true;
                    }

                }

                // Handle dual widget sensitive data
                if (newItem.type === 'dual-widget') {

                    if (mergedItemConfig.topWidget?.config && existingItem.config.topWidget?.config) {
                        if (mergedItemConfig.topWidget.config._hasApiToken && !mergedItemConfig.topWidget.config.apiToken && existingItem.config.topWidget.config.apiToken) {
                            mergedItemConfig.topWidget.config.apiToken = existingItem.config.topWidget.config.apiToken;
                        }
                        if (mergedItemConfig.topWidget.config._hasPassword && !mergedItemConfig.topWidget.config.password && existingItem.config.topWidget.config.password) {
                            mergedItemConfig.topWidget.config.password = existingItem.config.topWidget.config.password;

                        }
                    }
                    if (mergedItemConfig.bottomWidget?.config && existingItem.config.bottomWidget?.config) {

                        if (mergedItemConfig.bottomWidget.config._hasApiToken && !mergedItemConfig.bottomWidget.config.apiToken && existingItem.config.bottomWidget.config.apiToken) {
                            mergedItemConfig.bottomWidget.config.apiToken = existingItem.config.bottomWidget.config.apiToken;

                        }
                        if (mergedItemConfig.bottomWidget.config._hasPassword && !mergedItemConfig.bottomWidget.config.password && existingItem.config.bottomWidget.config.password) {
                            mergedItemConfig.bottomWidget.config.password = existingItem.config.bottomWidget.config.password;

                        }
                    }
                }

                // Handle group widget items
                if (newItem.type === 'group-widget' && mergedItemConfig.items && existingItem.config.items) {
                    mergedItemConfig.items = mergeItems(mergedItemConfig.items, existingItem.config.items);
                }

                // Clean up flags (but preserve torrent client flags)
                if (newItem.type !== 'torrent-client') {
                    delete mergedItemConfig._hasApiToken;
                    delete mergedItemConfig._hasPassword;
                }
                // For torrent clients, never delete security flags - they should always be preserved
                if (mergedItemConfig.topWidget?.config) {
                    delete mergedItemConfig.topWidget.config._hasApiToken;
                    delete mergedItemConfig.topWidget.config._hasPassword;
                }
                if (mergedItemConfig.bottomWidget?.config) {
                    delete mergedItemConfig.bottomWidget.config._hasApiToken;
                    delete mergedItemConfig.bottomWidget.config._hasPassword;
                }

                return { ...newItem, config: mergedItemConfig };
            }
            return newItem;
        });
    };

    // Merge desktop and mobile layouts
    if (mergedConfig.layout && existingConfig.layout) {
        if (mergedConfig.layout.desktop && existingConfig.layout.desktop) {
            mergedConfig.layout.desktop = mergeItems(mergedConfig.layout.desktop, existingConfig.layout.desktop);
        }
        if (mergedConfig.layout.mobile && existingConfig.layout.mobile) {
            mergedConfig.layout.mobile = mergeItems(mergedConfig.layout.mobile, existingConfig.layout.mobile);
        }
    }

    // Merge pages
    if (mergedConfig.pages && existingConfig.pages) {
        mergedConfig.pages = mergedConfig.pages.map((newPage: any) => {
            const existingPage = existingConfig.pages.find((page: any) => page.id === newPage.id);
            if (existingPage?.layout) {
                return {
                    ...newPage,
                    layout: {
                        desktop: newPage.layout.desktop && existingPage.layout.desktop ?
                            mergeItems(newPage.layout.desktop, existingPage.layout.desktop) :
                            newPage.layout.desktop || [],
                        mobile: newPage.layout.mobile && existingPage.layout.mobile ?
                            mergeItems(newPage.layout.mobile, existingPage.layout.mobile) :
                            newPage.layout.mobile || []
                    }
                };
            }
            return newPage;
        });
    }

    return mergedConfig;
};

// GET - Retrieve the saved layout JSON from disk (public access)
configRoute.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const config = loadConfig();
        const filteredConfig = filterSensitiveData(config);
        console.log('loading layout');
        res.status(StatusCodes.OK).json(filteredConfig);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error reading config file',
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
        const updates = req.body; // Get all key-value pairs from the request
        const existingConfig: Config = loadConfig(); // Load current config

        // Merge sensitive data back from existing config
        const mergedUpdates = mergeSensitiveData(updates, existingConfig);

        // Apply updates dynamically
        Object.keys(mergedUpdates).forEach((key) => {
            if (mergedUpdates[key] !== undefined) {
                (existingConfig as any)[key] = mergedUpdates[key]; // Update the key dynamically
            }
        });

        // Ensure security flags are present after merge (for any items that might have been missed)
        const configWithFlags = ensureSecurityFlags(existingConfig);

        // Save the updated config to file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configWithFlags, null, 2), 'utf-8');

        // Return filtered config to frontend
        const filteredConfig = filterSensitiveData(configWithFlags);
        res.status(StatusCodes.OK).json({ message: 'Config saved successfully', updatedConfig: filteredConfig });
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
