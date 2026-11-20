import axios from 'axios';

import { RealtimeError } from '../../realtime/access';
import { ClientConnection, DownloadClient, DownloadEntry } from './types';

const SESSION_LIFETIME = 25 * 60 * 1000;
const TIMEOUT_MS = 8000;

// Login cookies, one per Deluge web UI and password. A changed password starts a new session.
const sessions = new Map<string, { cookie: string; expires: number }>();

const endpoint = (connection: ClientConnection): string => `${connection.origin}/json`;
const sessionKey = (connection: ClientConnection): string => `${connection.origin}|${connection.password}`;

const login = async (connection: ClientConnection): Promise<string> => {
    if (!connection.password) {
        throw new RealtimeError('BAD_REQUEST', 'Password must be configured for this item');
    }

    const response = await axios.post(
        endpoint(connection),
        { method: 'auth.login', params: [connection.password], id: 1 },
        { headers: { 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }
    );

    const cookie = response.headers['set-cookie']?.[0];
    if (response.data.result !== true || !cookie) {
        throw new RealtimeError('UNAVAILABLE', 'Deluge rejected the saved password');
    }

    sessions.set(sessionKey(connection), { cookie, expires: Date.now() + SESSION_LIFETIME });
    return cookie;
};

/** Calls a Deluge JSON-RPC method, logging in again once if the session is no longer accepted. */
const rpc = async (connection: ClientConnection, method: string, params: unknown[], signal?: AbortSignal): Promise<any> => {
    const call = async (cookie: string) => (await axios.post(
        endpoint(connection),
        { method, params, id: 2 },
        { headers: { Cookie: cookie }, timeout: TIMEOUT_MS, signal }
    )).data;

    const session = sessions.get(sessionKey(connection));
    let data = await call(session && session.expires > Date.now() ? session.cookie : await login(connection));

    // Deluge answers 200 with an error body when the cookie has expired
    if (data.error) {
        sessions.delete(sessionKey(connection));
        data = await call(await login(connection));
    }
    if (data.error) {
        throw new Error(data.error.message || `Deluge ${method} failed`);
    }

    return data.result;
};

// Deluge state names mapped to the qBittorrent ones the widget understands
const STATES: Record<string, string> = {
    downloading: 'downloading',
    seeding: 'seeding',
    paused: 'pausedDL',
    queued: 'stalledDL',
    checking: 'checkingUP'
};

export const deluge: DownloadClient = {
    name: 'Deluge',
    defaultPort: '8112',

    snapshot: async (connection, signal) => {
        const ui = await rpc(connection, 'web.update_ui', [
            ['name', 'state', 'progress', 'download_payload_rate', 'upload_payload_rate', 'total_size', 'eta'],
            {}
        ], signal);

        // Session totals are a nicety; the widget still works without them
        const totals = await rpc(connection, 'core.get_session_status', [['total_upload', 'total_download']], signal)
            .catch(() => ({}));

        const raw: Record<string, any> = ui.torrents || {};
        const states = Object.values(raw).map(torrent => String(torrent.state).toLowerCase());
        const torrents: DownloadEntry[] = Object.entries(raw).map(([hash, torrent]) => ({
            hash,
            name: torrent.name,
            state: STATES[String(torrent.state).toLowerCase()] ?? 'unknown',
            progress: torrent.progress / 100, // Deluge uses 0-100, the widget 0-1
            size: torrent.total_size,
            dlspeed: torrent.download_payload_rate,
            upspeed: torrent.upload_payload_rate,
            eta: torrent.eta
        }));

        return {
            stats: {
                dl_info_speed: ui.stats?.download_rate || 0,
                up_info_speed: ui.stats?.upload_rate || 0,
                dl_info_data: totals?.total_download || 0,
                up_info_data: totals?.total_upload || 0,
                torrents: {
                    total: torrents.length,
                    downloading: states.filter(state => state === 'downloading').length,
                    seeding: states.filter(state => state === 'seeding').length,
                    completed: Object.values(raw).filter(torrent => torrent.progress === 100).length,
                    paused: states.filter(state => state === 'paused').length
                }
            },
            torrents
        };
    },

    resume: async (connection, hash) => {
        await rpc(connection, 'core.resume_torrent', [[hash]]);
    },
    pause: async (connection, hash) => {
        await rpc(connection, 'core.pause_torrent', [[hash]]);
    },
    remove: async (connection, hash, deleteFiles) => {
        await rpc(connection, 'core.remove_torrent', [hash, deleteFiles]);
    }
};
