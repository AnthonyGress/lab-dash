import { Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';

import { authenticateToken, getOptionalUser, requireAdmin } from '../middleware/auth.middleware';
import { getConfig, updateConfig } from '../services/config-store';
import { Config } from '../types';
import { BackupService } from '../utils/backup.service';
import { encrypt, isEncrypted } from '../utils/crypto';

export const configRoute = Router();

// Helper function to check if user is authenticated and is admin
const isUserAdmin = (req: Request): boolean => getOptionalUser(req)?.role === 'admin';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = any;

/** Credentials the browser never gets back; it receives `_has<Field>` flags in their place. */
const SECRET_FIELDS = ['apiKey', 'apiToken', 'password'];

/**
 * AdGuard Home logs in with a username that is stored encrypted, so it is a secret too.
 * Half of a dual widget saved without a type is treated the same way, to be safe.
 */
const secretFieldsOf = (type: string | undefined, isHalfOfDualWidget = false): string[] => (
    type === 'adguard-widget' || (isHalfOfDualWidget && !type) ? [...SECRET_FIELDS, 'username'] : SECRET_FIELDS
);

const flagOf = (field: string): string => `_has${field[0].toUpperCase()}${field.slice(1)}`;

const isFlag = (key: string): boolean => key.startsWith('_has');

type ItemConfig = { config: Item; type?: string; isHalfOfDualWidget: boolean };

/** The config objects an item carries credentials in: its own and, for a dual widget, those of its two halves. */
const configsOf = (item: Item): ItemConfig[] => {
    const found: ItemConfig[] = [];
    if (item?.config && typeof item.config === 'object') {
        found.push({ config: item.config, type: item.type, isHalfOfDualWidget: false });
        for (const half of ['topWidget', 'bottomWidget']) {
            const widget = item.config[half];
            if (widget?.config && typeof widget.config === 'object') {
                found.push({ config: widget.config, type: widget.type, isHalfOfDualWidget: true });
            }
        }
    }
    return found;
};

/** Visits every item of the home layouts and every page, including the children of group widgets. */
const eachItem = (config: Item, visit: (item: Item) => void): void => {
    const visitAll = (items: unknown): void => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            visit(item);
            if (item.type === 'group-widget') visitAll(item.config?.items);
        }
    };

    visitAll(config?.layout?.desktop);
    visitAll(config?.layout?.mobile);
    for (const page of Array.isArray(config?.pages) ? config.pages : []) {
        visitAll(page?.layout?.desktop);
        visitAll(page?.layout?.mobile);
    }
};

const clone = (value: Item): Item => JSON.parse(JSON.stringify(value));

/**
 * The config as the browser may see it: every credential replaced by a flag that
 * says one is stored, so forms can show "set" without ever receiving the value.
 */
const filterSensitiveData = (config: Item): Item => {
    const filtered = clone(config);

    eachItem(filtered, item => {
        for (const { config: itemConfig, type, isHalfOfDualWidget } of configsOf(item)) {
            for (const field of secretFieldsOf(type, isHalfOfDualWidget)) {
                if (itemConfig[field]) {
                    itemConfig[flagOf(field)] = true;
                    delete itemConfig[field];
                }
            }
        }
    });

    if (Array.isArray(filtered.pages)) {
        filtered.pages = filtered.pages.map((page: Item) => ({
            ...page,
            layout: { desktop: page?.layout?.desktop ?? [], mobile: page?.layout?.mobile ?? [] }
        }));
    }

    return filtered;
};

/**
 * Puts stored credentials back into a config the browser sends. A flag in place
 * of a value keeps the stored one; a value replaces it; neither drops it. An item
 * marked `_duplicatedFrom` copies the credentials of its source. Items are found
 * by id wherever they were, so one that moved between pages or groups keeps its secrets.
 */
const restoreSensitiveData = (newConfig: Item, existingConfig: Item): Item => {
    const restored = clone(newConfig);

    const existingItems = new Map<string, Item>();
    eachItem(existingConfig, item => {
        // The first copy wins: an item shown on desktop and mobile is the same item
        if (item.id && !existingItems.has(item.id)) existingItems.set(item.id, item);
    });

    const matchingConfigs = (item: Item | undefined, index: number): Item | undefined => (
        item ? configsOf(item)[index]?.config : undefined
    );

    eachItem(restored, item => {
        const existing = existingItems.get(item.id);
        const source = item.config?._duplicatedFrom ? existingItems.get(item.config._duplicatedFrom) : undefined;

        configsOf(item).forEach(({ config: itemConfig, type, isHalfOfDualWidget }, index) => {
            const existingValues = matchingConfigs(existing, index);
            const sourceValues = matchingConfigs(source, index);

            for (const field of secretFieldsOf(type, isHalfOfDualWidget)) {
                if (sourceValues?.[field]) {
                    itemConfig[field] = sourceValues[field];
                } else if (itemConfig[flagOf(field)] && !itemConfig[field] && existingValues?.[field]) {
                    itemConfig[field] = existingValues[field];
                }
            }

            // Flags and the duplication marker are for the wire only
            for (const key of Object.keys(itemConfig)) {
                if (isFlag(key)) delete itemConfig[key];
            }
            delete itemConfig._duplicatedFrom;
        });
    });

    return restored;
};

/** Encrypts any credential that arrived in plain text, so the file never holds one. */
const encryptSensitiveData = (config: Item): Item => {
    eachItem(config, item => {
        for (const { config: itemConfig, type, isHalfOfDualWidget } of configsOf(item)) {
            for (const field of secretFieldsOf(type, isHalfOfDualWidget)) {
                const value = itemConfig[field];
                if (typeof value === 'string' && value && !isEncrypted(value)) {
                    itemConfig[field] = encrypt(value);
                }
            }
        }
    });
    return config;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/**
 * Merges a partial config into the stored one and saves it. Secrets the browser
 * never received (it only gets `_has...` flags) are kept from the stored config.
 */
const saveConfigUpdates = (buildUpdates: (existingConfig: Config) => any): Config => (
    updateConfig((existingConfig: Config) => {
        // Restore sensitive data from existing config before saving
        const configToSave = encryptSensitiveData(restoreSensitiveData(buildUpdates(existingConfig), existingConfig));

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
    })
);

class PageNotFoundError extends Error {}

// GET - Return the config file with sensitive data filtered and admin-only items filtered based on user role
configRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const config = getConfig();

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
        const config = getConfig();
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
        const savedConfig = saveConfigUpdates(() => req.body);

        // Return filtered config to frontend (without sensitive data)
        const filteredConfig = filterSensitiveData(savedConfig);

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

// PUT - Save one layout of one page (admin only). Used when items are added, moved or
// edited, so a save carries that layout instead of every page of the dashboard.
configRoute.put('/layout', [authenticateToken, requireAdmin], (req: Request, res: Response): void => {
    const { pageId, viewport, items } = req.body ?? {};

    const validPage = pageId === null || pageId === undefined || typeof pageId === 'string';
    if (!validPage || (viewport !== 'desktop' && viewport !== 'mobile') || !Array.isArray(items)) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'pageId, viewport and items are required' });
        return;
    }

    try {
        saveConfigUpdates(existingConfig => {
            if (!pageId) {
                return { layout: { ...existingConfig.layout, [viewport]: items } };
            }

            const pages = existingConfig.pages ?? [];
            if (!pages.some(page => page.id === pageId)) throw new PageNotFoundError();

            return {
                pages: pages.map(page => (
                    page.id === pageId ? { ...page, layout: { ...page.layout, [viewport]: items } } : page
                ))
            };
        });

        res.status(StatusCodes.OK).json({ message: 'Layout saved successfully' });
    } catch (error) {
        if (error instanceof PageNotFoundError) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Page not found' });
            return;
        }

        console.error('Error saving layout:', error);
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

        // Only an object with something in it, and a layout and pages of the right shape, is a dashboard
        const shaped = isPlainObject(importedConfig)
            && Object.keys(importedConfig).length > 0
            && (importedConfig.layout === undefined || isPlainObject(importedConfig.layout))
            && (importedConfig.pages === undefined || Array.isArray(importedConfig.pages));
        if (!shaped) {
            res.status(StatusCodes.BAD_REQUEST).json({
                message: 'Invalid configuration format'
            });
            return;
        }

        const layout = (importedConfig.layout ?? {}) as Record<string, unknown>;
        importedConfig.layout = {
            ...layout,
            desktop: Array.isArray(layout.desktop) ? layout.desktop : [],
            mobile: Array.isArray(layout.mobile) ? layout.mobile : []
        };

        // Replace the whole config with the imported one
        const savedConfig = updateConfig(() => encryptSensitiveData(importedConfig) as Config);

        // Return filtered config to frontend
        const filteredConfig = filterSensitiveData(savedConfig);
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

// POST - Encrypt a secret (password, token, API key) before it is stored in the config (admin only)
configRoute.post('/encrypt', [authenticateToken, requireAdmin], (req: Request, res: Response): void => {
    const { value } = req.body ?? {};

    if (typeof value !== 'string' || !value) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'A value to encrypt is required' });
        return;
    }

    // Don't re-encrypt if already encrypted
    res.status(StatusCodes.OK).json({ encrypted: isEncrypted(value) ? value : encrypt(value) });
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
