// Types for bulk loading operations

export interface IconRequest {
    id: string;
    type: 'custom' | 'standard';
    iconUrl?: string;
}

export interface IconData {
    id: string;
    iconData: string; // base64 encoded
    mimeType: string;
}

export interface IconError {
    id: string;
    error: string;
}

export interface CacheStats {
    size: number;
    count: number;
    maxSize: number;
    sizeFormatted?: string;
    maxSizeFormatted?: string;
    utilizationPercent?: string;
}

export interface BulkIconResponse {
    icons: { [key: string]: string };
    errors?: string[];
    loaded: number;
    total: number;
    cacheStats?: CacheStats;
}

export interface BulkIconResponseLegacy {
    loadedIcons: IconData[];
    erroredIcons: IconError[];
    metadata: {
        totalRequested: number;
        totalLoaded: number;
        totalErrored: number;
    };
}

export interface CacheStatsResponse {
    size: number;
    count: number;
    maxSize: number;
    sizeFormatted: string;
    maxSizeFormatted: string;
    utilizationPercent: string;
}

export interface CacheClearResponse {
    message: string;
}

export interface WidgetRequest {
    id: string;
    type: string;
    config?: Record<string, unknown>;
}

export interface WidgetData {
    id: string;
    data: Record<string, unknown>;
}

export interface WidgetError {
    id: string;
    error: string;
}

export interface BulkWidgetResponse {
    loadedWidgets: WidgetData[];
    erroredWidgets: WidgetError[];
    metadata: {
        totalRequested: number;
        totalLoaded: number;
        totalErrored: number;
    };
}
