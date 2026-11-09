import axios from 'axios';
import https from 'https';

import { RealtimeError } from '../realtime/access';
import { UpstreamConnection } from './upstream';

/** What a DNS blocker widget shows, in the shape Pi-hole v5 made familiar. */
export type DnsStats = {
    domains_being_blocked: number | string;
    dns_queries_today: number | string;
    ads_blocked_today: number | string;
    ads_percentage_today: number | string;
    status: 'enabled' | 'disabled';
    /** Seconds until blocking turns itself back on; null when it will not (or is on) */
    timer: number | null;
};

export type DnsBlocker = {
    /** Name used in messages shown to the user */
    name: string;
    defaultPort: string;
    stats: (connection: UpstreamConnection, signal: AbortSignal) => Promise<DnsStats>;
    /** Without `seconds`, blocking stays off until it is enabled again */
    disable: (connection: UpstreamConnection, seconds?: number) => Promise<void>;
    enable: (connection: UpstreamConnection) => Promise<void>;
};

const TIMEOUT_MS = 5000;

// Allow self-signed certificates: these services usually sit on the local network
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ---------------------------------------------------------------- Pi-hole v5

// v5 does not report when a timed disable ends, so remember it here
const v5DisabledUntil = new Map<string, number>();

const v5Api = async (connection: UpstreamConnection, query: string, signal?: AbortSignal): Promise<any> => {
    if (!connection.apiToken) {
        throw new RealtimeError('BAD_REQUEST', 'API token is required or could not be decrypted');
    }

    const url = `${connection.origin}/api.php?${query}&auth=${encodeURIComponent(connection.apiToken)}`;
    return (await axios.get(url, { timeout: TIMEOUT_MS, httpsAgent, signal })).data;
};

export const piholeV5: DnsBlocker = {
    name: 'Pi-hole',
    defaultPort: '80',

    stats: async (connection, signal) => {
        const data = await v5Api(connection, 'summary=', signal);
        // A wrong token is answered with 200 and an empty list
        if (!data || Array.isArray(data) || typeof data.status !== 'string' || data.status === 'error') {
            throw new RealtimeError('UNAVAILABLE', 'Pi-hole rejected the saved API token');
        }

        const status = data.status === 'enabled' ? 'enabled' : 'disabled';
        const until = v5DisabledUntil.get(connection.origin);
        if (status === 'enabled' || (until !== undefined && until <= Date.now())) {
            v5DisabledUntil.delete(connection.origin);
        }

        return {
            domains_being_blocked: data.domains_being_blocked ?? 0,
            dns_queries_today: data.dns_queries_today ?? 0,
            ads_blocked_today: data.ads_blocked_today ?? 0,
            ads_percentage_today: data.ads_percentage_today ?? 0,
            status,
            timer: status === 'disabled' && until !== undefined && until > Date.now()
                ? Math.round((until - Date.now()) / 1000)
                : null
        };
    },

    disable: async (connection, seconds) => {
        const data = await v5Api(connection, seconds === undefined ? 'disable' : `disable=${seconds}`);
        if (data?.status !== 'disabled') throw new Error('Failed to disable Pi-hole blocking');

        if (seconds === undefined) v5DisabledUntil.delete(connection.origin);
        else v5DisabledUntil.set(connection.origin, Date.now() + seconds * 1000);
    },

    enable: async connection => {
        const data = await v5Api(connection, 'enable');
        if (data?.status !== 'enabled') throw new Error('Failed to enable Pi-hole blocking');
        v5DisabledUntil.delete(connection.origin);
    }
};

// ---------------------------------------------------------------- Pi-hole v6

// Pi-hole v6 limits how many sessions may exist, so one is reused until it is about to expire
const v6Sessions = new Map<string, { sid: string; csrf: string; expires: number }>();
const v6Key = (connection: UpstreamConnection): string => `${connection.origin}|${connection.password}`;

const v6Login = async (connection: UpstreamConnection) => {
    if (!connection.password) {
        throw new RealtimeError('BAD_REQUEST', 'Password is required or could not be decrypted');
    }

    let session: any;
    try {
        const response = await axios.post(
            `${connection.origin}/api/auth`,
            { password: connection.password },
            { headers: { 'Content-Type': 'application/json' }, timeout: 10_000, httpsAgent }
        );
        session = response.data?.session;
    } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 401) throw new RealtimeError('UNAVAILABLE', 'Pi-hole rejected the saved password');
        if (status === 429) {
            throw new RealtimeError(
                'UNAVAILABLE',
                'Too many requests to Pi-hole API. Clear unused sessions in Pi-hole or raise its max_sessions setting.'
            );
        }
        throw error;
    }

    if (!session?.valid || !session.sid) {
        throw new RealtimeError('UNAVAILABLE', 'Pi-hole rejected the saved password');
    }

    const entry = {
        sid: session.sid as string,
        csrf: session.csrf as string,
        // Renew a little before Pi-hole would expire it (validity is in seconds, 30 minutes by default)
        expires: Date.now() + (session.validity || 1800) * 900
    };
    v6Sessions.set(v6Key(connection), entry);
    return entry;
};

const v6Api = async (
    connection: UpstreamConnection,
    path: string,
    body?: unknown,
    signal?: AbortSignal
): Promise<any> => {
    const call = async (session: { sid: string; csrf: string }) => (await axios.request({
        url: `${connection.origin}${path}`,
        method: body === undefined ? 'get' : 'post',
        data: body,
        params: { sid: session.sid },
        headers: { 'X-FTL-CSRF': session.csrf, 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
        httpsAgent,
        signal
    })).data;

    const cached = v6Sessions.get(v6Key(connection));
    try {
        return await call(cached && cached.expires > Date.now() ? cached : await v6Login(connection));
    } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status !== 401 && status !== 403) throw error;

        // The session was dropped on Pi-hole's side: log in once more
        v6Sessions.delete(v6Key(connection));
        return await call(await v6Login(connection));
    }
};

const v6Blocking = (data: any): Pick<DnsStats, 'status' | 'timer'> => {
    const disabled = data?.blocking === false || data?.blocking === 'disabled' || data?.blocking === 'false';
    const timer = parseFloat(data?.timer);
    return {
        status: disabled ? 'disabled' : 'enabled',
        timer: disabled && !isNaN(timer) ? Math.round(timer) : null
    };
};

export const piholeV6: DnsBlocker = {
    name: 'Pi-hole',
    defaultPort: '80',

    stats: async (connection, signal) => {
        const response = await v6Api(connection, '/api/stats/summary', undefined, signal);
        const blocking = await v6Api(connection, '/api/dns/blocking', undefined, signal);
        const summary = response?.summary ?? response ?? {};

        return {
            domains_being_blocked: summary.gravity?.domains_being_blocked ?? summary.domains_being_blocked ?? 0,
            dns_queries_today: summary.queries?.total ?? summary.dns_queries_today ?? 0,
            ads_blocked_today: summary.queries?.blocked ?? summary.ads_blocked_today ?? 0,
            ads_percentage_today: summary.queries?.percent_blocked ?? summary.ads_percentage_today ?? 0,
            ...v6Blocking(blocking)
        };
    },

    disable: async (connection, seconds) => {
        // A null timer means indefinitely
        await v6Api(connection, '/api/dns/blocking', { blocking: false, timer: seconds ?? null });
    },

    enable: async connection => {
        // Explicitly clear any timer
        await v6Api(connection, '/api/dns/blocking', { blocking: true, timer: null });
    }
};

// ---------------------------------------------------------------- AdGuard Home

const adguardApi = async (
    connection: UpstreamConnection,
    path: string,
    body?: unknown,
    signal?: AbortSignal
): Promise<any> => {
    const { username, password } = connection;
    if (!username || !password) {
        throw new RealtimeError('BAD_REQUEST', 'Username and password must be configured for this item');
    }

    return (await axios.request({
        url: `${connection.origin}${path}`,
        method: body === undefined ? 'get' : 'post',
        data: body,
        headers: {
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
            'Content-Type': 'application/json'
        },
        timeout: TIMEOUT_MS,
        httpsAgent,
        signal
    })).data;
};

const sum = (values: unknown, count: number): number => (
    (Array.isArray(values) ? values : []).slice(0, count).reduce((total, value) => total + (value || 0), 0)
);

export const adguard: DnsBlocker = {
    name: 'AdGuard Home',
    defaultPort: '3000',

    stats: async (connection, signal) => {
        const [status, stats] = await Promise.all([
            adguardApi(connection, '/control/status', undefined, signal),
            adguardApi(connection, '/control/stats', undefined, signal)
        ]);

        // AdGuard Home returns time series: the last 24 hours, or days with today first
        let queries = stats.num_dns_queries || 0;
        let blocked = stats.num_blocked_filtering || 0;
        if (stats.dns_queries && stats.blocked_filtering && stats.time_units === 'hours') {
            queries = sum(stats.dns_queries, 24);
            blocked = sum(stats.blocked_filtering, 24);
        } else if (stats.dns_queries && stats.blocked_filtering && stats.time_units === 'days') {
            queries = stats.dns_queries[0] || 0;
            blocked = stats.blocked_filtering[0] || 0;
        }

        const enabled = Boolean(status.protection_enabled);
        const remainingMs = Number(status.protection_disabled_duration) || 0;

        return {
            domains_being_blocked: status.num_blocked_filtering || 0,
            dns_queries_today: queries,
            ads_blocked_today: blocked,
            ads_percentage_today: queries > 0 ? Math.round((blocked / queries) * 1000) / 10 : 0,
            status: enabled ? 'enabled' : 'disabled',
            timer: !enabled && remainingMs > 0 ? Math.round(remainingMs / 1000) : null
        };
    },

    disable: async (connection, seconds) => {
        // AdGuard Home turns protection back on by itself after `duration` milliseconds
        await adguardApi(connection, '/control/protection', {
            enabled: false,
            ...(seconds === undefined ? {} : { duration: seconds * 1000 })
        });
    },

    enable: async connection => {
        await adguardApi(connection, '/control/dns_config', { protection_enabled: true });
    }
};
