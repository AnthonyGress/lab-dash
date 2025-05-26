export enum ITEM_TYPE {
    WEATHER_WIDGET = 'weather-widget',
    DATE_TIME_WIDGET = 'date-time-widget',
    SYSTEM_MONITOR_WIDGET = 'system-monitor-widget',
    TORRENT_CLIENT = 'torrent-client',
    PIHOLE_WIDGET = 'pihole-widget',
    DUAL_WIDGET = 'dual-widget',
    GROUP_WIDGET = 'group-widget',
    APP_SHORTCUT = 'app-shortcut',
    PLACEHOLDER = 'placeholder',
    // Legacy placeholder types - keeping for backward compatibility
    BLANK_APP = 'blank-app',
    BLANK_WIDGET = 'blank-widget',
    BLANK_ROW = 'blank-row',
    PAGE = 'page'
}

export enum TORRENT_CLIENT_TYPE {
    QBITTORRENT = 'qbittorrent',
    DELUGE = 'deluge',
    TRANSMISSION = 'transmission'
}

export type NewItem = {
    name?: string;
    icon?: { path: string; name: string; source?: string };
    url?: string;
    label: string;
    type: string;
    showLabel?: boolean;
    adminOnly?: boolean;
    config?: {
        temperatureUnit?: string;
        healthUrl?: string;
        healthCheckType?: string;
        [key: string]: any;
    };
}

export type Icon = {
    path: string;
    name: string;
    source?: string;
    guidelines?: string;
}

export type SearchProvider = {
    name: string;
    url: string;
}

export type Page = {
    id: string;
    name: string;
    layout: {
        desktop: DashboardItem[];
        mobile: DashboardItem[];
    };
}

export type Config = {
    layout: {
        desktop: DashboardItem[];
        mobile: DashboardItem[];
    },
    pages?: Page[];
    title?: string;
    backgroundImage?: string;
    search?: boolean;
    searchProvider?: SearchProvider;
    isSetupComplete?: boolean;
    lastSeenVersion?: string;
}

export type UploadImageResponse = {
    message: string;
    filePath: string;
}

export type DashboardLayout = {
    layout: {
        desktop: DashboardItem[];
        mobile: DashboardItem[];
    }
}

export type DashboardItem = {
    id: string;
    label: string;
    type: string;
    url?: string;
    icon?: { path: string; name: string; source?: string; };
    showLabel?: boolean;
    adminOnly?: boolean;
    config?: {
        temperatureUnit?: string;
        healthUrl?: string;
        healthCheckType?: string;
        [key: string]: any;
    };
};

