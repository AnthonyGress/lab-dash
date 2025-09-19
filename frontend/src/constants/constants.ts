import { ITEM_TYPE } from '../types';

export const initialItems = [
    { id: 'weather-widget', label: 'Weather Widget', type: ITEM_TYPE.WEATHER_WIDGET },
    { id: 'time-date-widget', label: 'Time & Date Widget', type: ITEM_TYPE.DATE_TIME_WIDGET },
    { id: 'system-monitor-widget', label: 'System Monitor Widget', type: ITEM_TYPE.SYSTEM_MONITOR_WIDGET },
    ...Array.from({ length: 18 }, (_, index) => ({
        id: `item-${index + 1}`,
        label: `Item ${index + 1}`,
        type: 'blank-app',
    })),
];

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (
    import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000'
);

export const FIFTEEN_MIN_IN_MS = 900000;
export const TWO_MIN_IN_MS = 120000;
export const THIRTY_SEC_IN_MS = 30000;
export const TWENTY_SEC_IN_MS = 20000;
