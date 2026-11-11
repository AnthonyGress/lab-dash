// @vitest-environment jsdom
// BACKEND_URL reads window.location when VITE_BACKEND_URL is not set, so the
// constants module needs a browser-like global before it can be imported
import { describe, expect, it } from 'vitest';

import { BACKEND_URL } from '../../src/constants/constants';
import {
    convertBytesToGB,
    convertSecondsToUptime,
    formatBytes,
    formatNumber,
    getIconPath,
    isEncrypted,
    isValidHttpUrl,
} from '../../src/utils/utils';

describe('getIconPath', () => {
    it('serves a built-in icon from the backend icons folder', () => {
        expect(getIconPath('plex.svg')).toBe(`${BACKEND_URL}/icons/plex.svg`);
    });

    it('strips the ./assets/ prefix that older configs saved', () => {
        expect(getIconPath('./assets/plex.svg')).toBe(`${BACKEND_URL}/icons/plex.svg`);
    });

    it('accepts an icon object and uses its path', () => {
        expect(getIconPath({ path: 'plex.svg' })).toBe(`${BACKEND_URL}/icons/plex.svg`);
        expect(getIconPath({ path: './assets/plex.svg' })).toBe(`${BACKEND_URL}/icons/plex.svg`);
    });

    it('serves a custom icon straight from its path', () => {
        expect(getIconPath({ path: '/custom/logo.png', source: 'custom' })).toBe(`${BACKEND_URL}/custom/logo.png`);
    });

    it('serves anything under /uploads/ straight from its path', () => {
        expect(getIconPath('/uploads/logo.png')).toBe(`${BACKEND_URL}/uploads/logo.png`);
        expect(getIconPath({ path: '/uploads/logo.png' })).toBe(`${BACKEND_URL}/uploads/logo.png`);
    });

    it('gives an empty string when there is no icon or no path', () => {
        expect(getIconPath('')).toBe('');
        expect(getIconPath({ path: '' })).toBe('');
        expect(getIconPath({} as { path: string })).toBe('');
        expect(getIconPath(null as unknown as string)).toBe('');
        expect(getIconPath(undefined as unknown as string)).toBe('');
    });
});

describe('convertBytesToGB', () => {
    it('shows nothing stored as 0.00 GB, including a negative size', () => {
        expect(convertBytesToGB(0)).toBe('0.00 GB');
        expect(convertBytesToGB(-1)).toBe('0.00 GB');
        expect(convertBytesToGB(0, 0)).toBe('0 GB');
        expect(convertBytesToGB(-1, 1)).toBe('0.0 GB');
    });

    it('divides by a decimal gigabyte and rounds to two places', () => {
        expect(convertBytesToGB(1e9)).toBe('1.00 GB');
        expect(convertBytesToGB(1.5e9)).toBe('1.50 GB');
        expect(convertBytesToGB(1234567890)).toBe('1.23 GB');
        expect(convertBytesToGB(1236000000)).toBe('1.24 GB');
    });

    it('rounds to the number of places asked for', () => {
        expect(convertBytesToGB(1234567890, 3)).toBe('1.235 GB');
        expect(convertBytesToGB(1e9, 0)).toBe('1 GB');
    });
});

describe('convertSecondsToUptime', () => {
    it('rejects a negative duration', () => {
        expect(convertSecondsToUptime(-1)).toBe('Invalid input');
    });

    it('reports anything under a minute as 0 minutes', () => {
        expect(convertSecondsToUptime(0)).toBe('0 minutes');
        expect(convertSecondsToUptime(59)).toBe('0 minutes');
    });

    it('uses the singular for exactly one of a unit', () => {
        expect(convertSecondsToUptime(60)).toBe('1 minute');
        expect(convertSecondsToUptime(3600)).toBe('1 hour');
        expect(convertSecondsToUptime(86400)).toBe('1 day');
    });

    it('uses the plural otherwise', () => {
        expect(convertSecondsToUptime(120)).toBe('2 minutes');
        expect(convertSecondsToUptime(7200)).toBe('2 hours');
        expect(convertSecondsToUptime(172800)).toBe('2 days');
    });

    it('joins days, hours and minutes and drops the seconds', () => {
        expect(convertSecondsToUptime(2 * 86400 + 3 * 3600 + 4 * 60 + 59)).toBe('2 days, 3 hours, 4 minutes');
    });

    it('leaves out a unit that is zero', () => {
        expect(convertSecondsToUptime(86400 + 60)).toBe('1 day, 1 minute');
    });
});

describe('isValidHttpUrl', () => {
    it('accepts http and https in any case', () => {
        expect(isValidHttpUrl('http://example.com')).toBe(true);
        expect(isValidHttpUrl('https://example.com/path?q=1#top')).toBe(true);
        expect(isValidHttpUrl('HTTPS://EXAMPLE.COM')).toBe(true);
        expect(isValidHttpUrl('Http://192.168.1.10:8080')).toBe(true);
    });

    it('rejects other schemes, bare hosts and anything with whitespace', () => {
        expect(isValidHttpUrl('ftp://example.com')).toBe(false);
        expect(isValidHttpUrl('example.com')).toBe(false);
        expect(isValidHttpUrl('http://exa mple.com')).toBe(false);
        expect(isValidHttpUrl('http://')).toBe(false);
        expect(isValidHttpUrl('')).toBe(false);
    });
});

describe('formatNumber', () => {
    it('separates thousands with commas', () => {
        expect(formatNumber(1000)).toBe('1,000');
        expect(formatNumber(1234567)).toBe('1,234,567');
        expect(formatNumber(-1234567)).toBe('-1,234,567');
    });

    it('leaves numbers under a thousand alone', () => {
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(999)).toBe('999');
    });

    it('keeps the fractional part intact', () => {
        expect(formatNumber(1234.56)).toBe('1,234.56');
        expect(formatNumber(0.5)).toBe('0.5');
        expect(formatNumber(1234.5678)).toBe('1,234.5678');
        expect(formatNumber(0.123456)).toBe('0.123456');
        expect(formatNumber(-9876543.210987)).toBe('-9,876,543.210987');
    });
});

describe('isEncrypted', () => {
    it('recognises the ENC: prefix', () => {
        expect(isEncrypted('ENC:abc123')).toBe(true);
    });

    it('is strict about the prefix', () => {
        expect(isEncrypted('abc123')).toBe(false);
        expect(isEncrypted('enc:abc123')).toBe(false);
        expect(isEncrypted(' ENC:abc123')).toBe(false);
        expect(isEncrypted('')).toBe(false);
    });

    it('treats a missing value as not encrypted', () => {
        expect(isEncrypted(undefined as unknown as string)).toBe(false);
        expect(isEncrypted(null as unknown as string)).toBe(false);
    });
});

describe('formatBytes', () => {
    it('shows zero as 0 B', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('treats a negative or missing size as nothing', () => {
        expect(formatBytes(-1024)).toBe('0 B');
        expect(formatBytes(NaN)).toBe('0 B');
    });

    it('stays in bytes below one byte and in petabytes past the table', () => {
        expect(formatBytes(0.5)).toBe('0.5 B');
        expect(formatBytes(1024 ** 6)).toBe('1024 PB');
    });

    it('steps up a unit every 1024', () => {
        expect(formatBytes(1023)).toBe('1023 B');
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1024 ** 2)).toBe('1 MB');
        expect(formatBytes(1024 ** 3)).toBe('1 GB');
        expect(formatBytes(1024 ** 4)).toBe('1 TB');
        expect(formatBytes(1024 ** 5)).toBe('1 PB');
    });

    it('rounds to two places by default', () => {
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(1234567)).toBe('1.18 MB');
    });

    it('rounds to the number of places asked for', () => {
        expect(formatBytes(1536, 0)).toBe('2 KB');
        expect(formatBytes(1234567, 1)).toBe('1.2 MB');
        expect(formatBytes(1234567, 3)).toBe('1.177 MB');
    });

    it('drops trailing zeros', () => {
        expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
        expect(formatBytes(1024 * 1024 * 1.5, 4)).toBe('1.5 MB');
    });
});
