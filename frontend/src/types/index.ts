export enum ITEM_TYPE {
    WEATHER_WIDGET = 'weather-widget',
    DATE_TIME_WIDGET = 'date-time-widget',
    SYSTEM_MONITOR_WIDGET = 'system-monitor-widget',
    APP_SHORTCUT = 'app-shortcut'
}

export type DashboardItem = {
    id: string;
    label: string;
    type: string;
    url?: string;
    icon?: string;
}

export type NewItem = {
    name?: string;
    icon?: string;
    url?: string;
    label?: string;
    type: string;
}

export type Icon = {
    path: string;
    name: string;
    source?: string;
    guidelines?: string;
}
