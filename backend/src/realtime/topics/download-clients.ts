import { createHash } from 'crypto';

import { deluge } from '../../services/download-clients/deluge';
import { nzbget } from '../../services/download-clients/nzbget';
import { qbittorrent } from '../../services/download-clients/qbittorrent';
import { sabnzbd } from '../../services/download-clients/sabnzbd';
import { transmission } from '../../services/download-clients/transmission';
import {
    ClientConnection,
    describeClientError,
    DownloadClient,
    DownloadEntry,
    DownloadSnapshot,
    readConnection
} from '../../services/download-clients/types';
import { Principal, RealtimeError, resolveItem } from '../access';
import { MethodContext, Registry } from '../registry';

// 'torrent-client' is the legacy name of 'download-client'
const DOWNLOAD_WIDGET_TYPES = ['download-client', 'torrent-client'];

const CLIENTS: Record<string, DownloadClient> = { qbittorrent, deluge, transmission, sabnzbd, nzbget };

const ACTIVE_INTERVAL_MS = 2000;
const IDLE_INTERVAL_MS = 20_000;
const ACTIVE_STATES = new Set(['downloading', 'checking', 'metaDl', 'active', 'extracting']);

type Target = {
    client: DownloadClient;
    connection: ClientConnection;
    /** Same client, address and login means the same poller, whichever widget asks */
    key: string;
};

const resolveTarget = (principal: Principal, itemId: string | undefined, mode: 'read' | 'write'): Target => {
    const item = resolveItem(principal, itemId, DOWNLOAD_WIDGET_TYPES, mode);
    const clientType = String(item.config?.clientType || 'qbittorrent').toLowerCase();
    const client = CLIENTS[clientType];
    if (!client) throw new RealtimeError('BAD_REQUEST', 'Unsupported download client');

    const connection = readConnection(item, client.defaultPort);
    const fingerprint = createHash('sha1')
        .update(JSON.stringify([connection.origin, connection.username, connection.password, connection.apiKey]))
        .digest('hex')
        .slice(0, 16);

    return { client, connection, key: `download.client:${clientType}:${fingerprint}` };
};

// Downloading first, then least complete, then by name
const byActivity = (a: DownloadEntry, b: DownloadEntry): number => {
    if (a.state === 'downloading' && b.state !== 'downloading') return -1;
    if (a.state !== 'downloading' && b.state === 'downloading') return 1;
    if (a.progress !== b.progress) return a.progress - b.progress;
    return String(a.name).localeCompare(String(b.name));
};

const action = (
    run: (client: DownloadClient, connection: ClientConnection, id: string, params: Record<string, unknown>) => Promise<void>
) => async ({ principal, itemId, params, hub }: MethodContext) => {
    const { client, connection, key } = resolveTarget(principal, itemId, 'write');
    const input = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
    if (typeof input.id !== 'string' || !input.id || input.id.length > 200) {
        throw new RealtimeError('BAD_REQUEST', 'Download id is required');
    }

    try {
        await run(client, connection, input.id, input);
    } catch (error) {
        throw describeClientError(client.name, error);
    }

    // Push the new state to every watcher now instead of at the next poll
    hub.refresh(key);
    return { success: true };
};

export const registerDownloadClientTopics = (registry: Registry): void => {
    // Transfer speeds and the list of downloads of one client
    registry.topic('download.client', (principal, itemId) => {
        const { client, connection, key } = resolveTarget(principal, itemId, 'read');

        return {
            key,
            // Follow active downloads closely, check an idle client only now and then
            intervalMs: client.intervalMs ?? (data => (
                (data as DownloadSnapshot | undefined)?.torrents.some(torrent => ACTIVE_STATES.has(torrent.state))
                    ? ACTIVE_INTERVAL_MS
                    : IDLE_INTERVAL_MS
            )),
            read: async signal => {
                try {
                    const snapshot = await client.snapshot(connection, signal);
                    return client.keepsQueueOrder
                        ? snapshot
                        : { ...snapshot, torrents: [...snapshot.torrents].sort(byActivity) };
                } catch (error) {
                    throw describeClientError(client.name, error);
                }
            }
        };
    });

    registry
        .method('download.resume', action((client, connection, id) => client.resume(connection, id)))
        .method('download.pause', action((client, connection, id) => client.pause(connection, id)))
        .method('download.remove', action((client, connection, id, params) => (
            client.remove(connection, id, params.deleteFiles === true)
        )));
};
