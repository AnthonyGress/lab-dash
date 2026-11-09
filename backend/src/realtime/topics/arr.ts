import { createHash } from 'crypto';

import { ARR, ArrKind, ArrSnapshot, hasActiveDownloads, readArrSnapshot, removeFromArrQueue } from '../../services/arr';
import { describeUpstreamError, readConnection, UpstreamConnection } from '../../services/upstream';
import { Principal, RealtimeError, resolveItem } from '../access';
import { Registry } from '../registry';

const ARR_WIDGET_TYPES: Record<string, ArrKind> = {
    'sonarr-widget': 'sonarr',
    'radarr-widget': 'radarr'
};

const ACTIVE_INTERVAL_MS = 2000;
const IDLE_INTERVAL_MS = 20_000;

type Target = { kind: ArrKind; connection: UpstreamConnection; key: string };

const resolveTarget = (principal: Principal, itemId: string | undefined, mode: 'read' | 'write'): Target => {
    const item = resolveItem(principal, itemId, Object.keys(ARR_WIDGET_TYPES), mode);
    const kind = ARR_WIDGET_TYPES[item.type];
    const connection = readConnection(item, ARR[kind].defaultPort);
    const fingerprint = createHash('sha1').update(JSON.stringify([kind, connection])).digest('hex').slice(0, 16);

    return { kind, connection, key: `arr.queue:${fingerprint}` };
};

export const registerArrTopics = (registry: Registry): void => {
    // The download queue of a Sonarr or Radarr instance, with the size of its library
    registry.topic('arr.queue', (principal, itemId) => {
        const { kind, connection, key } = resolveTarget(principal, itemId, 'read');

        return {
            key,
            intervalMs: data => (hasActiveDownloads(data as ArrSnapshot | undefined) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS),
            read: async signal => {
                try {
                    return await readArrSnapshot(kind, connection, signal);
                } catch (error) {
                    throw describeUpstreamError(ARR[kind].name, error);
                }
            }
        };
    });

    // Removes a download from the queue, optionally from the download client and onto the blocklist
    registry.method('arr.queue.remove', async ({ principal, itemId, params, hub }) => {
        const { kind, connection, key } = resolveTarget(principal, itemId, 'write');
        const input = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
        const queueId = Number(input.id);
        if (!Number.isInteger(queueId) || queueId < 1) {
            throw new RealtimeError('BAD_REQUEST', 'Queue item id is required');
        }

        try {
            // Removing from the download client is the default, as in Sonarr and Radarr themselves
            await removeFromArrQueue(connection, queueId, input.removeFromClient !== false, input.blocklist === true);
        } catch (error) {
            throw describeUpstreamError(ARR[kind].name, error);
        }

        hub.refresh(key);
        return { success: true };
    });
};
