import axios from 'axios';

import { RealtimeError } from '../../realtime/access';
import { ClientConnection, DownloadClient, DownloadEntry } from './types';

const TIMEOUT_MS = 5000;

const api = async (connection: ClientConnection, params: Record<string, unknown>, signal?: AbortSignal): Promise<any> => {
    // SABnzbd accepts the API key in place of a password; older configs stored it there
    const apikey = connection.apiKey || connection.password;
    if (!apikey) throw new RealtimeError('BAD_REQUEST', 'API key must be configured for this item');

    const { data } = await axios.get(`${connection.origin}/api`, {
        params: { output: 'json', ...params, apikey },
        timeout: TIMEOUT_MS,
        signal
    });

    // A wrong key is answered with 200 and an error body
    if (data?.status === false || typeof data === 'string') {
        throw new RealtimeError('UNAVAILABLE', 'SABnzbd rejected the saved API key');
    }
    return data;
};

// "1:02:03" or "2:01:02:03" (with days) to seconds
const parseTimeLeft = (timeStr: string): number | undefined => {
    if (!timeStr || timeStr === '0:00:00') return undefined;

    const parts = timeStr.split(':').map(part => parseInt(part) || 0);
    if (parts.length !== 3 && parts.length !== 4) return undefined;

    const [days, hours, minutes, seconds] = parts.length === 4 ? parts : [0, ...parts];
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? totalSeconds : undefined;
};

const readProgress = (item: any): number => {
    const percentage = parseFloat(item.percentage || '0');
    if (percentage > 0) return percentage / 100;

    const totalMB = parseFloat(item.mb || '0');
    const leftMB = parseFloat(item.mbleft);
    if (totalMB <= 0 || isNaN(leftMB)) return 0;
    return Math.max(0, Math.min(1, (totalMB - leftMB) / totalMB));
};

export const sabnzbd: DownloadClient = {
    name: 'SABnzbd',
    defaultPort: '8080',
    keepsQueueOrder: true,

    snapshot: async (connection, signal) => {
        const [queueData, historyData, serverStats] = await Promise.all([
            api(connection, { mode: 'queue' }, signal),
            api(connection, { mode: 'history', limit: 50 }, signal),
            api(connection, { mode: 'server_stats' }, signal)
        ]);

        const queue = queueData.queue ?? {};
        const speed = parseFloat(queue.kbpersec || '0') * 1024; // KB/s to B/s
        const queued = Number(queue.noofslots) || 0;
        const finished = Number(historyData.history?.noofslots) || 0;

        const torrents: DownloadEntry[] = (queue.slots || []).map((item: any, index: number) => ({
            hash: item.nzo_id,
            name: item.filename || 'Unknown',
            state: String(item.status || 'unknown').toLowerCase(), // 'downloading', 'paused', etc.
            progress: readProgress(item),
            size: parseFloat(item.mb || '0') * 1024 * 1024, // MB to bytes
            // SABnzbd downloads one job at a time: the speed belongs to the first one
            dlspeed: index === 0 && String(item.status).toLowerCase() === 'downloading' ? speed : 0,
            upspeed: 0,
            eta: parseTimeLeft(item.timeleft || '0:00:00')
        }));

        return {
            stats: {
                dl_info_speed: speed,
                dl_info_data: serverStats.month || 0, // Downloaded this month, in bytes
                up_info_speed: 0, // SABnzbd doesn't upload
                up_info_data: 0,
                torrents: {
                    total: queued + finished,
                    downloading: queued,
                    seeding: 0,
                    completed: finished,
                    paused: queue.paused ? 1 : 0
                }
            },
            torrents
        };
    },

    // As before the move to realtime, pause and resume act on the whole queue
    resume: async connection => {
        await api(connection, { mode: 'resume' });
    },
    pause: async connection => {
        await api(connection, { mode: 'pause' });
    },
    remove: async (connection, nzoId, deleteFiles) => {
        await api(connection, { mode: 'queue', name: 'delete', value: nzoId, del_files: deleteFiles ? '1' : '0' });
    }
};
