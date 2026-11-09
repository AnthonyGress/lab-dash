import { getConfig } from '../services/config-store';
import { DashboardItem } from '../types';
import { decrypt, isEncrypted } from './crypto';

type ItemMatch = {
    item: DashboardItem;
    isPublic: boolean;
};

/**
 * Visits every saved item, group children included, in lookup order: home desktop,
 * home mobile, then each page. `isPublic` is false when the item, its group, or its
 * page is admin-only, the same rule GET /api/config uses to hide items from guests.
 */
const walkItems = (visit: (item: any, isPublic: boolean) => void): void => {
    const config = getConfig();

    const walk = (items: any[] = [], parentIsPublic: boolean): void => {
        for (const item of items) {
            const isPublic = parentIsPublic && item.adminOnly !== true;
            visit(item, isPublic);

            if (item.type === 'group-widget') {
                walk(item.config?.items, isPublic);
            }
        }
    };

    walk(config.layout?.desktop, true);
    walk(config.layout?.mobile, true);
    for (const page of config.pages ?? []) {
        walk(page.layout?.desktop, !page.adminOnly);
        walk(page.layout?.mobile, !page.adminOnly);
    }
};

const findItemMatches = (itemId: string): ItemMatch[] => {
    const matches: ItemMatch[] = [];

    walkItems((item, isPublic) => {
        // Direct match
        if (item.id === itemId) {
            matches.push({ item, isPublic });
            return;
        }

        // Check if this is a dual widget and the itemId is for a position-specific widget
        if (item.type === 'dual-widget' && itemId.startsWith(item.id + '-')) {
            const position = itemId.endsWith('-top') ? 'top' : 'bottom';
            const positionWidget = position === 'top' ? item.config?.topWidget : item.config?.bottomWidget;

            if (positionWidget) {
                // Use a synthetic item with the position-specific config
                matches.push({
                    item: {
                        id: itemId,
                        type: positionWidget.type,
                        config: positionWidget.config
                    } as DashboardItem,
                    isPublic
                });
            }
        }
    });

    return matches;
};

/**
 * Find a dashboard item by its ID across all layouts and pages
 */
export const findItemById = (itemId: string): DashboardItem | null => {
    return findItemMatches(itemId)[0]?.item ?? null;
};

/**
 * True when a guest can see this item in at least one layout.
 */
export const isItemPublic = (itemId: string): boolean => {
    return findItemMatches(itemId).some(match => match.isPublic);
};

const normalizeMac = (mac: unknown): string => String(mac ?? '').toLowerCase().replace(/-/g, ':');

/**
 * True when a publicly visible shortcut is configured to wake this MAC address.
 */
export const isPublicWakeTarget = (mac: string): boolean => {
    let allowed = false;

    walkItems((item, isPublic) => {
        // Group children keep the address on the item itself
        const savedMac = item.config?.macAddress ?? item.macAddress;
        if (isPublic && savedMac && normalizeMac(savedMac) === normalizeMac(mac)) {
            allowed = true;
        }
    });

    return allowed;
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
