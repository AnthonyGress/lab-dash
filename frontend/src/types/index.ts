export enum ITEM_TYPE {
    WEATHER_WIDGET = 'weather-widget',
    DATE_TIME_WIDGET = 'date-time-widget',
    SYSTEM_MONITOR_WIDGET = 'system-monitor-widget',
    APP_SHORTCUT = 'app-shortcut',
    BLANK_APP = 'blank-app',
    BLANK_WIDGET = 'blank-widget',
    BLANK_ROW = 'blank-row'
}

export type NewItem = {
    name?: string;
    icon?: { path: string; name: string };
    url?: string;
    label: string;
    type: string;
    showLabel?: boolean;
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

export type Config = {
    layout: {
        desktop: DashboardItem[];
        mobile: DashboardItem[];
    },
    title?: string;
    backgroundImage?: string;
    search?: boolean;
    searchProvider?: SearchProvider;
    isSetupComplete?: boolean;
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
};

