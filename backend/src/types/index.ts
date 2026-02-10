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

export type Page = {
    id: string;
    name: string;
    adminOnly?: boolean;
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
    searchProvider?: string;
    isSetupComplete?: boolean;
    lastSeenVersion?: string;
    notes?: Note[];
    themeColor?: string;
    showInternetIndicator?: boolean;
    showIP?: boolean;
    ipDisplayType?: 'wan' | 'lan' | 'both';
}

export type Note = {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    fontSize?: string;
}

export type DashboardLayout = {
    desktop: DashboardItem[];
    mobile: DashboardItem[];
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
        [key: string]: any;
    };
};

