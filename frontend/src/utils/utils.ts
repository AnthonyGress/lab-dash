import { BACKEND_URL } from '../constants/constants';

export const getIconPath = (icon: string | { path: string; source?: string }) => {
    if (!icon) return '';

    const path = typeof icon === 'string' ? icon : icon?.path;
    const source = typeof icon === 'object' ? icon.source : undefined;

    if (!path) return '';

    // If it's a custom uploaded icon, use the path directly
    if (source === 'custom' || path.startsWith('/uploads/')) {
        return `${BACKEND_URL}${path}`;
    }

    // Otherwise it's a built-in icon
    return `${BACKEND_URL}/icons/${path.replace('./assets/', '')}`;
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

export const isValidHttpUrl = (url: string) => {
    const httpHttpsPattern = /^https?:\/\/\S+$/i;
    return httpHttpsPattern.test(url);
};

/**
 * Formats a number with comma as thousands separator
 * @param value - The number to format
 * @returns Formatted number as string with commas
 */
export const formatNumber = (value: number): string => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Checks if a string appears to be encrypted (starts with ENC: prefix)
 * @param text - The string to check
 * @returns True if the string starts with 'ENC:', false otherwise
 */
export const isEncrypted = (text: string): boolean => {
    return text?.startsWith('ENC:') || false;
};

/**
 * Formats bytes to a human-readable string with units (B, KB, MB, GB, TB)
 * @param bytes - Number of bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate unit
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};
