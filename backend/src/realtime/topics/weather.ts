import axios from 'axios';

import { RealtimeError, resolveItem } from '../access';
import { Registry } from '../registry';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const readCoordinate = (value: unknown, limit: number): number | undefined => {
    const number = typeof value === 'string' ? parseFloat(value) : value;
    return typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= limit ? number : undefined;
};

export const registerWeatherTopics = (registry: Registry): void => {
    // Current conditions and the daily forecast for the location saved on a weather widget
    registry.topic('weather.forecast', (principal, itemId) => {
        const item = resolveItem(principal, itemId, ['weather-widget']);
        const latitude = readCoordinate(item.config?.location?.latitude, 90);
        const longitude = readCoordinate(item.config?.location?.longitude, 180);
        if (latitude === undefined || longitude === undefined) {
            throw new RealtimeError('BAD_REQUEST', 'Please set a location in the widget settings');
        }

        return {
            // Widgets for the same place share one forecast
            key: `weather.forecast:${latitude.toFixed(3)}:${longitude.toFixed(3)}`,
            intervalMs: FIFTEEN_MINUTES_MS,
            read: async signal => {
                try {
                    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
                        params: {
                            latitude,
                            longitude,
                            current: 'temperature_2m,weathercode,windspeed_10m',
                            daily: 'temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset',
                            timezone: 'auto'
                        },
                        timeout: 5000,
                        signal
                    });
                    return response.data;
                } catch (error) {
                    // The hub retries with a growing delay; the widget keeps its last forecast meanwhile
                    console.error('Weather API error:', (error as Error).message);
                    throw new RealtimeError('UNAVAILABLE', 'Weather service temporarily unavailable. Please try again.');
                }
            }
        };
    });
};
