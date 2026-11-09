import axios from 'axios';
import https from 'https';

import { RealtimeError } from '../realtime/access';
import { UpstreamConnection } from './upstream';

export type ArrKind = 'sonarr' | 'radarr';

/** One queued download, reduced to what the widget shows. */
export type QueueEntry = {
    id: number;
    hash: string;
    name: string;
    state: string;
    /** 0 to 1 */
    progress: number;
    size: number;
    /** Seconds */
    eta?: number;
    protocol: string;
    downloadClient: string;
    indexer: string;
};

export type ArrSnapshot = {
    queue: QueueEntry[];
    statistics: { totalItems: number; monitoredItems: number };
};

export const ARR = {
    sonarr: { name: 'Sonarr', defaultPort: '8989', library: '/series' },
    radarr: { name: 'Radarr', defaultPort: '7878', library: '/movie' }
} as const;

const TIMEOUT_MS = 10_000;
// The library list is large and its size changes rarely
const STATISTICS_TTL_MS = 10 * 60 * 1000;
const ACTIVE_STATES = new Set(['downloading', 'active']);

// Allow self-signed certificates: these services usually sit on the local network
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

const statisticsCache = new Map<string, { expires: number; value: ArrSnapshot['statistics'] }>();
// Instances whose last queue read showed a download in progress
const busy = new Set<string>();

const api = async (
    connection: UpstreamConnection,
    method: 'get' | 'post' | 'delete',
    path: string,
    options: { params?: unknown; data?: unknown; signal?: AbortSignal } = {}
): Promise<any> => {
    if (!connection.apiKey) {
        throw new RealtimeError('BAD_REQUEST', 'API key is required or could not be decrypted');
    }

    return (await axios.request({
        url: `${connection.origin}/api/v3${path}`,
        method,
        headers: { 'X-Api-Key': connection.apiKey, 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
        httpsAgent,
        ...options
    })).data;
};

const STATUS_STATES: Record<string, string> = {
    downloading: 'downloading',
    paused: 'paused',
    queued: 'queued',
    completed: 'completed',
    failed: 'error',
    warning: 'warning'
};
const TRACKED_STATES: Record<string, string> = {
    downloading: 'downloading',
    paused: 'paused',
    pausedDL: 'paused',
    stopped: 'stopped',
    stalled: 'stalled',
    stalledDL: 'stalled'
};

// The item's own status is the most accurate, then the tracked download's status, then its state
const readState = (item: any): string => (
    STATUS_STATES[item.status] ??
    (item.status === 'stopped' ? 'stopped' : undefined) ??
    STATUS_STATES[item.trackedDownloadStatus] ??
    TRACKED_STATES[item.trackedDownloadState] ??
    (item.status || item.trackedDownloadStatus || item.trackedDownloadState || 'unknown')
);

// "00:15:30" to seconds
const parseTimeLeft = (timeLeft: string | undefined): number | undefined => {
    if (!timeLeft || timeLeft === '00:00:00') return undefined;

    const parts = timeLeft.split(':');
    if (parts.length !== 3) return undefined;
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
};

const readName = (kind: ArrKind, item: any): string => {
    if (kind === 'radarr') {
        return item.movie?.title
            ? `${item.movie.title} (${item.movie.year || 'Unknown'})`
            : item.title || 'Unknown Movie';
    }

    const seriesTitle = item.episode?.series?.title || item.title || 'Unknown Series';
    const episodeNumber = item.episode?.episodeNumber || 0;
    return `${seriesTitle} - S00E${episodeNumber.toString().padStart(2, '0')} - ${item.episode?.title || 'Unknown Episode'}`;
};

const readStatistics = async (
    kind: ArrKind,
    connection: UpstreamConnection,
    signal: AbortSignal
): Promise<ArrSnapshot['statistics']> => {
    const cacheKey = `${kind}|${connection.origin}|${connection.apiKey}`;
    const cached = statisticsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;

    const library: any[] = await api(connection, 'get', ARR[kind].library, { signal }) || [];
    const value = { totalItems: library.length, monitoredItems: library.filter(entry => entry.monitored).length };
    statisticsCache.set(cacheKey, { expires: Date.now() + STATISTICS_TTL_MS, value });
    return value;
};

export const hasActiveDownloads = (snapshot: ArrSnapshot | undefined): boolean => (
    Boolean(snapshot?.queue.some(entry => ACTIVE_STATES.has(entry.state)))
);

export const readArrSnapshot = async (
    kind: ArrKind,
    connection: UpstreamConnection,
    signal: AbortSignal
): Promise<ArrSnapshot> => {
    const instance = `${kind}|${connection.origin}`;

    // While something is downloading, ask the service to refresh its own view of the
    // download clients first, otherwise progress only moves once a minute
    if (busy.has(instance)) {
        await api(connection, 'post', '/command', { data: { name: 'RefreshMonitoredDownloads' }, signal })
            .catch(() => undefined);
    }

    const response = await api(connection, 'get', '/queue', { signal });
    const records: any[] = response?.records || (Array.isArray(response) ? response : []);

    const queue: QueueEntry[] = records.map(item => ({
        id: item.id,
        hash: item.downloadId || String(item.id),
        name: readName(kind, item),
        state: readState(item),
        progress: item.size > 0 ? Math.max(0, (item.size - item.sizeleft) / item.size) : 0,
        size: item.size || 0,
        eta: parseTimeLeft(item.timeleft),
        protocol: item.protocol || 'Unknown',
        downloadClient: item.downloadClient || 'Unknown',
        indexer: item.indexer || 'Unknown'
    }));

    // Downloading first, then furthest along
    queue.sort((a, b) => {
        if (a.state === 'downloading' && b.state !== 'downloading') return -1;
        if (a.state !== 'downloading' && b.state === 'downloading') return 1;
        return b.progress - a.progress;
    });

    // The library size is a nicety: the queue is still worth showing without it
    const statistics = await readStatistics(kind, connection, signal).catch(() => ({ totalItems: 0, monitoredItems: 0 }));
    const snapshot = { queue, statistics };

    if (hasActiveDownloads(snapshot)) busy.add(instance);
    else busy.delete(instance);

    return snapshot;
};

export const removeFromArrQueue = async (
    connection: UpstreamConnection,
    queueId: number,
    removeFromClient: boolean,
    blocklist: boolean
): Promise<void> => {
    await api(connection, 'delete', `/queue/${queueId}`, { params: { removeFromClient, blocklist } });
};
