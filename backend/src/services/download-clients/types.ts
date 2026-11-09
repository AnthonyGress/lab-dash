import { RealtimeError } from '../../realtime/access';
import { DashboardItem } from '../../types';
import { getConnectionInfo } from '../../utils/config-lookup';
import { isEncrypted } from '../../utils/crypto';

/** Totals shown in the widget footer. Field names follow qBittorrent, the first client supported. */
export type DownloadStats = {
    dl_info_speed: number;
    dl_info_data: number;
    up_info_speed: number;
    up_info_data: number;
    torrents: {
        total: number;
        downloading: number;
        seeding: number;
        completed: number;
        paused: number;
    };
};

/** One download, reduced to what the widget shows. */
export type DownloadEntry = {
    hash: string;
    name: string;
    state: string;
    /** 0 to 1 */
    progress: number;
    size: number;
    dlspeed: number;
    upspeed: number;
    /** Seconds */
    eta?: number;
};

export type DownloadSnapshot = {
    stats: DownloadStats;
    torrents: DownloadEntry[];
};

/** Where a client lives and how to log in, with the password already decrypted. */
export type ClientConnection = {
    /** e.g. http://192.168.1.5:8080 */
    origin: string;
    username?: string;
    password?: string;
    apiKey?: string;
};

export type DownloadClient = {
    /** Name used in messages shown to the user */
    name: string;
    defaultPort: string;
    /** Set when the client's own queue order is meaningful and must not be re-sorted */
    keepsQueueOrder?: boolean;
    /** Overrides the default pace (fast while downloading, slow when idle) */
    intervalMs?: number;
    snapshot: (connection: ClientConnection, signal: AbortSignal) => Promise<DownloadSnapshot>;
    resume: (connection: ClientConnection, id: string) => Promise<void>;
    pause: (connection: ClientConnection, id: string) => Promise<void>;
    remove: (connection: ClientConnection, id: string, deleteFiles: boolean) => Promise<void>;
};

export const emptyStats = (): DownloadStats => ({
    dl_info_speed: 0,
    dl_info_data: 0,
    up_info_speed: 0,
    up_info_data: 0,
    torrents: { total: 0, downloading: 0, seeding: 0, completed: 0, paused: 0 }
});

/** Reads host, port and credentials from a saved item. */
export const readConnection = (item: DashboardItem, defaultPort: string): ClientConnection => {
    const info = getConnectionInfo(item);

    // getConnectionInfo yields an empty string when a stored secret cannot be decrypted
    const undecryptable = (['password', 'apiKey'] as const)
        .some(field => isEncrypted(item.config?.[field] ?? '') && !info[field]);
    if (undecryptable) {
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
        apiKey: info.apiKey || undefined
    };
};

const UNREACHABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ERR_CANCELED']);

/**
 * Turns an upstream failure into a message for the widget. Raw errors are not
 * passed on: they name internal hosts and ports, and guests can see public widgets.
 */
export const describeClientError = (clientName: string, error: unknown): RealtimeError => {
    if (error instanceof RealtimeError) return error;

    const { code, response } = error as { code?: string; response?: { status?: number } };
    if (response?.status === 401 || response?.status === 403) {
        return new RealtimeError('UNAVAILABLE', `${clientName} rejected the saved credentials`);
    }
    if (code && UNREACHABLE_CODES.has(code)) {
        return new RealtimeError('UNAVAILABLE', `${clientName} is unreachable`);
    }

    console.error(`${clientName} request failed:`, (error as Error)?.message ?? error);
    return new RealtimeError('UNAVAILABLE', `${clientName} request failed`);
};
