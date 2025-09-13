import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

export const iconsRoute = Router();

const readFile = promisify(fs.readFile);

// Icon cache interface
interface CachedIcon {
    data: string;
    mimeType: string;
    timestamp: number;
    size: number;
}

// In-memory icon cache
class IconCache {
    private cache = new Map<string, CachedIcon>();
    private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache size
    private currentCacheSize = 0;

    set(key: string, data: string, mimeType: string): void {
        const size = Buffer.byteLength(data, 'base64');

        console.log(`CACHE SET: Caching icon: ${key}, size: ${size} bytes, mimeType: ${mimeType}`);

        // Check if adding this would exceed cache size limit
        if (this.currentCacheSize + size > this.MAX_CACHE_SIZE) {
            console.log('CACHE SET: Cache size limit exceeded, evicting oldest entries');
            this.evictOldest();
        }

        // Remove existing entry if it exists
        if (this.cache.has(key)) {
            const existing = this.cache.get(key)!;
            this.currentCacheSize -= existing.size;
            console.log(`CACHE SET: Replaced existing entry for ${key}`);
        }

        this.cache.set(key, {
            data,
            mimeType,
            timestamp: Date.now(),
            size
        });

        this.currentCacheSize += size;
        console.log(`CACHE SET: Successfully cached ${key}. Total size: ${this.currentCacheSize}, Count: ${this.cache.size}`);
    }

    get(key: string): CachedIcon | null {
        const item = this.cache.get(key);

        if (!item) {
            console.log(`CACHE GET: Cache miss for icon: ${key}`);
            return null;
        }

        console.log(`CACHE GET: Cache hit for icon: ${key}`);
        return item;
    }

    private evictOldest(): void {
        // Remove the oldest 25% of cache entries
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        const toRemove = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < toRemove && i < entries.length; i++) {
            const [key, value] = entries[i];
            this.cache.delete(key);
            this.currentCacheSize -= value.size;
        }
    }

    clear(): void {
        this.cache.clear();
        this.currentCacheSize = 0;
    }

    getStats(): { size: number; count: number; maxSize: number } {
        return {
            size: this.currentCacheSize,
            count: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE
        };
    }
}

const iconCache = new IconCache();

interface BulkIconRequest {
    iconPaths: string[];
}

// Bulk load icons endpoint
iconsRoute.post('/bulk', async (req: Request, res: Response) => {
    try {
        const { iconPaths }: BulkIconRequest = req.body;

        if (!iconPaths || !Array.isArray(iconPaths)) {
            res.status(400).json({ message: 'iconPaths must be an array' });
            return;
        }

        const icons: { [key: string]: string } = {};
        const errors: string[] = [];

        // Process all icon requests in parallel
        const iconPromises = iconPaths.map(async (iconPath: string) => {
            try {
                console.log(`Processing icon: ${iconPath}`);

                // Check cache first
                const cached = iconCache.get(iconPath);
                if (cached) {
                    icons[iconPath] = `data:${cached.mimeType};base64,${cached.data}`;
                    return;
                }

                // Sanitize the path
                const sanitizedPath = iconPath.replace('./assets/', '');

                // Determine the full file path
                let fullPath: string;

                if (iconPath.startsWith('/uploads/app-icons/')) {
                    // Custom uploaded icon - remove leading slash and join with public
                    fullPath = path.join('public', iconPath.substring(1));
                } else if (sanitizedPath.includes('app-icons/')) {
                    // Legacy handling for app-icons paths
                    fullPath = path.join('public', 'uploads', sanitizedPath);
                } else {
                    // Standard asset icon from npm package
                    fullPath = path.join('node_modules', '@loganmarchione', 'homelab-svg-assets', 'assets', sanitizedPath);
                }

                console.log(`Looking for icon at: ${fullPath}`);

                // Check if file exists
                if (!fs.existsSync(fullPath)) {
                    console.log(`File not found: ${fullPath}`);
                    errors.push(`Icon not found: ${iconPath}`);
                    return;
                }

                console.log(`Reading file: ${fullPath}`);
                // Read file and convert to base64
                const fileBuffer = await readFile(fullPath);
                const ext = path.extname(fullPath).toLowerCase();

                // Determine MIME type
                let mimeType = 'image/png'; // default
                switch (ext) {
                case '.jpg':
                case '.jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case '.png':
                    mimeType = 'image/png';
                    break;
                case '.gif':
                    mimeType = 'image/gif';
                    break;
                case '.svg':
                    mimeType = 'image/svg+xml';
                    break;
                case '.webp':
                    mimeType = 'image/webp';
                    break;
                }

                const base64Data = fileBuffer.toString('base64');

                console.log(`About to cache icon: ${iconPath}, base64 size: ${base64Data.length}`);

                // Cache the icon data - this should ALWAYS happen for found files
                iconCache.set(iconPath, base64Data, mimeType);

                // Store as data URL for frontend
                icons[iconPath] = `data:${mimeType};base64,${base64Data}`;

                console.log(`Successfully processed and cached icon: ${iconPath}`);

            } catch (error) {
                console.error(`Error loading icon ${iconPath}:`, error);
                errors.push(`Failed to load icon: ${iconPath}`);
            }
        });        await Promise.all(iconPromises);

        // Return the results
        res.json({
            icons,
            errors: errors.length > 0 ? errors : undefined,
            loaded: Object.keys(icons).length,
            total: iconPaths.length,
            cacheStats: iconCache.getStats()
        });

    } catch (error) {
        console.error('Error in bulk icon loading:', error);
        res.status(500).json({
            message: 'Failed to load icons in bulk',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Cache management endpoints
iconsRoute.get('/cache/stats', (req: Request, res: Response) => {
    try {
        const stats = iconCache.getStats();
        res.json({
            ...stats,
            sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            maxSizeFormatted: `${(stats.maxSize / 1024 / 1024).toFixed(2)} MB`,
            utilizationPercent: ((stats.size / stats.maxSize) * 100).toFixed(2) + '%'
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({
            message: 'Failed to get cache statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

iconsRoute.delete('/cache', (req: Request, res: Response) => {
    try {
        iconCache.clear();
        res.json({
            message: 'Icon cache cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            message: 'Failed to clear cache',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default iconsRoute;
