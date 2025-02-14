import { BACKEND_URL } from '../constants/constants';

export const getIconPath = (icon: string | { path: string }) => {
    const path = typeof icon === 'string' ? icon : icon?.path;
    return path ? `${BACKEND_URL}/icons/${path.replace('./assets/', '')}` : '';
};

/**
 * Converts bytes to gigabytes (GB) and rounds the result.
 * @param bytes - The number of bytes to convert.
 * @param decimalPlaces - Number of decimal places to round to (default: 2).
 * @returns The size in GB as a string with specified decimal places.
 */
export const convertBytesToGB = (bytes: number, decimalPlaces: number = 2): string => {
    if (bytes <= 0) return '0.00 GB';

    const gb = bytes / 1e9;
    return `${gb.toFixed(decimalPlaces)} GB`;
};

/**
 * Converts seconds into a formatted string: X days, Y hours, Z minutes.
 * @param seconds - The total number of seconds to convert.
 * @returns A string representing the time in days, hours, and minutes.
 */
export const convertSecondsToUptime = (seconds: number): string => {
    if (seconds < 0) return 'Invalid input';

    const days = Math.floor(seconds / 86400); // 86400 seconds in a day
    const hours = Math.floor((seconds % 86400) / 3600); // 3600 seconds in an hour
    const minutes = Math.floor((seconds % 3600) / 60); // 60 seconds in a minute

    const result = [];
    if (days > 0) result.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) result.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) result.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

    return result.length > 0 ? result.join(', ') : '0 minutes';
};
