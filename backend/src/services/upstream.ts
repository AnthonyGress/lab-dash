import { RealtimeError } from '../realtime/access';
import { DashboardItem } from '../types';
import { getConnectionInfo } from '../utils/config-lookup';
import { decrypt, isEncrypted } from '../utils/crypto';

/** Where an integration lives and how to log in, with stored secrets already decrypted. */
export type UpstreamConnection = {
    /** e.g. http://192.168.1.5:8080 */
    origin: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiToken?: string;
};

const SECRET_FIELDS = ['username', 'password', 'apiKey', 'apiToken'] as const;

/** Reads host, port and credentials from a saved item. */
export const readConnection = (item: DashboardItem, defaultPort: string): UpstreamConnection => {
    const info: Record<string, any> = getConnectionInfo(item);
    // Some integrations store the username encrypted as well
    if (isEncrypted(info.username ?? '')) info.username = decrypt(info.username);

    // Decryption yields an empty string when the secret was stored with another SECRET
    if (SECRET_FIELDS.some(field => isEncrypted(item.config?.[field] ?? '') && !info[field])) {
        throw new RealtimeError(
            'UNAVAILABLE',
            'Failed to decrypt password. Please update your credentials in the widget settings.'
        );
    }

    // Clean the host to remove any protocol prefix
    const host = String(info.host || 'localhost').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const protocol = info.ssl ? 'https' : 'http';

    return {
        origin: `${protocol}://${host}:${info.port || defaultPort}`,
        username: info.username || undefined,
        password: info.password || undefined,
        apiKey: info.apiKey || undefined,
        apiToken: info.apiToken || undefined
    };
};

const UNREACHABLE_CODES = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ERR_CANCELED'
]);

/**
 * Turns an upstream failure into a message for the widget. Raw errors are not
 * passed on: they name internal hosts and ports, and guests can see public widgets.
 */
export const describeUpstreamError = (serviceName: string, error: unknown): RealtimeError => {
    if (error instanceof RealtimeError) return error;

    const { code, response } = error as { code?: string; response?: { status?: number } };
    if (response?.status === 401 || response?.status === 403) {
        return new RealtimeError('UNAVAILABLE', `${serviceName} rejected the saved credentials`);
    }
    if (response?.status === 429) {
        return new RealtimeError('UNAVAILABLE', `${serviceName} is refusing requests: too many were sent`);
    }
    if (code && UNREACHABLE_CODES.has(code)) {
        return new RealtimeError('UNAVAILABLE', `${serviceName} is unreachable`);
    }

    console.error(`${serviceName} request failed:`, (error as Error)?.message ?? error);
    return new RealtimeError('UNAVAILABLE', `${serviceName} request failed`);
};
