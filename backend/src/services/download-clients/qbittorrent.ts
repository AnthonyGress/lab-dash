import axios from 'axios';
import qs from 'querystring';

import { RealtimeError } from '../../realtime/access';
import { ClientConnection, DownloadClient, DownloadEntry } from './types';

// qBittorrent sessions typically last about 30 minutes
const SESSION_LIFETIME = 25 * 60 * 1000;
const TIMEOUT_MS = 8000;

// Login cookies, one per qBittorrent instance and login. A changed password starts a new session.
const sessions = new Map<string, { cookie: string; expires: number }>();

const sessionKey = (connection: ClientConnection): string => (
    `${connection.origin}|${connection.username}|${connection.password}`
);
const api = (connection: ClientConnection, path: string): string => `${connection.origin}/api/v2${path}`;

const login = async (connection: ClientConnection): Promise<string> => {
    if (!connection.username || !connection.password) {
        throw new RealtimeError('BAD_REQUEST', 'Username and password must be configured for this item');
    }

    const response = await axios.post(
        api(connection, '/auth/login'),
        qs.stringify({ username: connection.username, password: connection.password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: TIMEOUT_MS }
    );

    // A rejected login still answers 200, just without a session cookie
    const cookie = response.headers['set-cookie']?.[0];
    if (!cookie) throw new RealtimeError('UNAVAILABLE', 'qBittorrent rejected the saved credentials');

    sessions.set(sessionKey(connection), { cookie, expires: Date.now() + SESSION_LIFETIME });
    return cookie;
};

/** Runs a request with a valid session, logging in again once if qBittorrent has dropped it. */
const withSession = async <T>(connection: ClientConnection, run: (cookie: string) => Promise<T>): Promise<T> => {
    const session = sessions.get(sessionKey(connection));
    const cookie = session && session.expires > Date.now() + 60_000 ? session.cookie : await login(connection);

    try {
        return await run(cookie);
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status !== 403) throw error;

        sessions.delete(sessionKey(connection));
        return await run(await login(connection));
    }
};

const command = (connection: ClientConnection, path: string, body: Record<string, unknown>): Promise<void> => (
    withSession(connection, async cookie => {
        await axios.post(api(connection, path), qs.stringify(body as qs.ParsedUrlQueryInput), {
            headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: TIMEOUT_MS
        });
    })
);

export const qbittorrent: DownloadClient = {
    name: 'qBittorrent',
    defaultPort: '8080',

    snapshot: (connection, signal) => withSession(connection, async cookie => {
        const options = { headers: { Cookie: cookie }, timeout: TIMEOUT_MS, signal };
        const [transfer, list] = await Promise.all([
            axios.get(api(connection, '/transfer/info'), options),
            axios.get(api(connection, '/torrents/info'), options)
        ]);

        const raw: any[] = Array.isArray(list.data) ? list.data : [];
        const torrents: DownloadEntry[] = raw.map(torrent => ({
            hash: torrent.hash,
            name: torrent.name,
            state: torrent.state,
            progress: torrent.progress,
            size: torrent.size,
            dlspeed: torrent.dlspeed,
            upspeed: torrent.upspeed,
            eta: torrent.eta
        }));

        return {
            stats: {
                dl_info_speed: transfer.data.dl_info_speed || 0,
                up_info_speed: transfer.data.up_info_speed || 0,
                dl_info_data: transfer.data.dl_info_data || 0,
                up_info_data: transfer.data.up_info_data || 0,
                torrents: {
                    total: raw.length,
                    downloading: raw.filter(t => t.state === 'downloading').length,
                    seeding: raw.filter(t => t.state === 'seeding' || t.state === 'uploading').length,
                    completed: raw.filter(t => t.progress === 1).length,
                    paused: raw.filter(t => t.state === 'pausedDL' || t.state === 'pausedUP').length
                }
            },
            torrents
        };
    }),

    resume: (connection, hash) => command(connection, '/torrents/start', { hashes: hash }),
    pause: (connection, hash) => command(connection, '/torrents/stop', { hashes: hash }),
    remove: (connection, hash, deleteFiles) => command(connection, '/torrents/delete', { hashes: hash, deleteFiles })
};
