import fsSync from 'fs';
import path from 'path';

import { Config, DashboardItem } from '../types';
import { decrypt, isEncrypted } from './crypto';

const CONFIG_FILE = path.join(__dirname, '../config/config.json');

/**
 * Load the configuration from disk
 */
export const loadConfig = (): Config => {
    if (fsSync.existsSync(CONFIG_FILE)) {
        return JSON.parse(fsSync.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    return { layout: { desktop: [], mobile: [] } };
};

/**
 * Find a dashboard item by its ID across all layouts and pages
 */
export const findItemById = (itemId: string): DashboardItem | null => {
    const config = loadConfig();

    // Helper function to search for item in a layout array
    const searchInLayout = (items: any[]): DashboardItem | null => {
        for (const item of items) {
            // Direct match
            if (item.id === itemId) {
                return item;
            }

            // Check if this is a dual widget and the itemId is for a position-specific widget
            if (item.type === 'dual-widget' && itemId.startsWith(item.id + '-')) {
                const position = itemId.endsWith('-top') ? 'top' : 'bottom';
                const positionWidget = position === 'top' ? item.config?.topWidget : item.config?.bottomWidget;

                if (positionWidget) {
                    // Return a synthetic item with the position-specific config
                    return {
                        id: itemId,
                        type: positionWidget.type,
                        config: positionWidget.config
                    } as DashboardItem;
                }
            }

            // Check group widgets
            if (item.type === 'group-widget' && item.config?.items) {
                const groupItem = searchInLayout(item.config.items);
                if (groupItem) return groupItem;
            }
        }
        return null;
    };

    // Search in main desktop layout
    let foundItem = searchInLayout(config.layout.desktop);
    if (foundItem) return foundItem;

    // Search in main mobile layout
    foundItem = searchInLayout(config.layout.mobile);
    if (foundItem) return foundItem;

    // Search in pages if they exist
    if (config.pages) {
        for (const page of config.pages) {
            // Search in page desktop layout
            foundItem = searchInLayout(page.layout.desktop);
            if (foundItem) return foundItem;

            // Search in page mobile layout
            foundItem = searchInLayout(page.layout.mobile);
            if (foundItem) return foundItem;
        }
    }

    return null;
};

/**
 * Extract connection information from an item's config
 * This function works with the actual stored config (not the filtered frontend config)
 * so it has access to the real password and apiToken values
 */
export const getConnectionInfo = (item: DashboardItem) => {
    const config = item.config || {};

    // Decrypt sensitive values if they are encrypted
    let password = config.password;
    let apiToken = config.apiToken;
    let apiKey = config.apiKey;

    if (password && isEncrypted(password)) {
        password = decrypt(password);
    }

    if (apiToken && isEncrypted(apiToken)) {
        apiToken = decrypt(apiToken);
    }

    if (apiKey && isEncrypted(apiKey)) {
        apiKey = decrypt(apiKey);

        if (!apiKey) {
            console.error(`API key decryption failed for item ${item.id}! Check if the SECRET environment variable is set correctly.`);
        }
    }

    return {
        // Spread original config first
        ...config,
        // Then override with decrypted values (these will take precedence)
        host: config.host || 'localhost',
        port: config.port,
        ssl: config.ssl || false,
        username: config.username,
        password: password, // This will be the decrypted password
        apiToken: apiToken, // This will be the decrypted apiToken
        apiKey: apiKey, // This will be the decrypted apiKey for media servers
        // For torrent clients
        clientType: config.clientType,
        // For other services
        displayName: config.displayName,
        // Security flags (these may or may not be present depending on context)
        _hasPassword: config._hasPassword,
        _hasApiToken: config._hasApiToken
    };
};

/**
 * Get connection info for an item by ID
 */
export const getItemConnectionInfo = (itemId: string) => {
    const item = findItemById(itemId);
    if (!item) {
        console.error(`Item with ID ${itemId} not found in configuration`);
        throw new Error(`Item with ID ${itemId} not found`);
    }

    return getConnectionInfo(item);
};
