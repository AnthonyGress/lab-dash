import axios from 'axios';

import { ClientConnection, DownloadClient, DownloadEntry } from './types';

const TIMEOUT_MS = 10_000;

const rpc = async (connection: ClientConnection, method: string, params: unknown[] = [], signal?: AbortSignal): Promise<any> => {
    const { username, password } = connection;
    const authorization = username && password
        ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
        : {};

    const { data } = await axios.post(
        `${connection.origin}/jsonrpc`,
        { jsonrpc: '2.0', method, params, id: 1 },
        { headers: { 'Content-Type': 'application/json', ...authorization }, timeout: TIMEOUT_MS, signal }
    );

    if (data.error) {
        throw new Error(data.error.message || 'NZBGet API error');
    }
    return data.result;
};

// NZBGet group states mapped to the names the widget understands
const STATES: Record<string, string> = {
    PAUSED: 'paused',
    DOWNLOADING: 'downloading',
    FETCHING: 'downloading',
    QUEUED: 'queued'
};

const editQueue = async (connection: ClientConnection, command: string, nzbId: string): Promise<void> => {
    await rpc(connection, 'editqueue', [command, 0, '', [parseInt(nzbId)]]);
};

export const nzbget: DownloadClient = {
    name: 'NZBGet',
    defaultPort: '6789',
    keepsQueueOrder: true,
    intervalMs: 5000,

    snapshot: async (connection, signal) => {
        const [status, history, groups] = await Promise.all([
            rpc(connection, 'status', [], signal),
            rpc(connection, 'history', [], signal),
            rpc(connection, 'listgroups', [], signal)
        ]);

        const speed = status.DownloadRate || 0;
        const failed = history.filter((item: any) => item.Status === 'FAILURE' || item.Status === 'WARNING').length;

        const torrents: DownloadEntry[] = groups.map((item: any, index: number) => {
            const size = item.FileSizeMB * 1024 * 1024; // MB to bytes
            const remaining = item.RemainingSizeMB * 1024 * 1024;
            // NZBGet downloads one job at a time: the speed belongs to the first one
            const dlspeed = index === 0 && (item.Status === 'DOWNLOADING' || item.Status === 'FETCHING') ? speed : 0;

            return {
                hash: String(item.NZBID),
                name: item.NZBName || 'Unknown',
                state: STATES[item.Status] ?? 'unknown',
                progress: size > 0 ? Math.max(0, Math.min(1, (size - remaining) / size)) : 0,
                size,
                dlspeed,
                upspeed: 0,
                eta: remaining > 0 && dlspeed > 0 ? Math.round(remaining / dlspeed) : undefined
            };
        });

        return {
            stats: {
                dl_info_speed: speed,
                dl_info_data: status.DownloadedSizeMB ? status.DownloadedSizeMB * 1024 * 1024 : 0,
                up_info_speed: 0, // NZBGet doesn't upload
                up_info_data: 0,
                torrents: {
                    total: status.DownloadedFileCount || 0,
                    downloading: status.DownloadPaused ? 0 : (status.PostJobCount || 0),
                    seeding: 0,
                    completed: history.length - failed,
                    paused: status.DownloadPaused ? 1 : 0
                }
            },
            torrents
        };
    },

    resume: (connection, nzbId) => editQueue(connection, 'GroupResume', nzbId),
    pause: (connection, nzbId) => editQueue(connection, 'GroupPause', nzbId),
    remove: (connection, nzbId) => editQueue(connection, 'GroupDelete', nzbId)
};
