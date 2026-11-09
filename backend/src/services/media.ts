import axios from 'axios';
import https from 'https';

import { RealtimeError } from '../realtime/access';
import { UpstreamConnection } from './upstream';

const TIMEOUT_MS = 10_000;
// Library sizes and titles change rarely and are costly to look up
const LIBRARY_TTL_MS = 15 * 60 * 1000;
const TITLE_TTL_MS = 6 * 60 * 60 * 1000;
const SHOWN_REQUESTS = 8;

// Allow self-signed certificates: these services usually sit on the local network
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

type Cached<T> = { expires: number; value: T };

const remember = async <T>(cache: Map<string, Cached<T>>, key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    const value = await load();
    cache.set(key, { expires: Date.now() + ttlMs, value });
    return value;
};

const requireApiKey = (connection: UpstreamConnection): string => {
    if (!connection.apiKey) {
        throw new RealtimeError('BAD_REQUEST', 'API key is required or could not be decrypted');
    }
    return connection.apiKey;
};

// ---------------------------------------------------------------- Jellyfin / Emby

export type MediaServerSnapshot = {
    /** Sessions that are playing something, reduced to what the widget shows */
    sessions: Array<Record<string, unknown>>;
    libraryStats: { tvShows: number; movies: number };
};

const libraryCache = new Map<string, Cached<MediaServerSnapshot['libraryStats']>>();

const jellyfin = async (connection: UpstreamConnection, path: string, signal: AbortSignal): Promise<any> => {
    const apiKey = requireApiKey(connection);

    return (await axios.get(`${connection.origin}${path}`, {
        headers: {
            Authorization: `MediaBrowser Token="${apiKey}"`,
            'X-MediaBrowser-Token': apiKey,
            Accept: 'application/json',
            'User-Agent': 'Lab-Dash/1.0'
        },
        timeout: TIMEOUT_MS,
        httpsAgent,
        signal
    })).data;
};

const countItems = async (connection: UpstreamConnection, type: string, signal: AbortSignal): Promise<number> => {
    // Limit=0 returns the total without transferring the library itself
    const result = await jellyfin(connection, `/Items?IncludeItemTypes=${type}&Recursive=true&Limit=0`, signal);
    return result?.TotalRecordCount ?? result?.Items?.length ?? 0;
};

export const readMediaServer = async (connection: UpstreamConnection, signal: AbortSignal): Promise<MediaServerSnapshot> => {
    const all: any[] = await jellyfin(connection, '/Sessions', signal) || [];

    const sessions = all.filter(session => session.NowPlayingItem).map(session => ({
        Id: session.Id,
        UserName: session.UserName,
        Client: session.Client,
        DeviceName: session.DeviceName,
        PlayState: session.PlayState && {
            IsPaused: session.PlayState.IsPaused,
            PositionTicks: session.PlayState.PositionTicks,
            PlayMethod: session.PlayState.PlayMethod
        },
        NowPlayingItem: {
            Id: session.NowPlayingItem.Id,
            Name: session.NowPlayingItem.Name,
            Type: session.NowPlayingItem.Type,
            RunTimeTicks: session.NowPlayingItem.RunTimeTicks,
            ProductionYear: session.NowPlayingItem.ProductionYear,
            SeriesName: session.NowPlayingItem.SeriesName,
            SeasonName: session.NowPlayingItem.SeasonName,
            IndexNumber: session.NowPlayingItem.IndexNumber,
            ParentIndexNumber: session.NowPlayingItem.ParentIndexNumber,
            ImageTags: { Primary: session.NowPlayingItem.ImageTags?.Primary }
        }
    }));

    // Library sizes are a nicety: what is playing is still worth showing without them
    const libraryStats = await remember(libraryCache, `${connection.origin}|${connection.apiKey}`, LIBRARY_TTL_MS, async () => {
        const [tvShows, movies] = await Promise.all([
            countItems(connection, 'Series', signal),
            countItems(connection, 'Movie', signal)
        ]);
        return { tvShows, movies };
    }).catch(() => ({ tvShows: 0, movies: 0 }));

    return { sessions, libraryStats };
};

// ---------------------------------------------------------------- Jellyseerr / Overseerr

const titleCache = new Map<string, Cached<Record<string, unknown>>>();

const seerr = async (
    connection: UpstreamConnection,
    method: 'get' | 'post',
    path: string,
    options: { params?: unknown; data?: unknown; signal?: AbortSignal } = {}
): Promise<any> => (await axios.request({
    url: `${connection.origin}/api/v1${path}`,
    method,
    headers: { 'X-Api-Key': requireApiKey(connection), 'Content-Type': 'application/json' },
    timeout: TIMEOUT_MS,
    httpsAgent,
    ...options
})).data;

/** The most recently touched requests, with titles, as the widget lists them. */
export const readMediaRequests = async (connection: UpstreamConnection, signal: AbortSignal) => {
    const list = await seerr(connection, 'get', '/request', { params: { take: 50, skip: 0, sort: 'added' }, signal });

    const recent: any[] = [...(list?.results || [])]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, SHOWN_REQUESTS);

    const requests = await Promise.all(recent.map(async request => {
        const media = request.media ?? {};
        const mediaType = media.mediaType === 'tv' ? 'tv' : 'movie';

        // The request itself carries no title; it is looked up once and kept
        const details = media.tmdbId
            ? await remember(titleCache, `${connection.origin}|${mediaType}|${media.tmdbId}`, TITLE_TTL_MS, async () => {
                const info = await seerr(connection, 'get', `/${mediaType}/${media.tmdbId}`, { signal });
                return {
                    title: info.title || info.name,
                    overview: info.overview,
                    releaseDate: info.releaseDate || info.firstAirDate,
                    posterPath: info.posterPath
                };
            }).catch(() => ({}))
            : {};

        return {
            id: request.id,
            type: request.type,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            profileName: request.profileName,
            seasons: (request.seasons || []).map((season: any) => ({
                id: season.id,
                seasonNumber: season.seasonNumber,
                status: season.status
            })),
            // Deliberately not the whole user record: it holds the e-mail address and permissions
            requestedBy: request.requestedBy && {
                id: request.requestedBy.id,
                displayName: request.requestedBy.displayName,
                avatar: request.requestedBy.avatar
            },
            media: {
                id: media.id,
                mediaType,
                tmdbId: media.tmdbId,
                status: media.status,
                status4k: media.status4k,
                ...details
            }
        };
    }));

    return { requests };
};

export const searchMedia = async (connection: UpstreamConnection, query: string) => {
    const data = await seerr(connection, 'get', `/search?query=${encodeURIComponent(query)}`);

    return {
        results: (data?.results || []).map((result: any) => ({
            id: result.id,
            mediaType: result.mediaType,
            title: result.title,
            name: result.name,
            overview: result.overview,
            releaseDate: result.releaseDate,
            firstAirDate: result.firstAirDate,
            posterPath: result.posterPath,
            status: result.status
        }))
    };
};

/** Seasons of a show and which of them are already requested or available. */
export const readTvDetails = async (connection: UpstreamConnection, tmdbId: number) => {
    const data = await seerr(connection, 'get', `/tv/${tmdbId}`);

    return {
        id: data.id,
        name: data.name,
        seasons: data.seasons || [],
        mediaInfo: data.mediaInfo && {
            status: data.mediaInfo.status,
            seasons: (data.mediaInfo.seasons || []).map((season: any) => ({
                seasonNumber: season.seasonNumber,
                status: season.status
            }))
        }
    };
};

export const createMediaRequest = async (
    connection: UpstreamConnection,
    mediaType: 'movie' | 'tv',
    mediaId: number,
    seasons?: number[]
): Promise<void> => {
    await seerr(connection, 'post', '/request', {
        data: { mediaType, mediaId, ...(mediaType === 'tv' && seasons?.length ? { seasons } : {}) }
    });
};

export const moderateMediaRequest = async (
    connection: UpstreamConnection,
    requestId: number,
    decision: 'approve' | 'decline'
): Promise<void> => {
    await seerr(connection, 'post', `/request/${requestId}/${decision}`, { data: {} });
};
