import { createHash } from 'crypto';

import {
    createMediaRequest,
    MediaServerSnapshot,
    moderateMediaRequest,
    readMediaRequests,
    readMediaServer,
    readTvDetails,
    searchMedia
} from '../../services/media';
import { describeUpstreamError, readConnection, UpstreamConnection } from '../../services/upstream';
import { Principal, RealtimeError, resolveItem } from '../access';
import { MethodContext, Registry } from '../registry';

const MEDIA_SERVER_TYPES = ['media-server-widget'];
const REQUEST_MANAGER_TYPES = ['media-request-manager-widget'];

type Target = { name: string; connection: UpstreamConnection; key: string };

const fingerprint = (connection: UpstreamConnection): string => (
    createHash('sha1').update(JSON.stringify(connection)).digest('hex').slice(0, 16)
);

const resolveMediaServer = (principal: Principal, itemId: string | undefined): Target => {
    const item = resolveItem(principal, itemId, MEDIA_SERVER_TYPES);
    const clientType = String(item.config?.clientType || 'jellyfin');
    // Jellyfin and Emby use the same API
    if (clientType !== 'jellyfin' && clientType !== 'emby') {
        throw new RealtimeError('BAD_REQUEST', `${clientType} is not yet supported`);
    }

    const connection = readConnection(item, '8096');
    return { name: clientType === 'emby' ? 'Emby' : 'Jellyfin', connection, key: `media.sessions:${fingerprint(connection)}` };
};

const resolveRequestManager = (principal: Principal, itemId: string | undefined, mode: 'read' | 'write'): Target => {
    const item = resolveItem(principal, itemId, REQUEST_MANAGER_TYPES, mode);
    const connection = readConnection(item, '5055');
    const name = item.config?.service === 'overseerr' ? 'Overseerr' : 'Jellyseerr';

    return { name, connection, key: `media.requests:${fingerprint(connection)}` };
};

const readNumber = (value: unknown, field: string): number => {
    const number = Number(value);
    if (value === undefined || value === null || value === '' || !Number.isInteger(number) || number < 1) {
        throw new RealtimeError('BAD_REQUEST', `${field} is required`);
    }
    return number;
};

/** Wraps a request-manager call: resolves the item, runs it, and words failures for the user. */
const requestManagerMethod = <T>(
    mode: 'read' | 'write',
    run: (target: Target, params: Record<string, unknown>, context: MethodContext) => Promise<T>
) => async (context: MethodContext): Promise<T> => {
    const target = resolveRequestManager(context.principal, context.itemId, mode);
    const params = (context.params && typeof context.params === 'object' ? context.params : {}) as Record<string, unknown>;

    try {
        return await run(target, params, context);
    } catch (error) {
        throw describeUpstreamError(target.name, error);
    }
};

export const registerMediaTopics = (registry: Registry): void => {
    // What is playing on a Jellyfin or Emby server, and how large its libraries are
    registry.topic('media.sessions', (principal, itemId) => {
        const { name, connection, key } = resolveMediaServer(principal, itemId);

        return {
            key,
            // Playback position is only interesting while someone is watching
            intervalMs: data => ((data as MediaServerSnapshot | undefined)?.sessions.length ? 15_000 : 60_000),
            read: async signal => {
                try {
                    return await readMediaServer(connection, signal);
                } catch (error) {
                    throw describeUpstreamError(name, error);
                }
            }
        };
    });

    // The latest media requests of a Jellyseerr or Overseerr instance
    registry.topic('media.requests', (principal, itemId) => {
        const { name, connection, key } = resolveRequestManager(principal, itemId, 'read');

        return {
            key,
            intervalMs: 20_000,
            read: async signal => {
                try {
                    return await readMediaRequests(connection, signal);
                } catch (error) {
                    throw describeUpstreamError(name, error);
                }
            }
        };
    });

    registry
        .method('media.search', requestManagerMethod('read', ({ connection }, { query }) => {
            if (typeof query !== 'string' || !query.trim() || query.length > 200) {
                throw new RealtimeError('BAD_REQUEST', 'Search query is required');
            }
            return searchMedia(connection, query.trim());
        }))
        .method('media.tvDetails', requestManagerMethod('read', ({ connection }, { tmdbId }) => (
            readTvDetails(connection, readNumber(tmdbId, 'tmdbId'))
        )))
        // Requesting, approving and declining act on the owner's Jellyseerr account: admins only
        .method('media.request', requestManagerMethod('write', async ({ connection, key }, { mediaType, mediaId, seasons }, { hub }) => {
            if (mediaType !== 'movie' && mediaType !== 'tv') {
                throw new RealtimeError('BAD_REQUEST', 'mediaType and mediaId are required');
            }
            const seasonNumbers = Array.isArray(seasons) ? seasons.filter(Number.isInteger).slice(0, 200) as number[] : undefined;

            await createMediaRequest(connection, mediaType, readNumber(mediaId, 'mediaId'), seasonNumbers);
            hub.refresh(key);
            return { success: true };
        }))
        .method('media.approve', requestManagerMethod('write', async ({ connection, key }, { requestId }, { hub }) => {
            await moderateMediaRequest(connection, readNumber(requestId, 'requestId'), 'approve');
            hub.refresh(key);
            return { success: true };
        }))
        .method('media.decline', requestManagerMethod('write', async ({ connection, key }, { requestId }, { hub }) => {
            await moderateMediaRequest(connection, readNumber(requestId, 'requestId'), 'decline');
            hub.refresh(key);
            return { success: true };
        }));
};
