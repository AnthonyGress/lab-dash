import { ITEM_TYPE } from '../types';

export const initialItems = [
    { id: 'weather-widget', label: 'Weather Widget', type: ITEM_TYPE.WEATHER_WIDGET },
    { id: 'time-date-widget', label: 'Time & Date Widget', type: ITEM_TYPE.DATE_TIME_WIDGET },
    { id: 'system-monitor-widget', label: 'System Monitor Widget', type: ITEM_TYPE.SYSTEM_MONITOR_WIDGET },
    ...Array.from({ length: 6 }, (_, index) => ({
        id: `item-${index + 1}`,
        label: `Item ${index + 1}`,
        type: 'item',
    })),
];

export const BACKEND_URL = 'http://localhost:5000';
