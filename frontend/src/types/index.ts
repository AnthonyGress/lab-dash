export enum ITEM_TYPE {
    WEATHER_WIDGET = 'weather-widget',
    DATE_TIME_WIDGET = 'date-time-widget',
    SYSTEM_MONITOR_WIDGET = 'system-monitor-widget',
    APP_SHORTCUT = 'app-shortcut',
    BLANK_APP = 'blank-app',
    BLANK_WIDGET = 'blank-widget',

}

export type DashboardItem = {
    id: string;
    label: string;
    type: string;
    url?: string;
    icon?: { path: string; name: string, source?: string };
    showName?: boolean;
}

export type NewItem = {
    name?: string;
    icon?: { path: string; name: string };
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
