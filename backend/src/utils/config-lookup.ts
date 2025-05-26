import fsSync from 'fs';
import path from 'path';

import { Config, DashboardItem } from '../types';

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

    // Search in main desktop layout
    let foundItem = config.layout.desktop.find(item => item.id === itemId);
    if (foundItem) return foundItem;

    // Search in main mobile layout
    foundItem = config.layout.mobile.find(item => item.id === itemId);
    if (foundItem) return foundItem;

    // Search in pages if they exist
    if (config.pages) {
        for (const page of config.pages) {
            // Search in page desktop layout
            foundItem = page.layout.desktop.find(item => item.id === itemId);
            if (foundItem) return foundItem;

            // Search in page mobile layout
            foundItem = page.layout.mobile.find(item => item.id === itemId);
            if (foundItem) return foundItem;
        }
    }

    return null;
};

/**
 * Extract connection information from an item's config
 */
export const getConnectionInfo = (item: DashboardItem) => {
    const config = item.config || {};

    return {
        host: config.host || 'localhost',
        port: config.port,
        ssl: config.ssl || false,
        username: config.username,
        password: config.password,
        apiToken: config.apiToken,
        // For torrent clients
        clientType: config.clientType,
        // For other services
        displayName: config.displayName,
        // Add other common config properties as needed
        ...config
    };
};

/**
 * Get connection info for an item by ID
 */
export const getItemConnectionInfo = (itemId: string) => {
    const item = findItemById(itemId);
    if (!item) {
        throw new Error(`Item with ID ${itemId} not found`);
    }

    return getConnectionInfo(item);
};
