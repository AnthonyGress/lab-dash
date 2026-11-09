import axios from 'axios';

import { ClientConnection, DownloadClient, DownloadEntry } from './types';

const TIMEOUT_MS = 10_000;
const SESSION_HEADER = 'x-transmission-session-id';

// Transmission's CSRF token, one per instance. It hands out a new one with a 409.
const sessionIds = new Map<string, string>();

// Transmission status codes mapped to the qBittorrent state names the widget understands
const STATES: Record<number, string> = {
    0: 'stopped',            // TR_STATUS_STOPPED
    1: 'checkingResumeData', // TR_STATUS_CHECK_WAIT
    2: 'checkingDL',         // TR_STATUS_CHECK
    3: 'stalledDL',          // TR_STATUS_DOWNLOAD_WAIT
    4: 'downloading',        // TR_STATUS_DOWNLOAD
    5: 'stalledUP',          // TR_STATUS_SEED_WAIT
    6: 'seeding'             // TR_STATUS_SEED
};

const rpc = async (connection: ClientConnection, method: string, args: unknown = {}, signal?: AbortSignal): Promise<any> => {
    const url = `${connection.origin}/transmission/rpc`;
    const { username, password } = connection;
    const authorization = username && password
        ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
        : {};

    const call = (sessionId: string) => axios.post(url, { method, arguments: args }, {
        headers: { 'Content-Type': 'application/json', 'X-Transmission-Session-Id': sessionId, ...authorization },
        timeout: TIMEOUT_MS,
        signal
    });

    let response;
    try {
        response = await call(sessionIds.get(url) ?? '');
    } catch (error) {
        // 409 is how Transmission issues (or renews) the session id: retry with the one it sent
        const upstream = (error as { response?: { status?: number; headers?: Record<string, string> } }).response;
        const sessionId = upstream?.status === 409 ? upstream.headers?.[SESSION_HEADER] : undefined;
        if (!sessionId) throw error;

        sessionIds.set(url, sessionId);
        response = await call(sessionId);
    }

    if (response.data.result !== 'success') {
        throw new Error(`Transmission ${method} failed: ${response.data.result}`);
    }
    return response.data.arguments;
};

// Transmission accepts a torrent's hash wherever it accepts an id; a bare number is its numeric id
const toIds = (hash: string): Array<string | number> => [/^\d+$/.test(hash) ? Number(hash) : hash];

export const transmission: DownloadClient = {
    name: 'Transmission',
    defaultPort: '9091',

    snapshot: async (connection, signal) => {
        const [stats, list] = await Promise.all([
            rpc(connection, 'session-stats', {}, signal),
            rpc(connection, 'torrent-get', {
                fields: ['id', 'name', 'status', 'percentDone', 'totalSize', 'rateDownload', 'rateUpload', 'eta', 'hashString']
            }, signal)
        ]);

        const torrents: DownloadEntry[] = (list.torrents || []).map((torrent: any) => ({
            hash: torrent.hashString || String(torrent.id ?? ''),
            name: torrent.name || '',
            state: STATES[torrent.status] ?? 'unknown',
            progress: torrent.percentDone || 0,
            size: torrent.totalSize || 0,
            dlspeed: torrent.rateDownload || 0,
            upspeed: torrent.rateUpload || 0,
            eta: torrent.eta > 0 ? torrent.eta : undefined
        }));

        return {
            stats: {
                dl_info_speed: stats.downloadSpeed || 0,
                dl_info_data: stats['cumulative-stats']?.downloadedBytes || 0,
                up_info_speed: stats.uploadSpeed || 0,
                up_info_data: stats['cumulative-stats']?.uploadedBytes || 0,
                torrents: {
                    total: stats.torrentCount || 0,
                    downloading: stats.activeTorrentCount || 0,
                    seeding: stats.activeTorrentCount || 0,
                    completed: 0,
                    paused: stats.pausedTorrentCount || 0
                }
            },
            torrents
        };
    },

    resume: async (connection, hash) => {
        await rpc(connection, 'torrent-start', { ids: toIds(hash) });
    },
    pause: async (connection, hash) => {
        await rpc(connection, 'torrent-stop', { ids: toIds(hash) });
    },
    remove: async (connection, hash, deleteFiles) => {
        await rpc(connection, 'torrent-remove', { ids: toIds(hash), 'delete-local-data': deleteFiles });
    }
};
