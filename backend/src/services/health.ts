import axios from 'axios';
import { execFile } from 'child_process';
import https from 'https';
import { isIP } from 'net';

export type HealthStatus = 'online' | 'offline';
export type HealthCheckType = 'http' | 'ping';

// Host pinged to detect internet connectivity
export const INTERNET_CHECK_HOST = '8.8.8.8';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

const isValidHostname = (hostname: string): boolean => {
    if (hostname.length === 0 || hostname.length > 253) {
        return false;
    }

    if (isIP(hostname) !== 0) {
        return true;
    }

    return hostname.split('.').every((label) => (
        /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)
    ));
};

// Helper function to ping a hostname
const pingHost = (hostname: string): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!isValidHostname(hostname)) {
            resolve(false);
            return;
        }

        execFile('ping', ['-c', '1', '-W', '1', hostname], (error) => {
            resolve(!error);
        });
    });
};

/**
 * Checks whether a service answers. For ping checks the target is a hostname,
 * otherwise a URL. Never throws: any failure counts as offline.
 */
export const checkHealth = async (
    target: string,
    type: HealthCheckType = 'http',
    signal?: AbortSignal
): Promise<HealthStatus> => {
    if (type === 'ping') {
        return await pingHost(target) ? 'online' : 'offline';
    }

    try {
        const response = await axios.get(target, {
            timeout: 10000, // 10 seconds to handle slower services
            httpsAgent,
            responseType: 'text',
            validateStatus: () => true, // Accept any HTTP status code
            signal
        });

        return response.status >= 200 && response.status < 400 ? 'online' : 'offline';
    } catch {
        return 'offline';
    }
};
