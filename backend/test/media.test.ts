// Must stay first: it swaps in the test config before any app module loads
// eslint-disable-next-line import/order
import './helpers/fixture-config';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { Fake, json, startFake } from './helpers/fake-upstream';
import { createRegistry } from '../src/realtime';
import { Principal } from '../src/realtime/access';
import { PollerHub } from '../src/realtime/hub';
import { updateConfig } from '../src/services/config-store';
import { encrypt } from '../src/utils/crypto';

const ADMIN: Principal = { username: 'admin', role: 'admin' };
const GUEST: Principal = undefined;

const registry = createRegistry();
const hub = new PollerHub();
const signal = new AbortController().signal;

const read = (topic: string, itemId: string): Promise<any> => registry.resolveTopic(topic, GUEST, itemId).read(signal);
const callAs = (principal: Principal, method: string, itemId: string, params?: unknown): Promise<any> => (
    registry.call(method, { principal, itemId, params, hub })
);

const addItem = (id: string, type: string, config: Record<string, unknown>): void => {
    updateConfig(draft => {
        draft.layout.desktop = draft.layout.desktop.filter(item => item.id !== id);
        draft.layout.desktop.push({ id, label: id, type, config });
    });
};

describe('Jellyfin', () => {
    let fake: Fake;

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.headers['x-mediabrowser-token'] !== 'jf-key') {
                response.writeHead(401).end();
                return;
            }
            if (request.url === '/Sessions') {
                json(response, [
                    { Id: 'idle', UserName: 'ann', DeviceName: 'Phone' },
                    {
                        Id: 'watching', UserName: 'bob', DeviceName: 'TV', Client: 'Web', RemoteEndPoint: '203.0.113.9',
                        PlayState: { IsPaused: false, PositionTicks: 600, PlayMethod: 'DirectPlay', MediaSourceId: 'x' },
                        NowPlayingItem: { Id: 'ep1', Name: 'Pilot', Type: 'Episode', RunTimeTicks: 1200, SeriesName: 'Show', IndexNumber: 1, ParentIndexNumber: 2, ImageTags: { Primary: 'tag' }, Path: '/media/show/s02e01.mkv' }
                    }
                ]);
            } else if (request.url.startsWith('/Items?IncludeItemTypes=Series')) {
                json(response, { Items: [], TotalRecordCount: 42 });
            } else if (request.url.startsWith('/Items?IncludeItemTypes=Movie')) {
                json(response, { Items: [], TotalRecordCount: 300 });
            } else {
                response.writeHead(404).end();
            }
        });
        addItem('jellyfin', 'media-server-widget', { clientType: 'jellyfin', host: '127.0.0.1', port: String(fake.port), apiKey: encrypt('jf-key') });
    });

    after(() => fake.server.close());

    it('lists who is watching, without file paths or client addresses', async () => {
        const snapshot = await read('media.sessions', 'jellyfin');

        assert.deepEqual(snapshot.sessions, [{
            Id: 'watching',
            UserName: 'bob',
            Client: 'Web',
            DeviceName: 'TV',
            PlayState: { IsPaused: false, PositionTicks: 600, PlayMethod: 'DirectPlay' },
            NowPlayingItem: {
                Id: 'ep1', Name: 'Pilot', Type: 'Episode', RunTimeTicks: 1200, ProductionYear: undefined,
                SeriesName: 'Show', SeasonName: undefined, IndexNumber: 1, ParentIndexNumber: 2, ImageTags: { Primary: 'tag' }
            }
        }]);
        assert.deepEqual(snapshot.libraryStats, { tvShows: 42, movies: 300 });
    });

    it('counts the libraries without downloading them, and only now and then', async () => {
        assert.ok(fake.seen.filter(request => request.url.startsWith('/Items')).every(request => request.url.includes('Limit=0')));

        fake.seen.length = 0;
        await read('media.sessions', 'jellyfin');
        assert.deepEqual(fake.seen.map(request => request.url), ['/Sessions']);
    });

    it('refreshes more often while someone is watching', () => {
        const interval = registry.resolveTopic('media.sessions', GUEST, 'jellyfin').intervalMs as (data: unknown) => number;
        assert.equal(interval({ sessions: [{}] }), 15_000);
        assert.equal(interval({ sessions: [] }), 60_000);
    });

    it('explains unsupported servers and rejected keys', async () => {
        addItem('plex', 'media-server-widget', { clientType: 'plex', host: '127.0.0.1', port: '1', apiKey: 'k' });
        assert.throws(() => registry.resolveTopic('media.sessions', GUEST, 'plex'), /plex is not yet supported/);

        addItem('jellyfin-wrong', 'media-server-widget', { host: '127.0.0.1', port: String(fake.port), apiKey: 'nope' });
        await assert.rejects(read('media.sessions', 'jellyfin-wrong'), { message: 'Jellyfin rejected the saved credentials' });
    });
});

describe('Jellyseerr', () => {
    let fake: Fake;
    const paths = () => fake.seen.map(request => `${request.method} ${request.url}`);

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.headers['x-api-key'] !== 'seerr-key') {
                response.writeHead(403).end();
                return;
            }
            const path = request.url.split('?')[0];
            if (request.method === 'GET' && path === '/api/v1/request') {
                json(response, {
                    results: Array.from({ length: 12 }, (_, index) => ({
                        id: index + 1,
                        type: 'movie',
                        status: 1,
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
                        requestedBy: { id: 5, displayName: 'Ann', email: 'ann@example.com', avatar: '/avatar/5', permissions: 2 },
                        seasons: index === 11 ? [{ id: 1, seasonNumber: 2, status: 1, createdAt: 'x' }] : [],
                        media: { id: 100 + index, mediaType: index === 11 ? 'tv' : 'movie', tmdbId: 500 + index, status: 2 }
                    }))
                });
            } else if (/^\/api\/v1\/(movie|tv)\/\d+$/.test(path)) {
                json(response, { title: `Title ${path.split('/').pop()}`, overview: 'About', releaseDate: '2025-05-05', posterPath: '/p.jpg', seasons: [{ seasonNumber: 1 }], mediaInfo: { status: 3, seasons: [{ seasonNumber: 1, status: 5, internal: true }], requests: [{ requestedBy: { email: 'x' } }] } });
            } else if (path === '/api/v1/search') {
                json(response, { results: [{ id: 9, mediaType: 'movie', title: 'Found', overview: 'o', releaseDate: '2024-01-01', posterPath: '/f.jpg', popularity: 99, mediaInfo: { requests: [{ requestedBy: { email: 'x' } }] } }] });
            } else {
                json(response, {});
            }
        });
        addItem('seerr', 'media-request-manager-widget', { service: 'jellyseerr', host: '127.0.0.1', port: String(fake.port), apiKey: encrypt('seerr-key') });
    });

    after(() => fake.server.close());

    it('lists the eight most recently updated requests, with titles and without e-mail addresses', async () => {
        const { requests } = await read('media.requests', 'seerr');

        assert.deepEqual(requests.map((request: any) => request.id), [12, 11, 10, 9, 8, 7, 6, 5]);
        assert.deepEqual(requests[0], {
            id: 12,
            type: 'movie',
            status: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-12T00:00:00.000Z',
            profileName: undefined,
            seasons: [{ id: 1, seasonNumber: 2, status: 1 }],
            requestedBy: { id: 5, displayName: 'Ann', avatar: '/avatar/5' },
            media: { id: 111, mediaType: 'tv', tmdbId: 511, status: 2, status4k: undefined, title: 'Title 511', overview: 'About', releaseDate: '2025-05-05', posterPath: '/p.jpg' }
        });
        assert.doesNotMatch(JSON.stringify(requests), /example\.com|permissions/);
    });

    it('looks titles up once instead of on every refresh', async () => {
        fake.seen.length = 0;
        await read('media.requests', 'seerr');

        assert.deepEqual(paths(), ['GET /api/v1/request?take=50&skip=0&sort=added']);
    });

    it('lets guests search and look at seasons on a public widget', async () => {
        const search = await callAs(GUEST, 'media.search', 'seerr', { query: ' found ' });
        assert.deepEqual(search.results, [{
            id: 9, mediaType: 'movie', title: 'Found', name: undefined, overview: 'o',
            releaseDate: '2024-01-01', firstAirDate: undefined, posterPath: '/f.jpg', status: undefined
        }]);
        assert.match(fake.seen.at(-1)!.url, /\/api\/v1\/search\?query=found$/);

        const details = await callAs(GUEST, 'media.tvDetails', 'seerr', { tmdbId: '77' });
        assert.deepEqual(details.mediaInfo, { status: 3, seasons: [{ seasonNumber: 1, status: 5 }] });
        assert.deepEqual(details.seasons, [{ seasonNumber: 1 }]);
    });

    it('creates, approves and declines requests for admins', async () => {
        fake.seen.length = 0;
        await callAs(ADMIN, 'media.request', 'seerr', { mediaType: 'tv', mediaId: '77', seasons: [1, 2] });
        await callAs(ADMIN, 'media.request', 'seerr', { mediaType: 'movie', mediaId: 9, seasons: [1] });
        await callAs(ADMIN, 'media.approve', 'seerr', { requestId: '4' });
        await callAs(ADMIN, 'media.decline', 'seerr', { requestId: 5 });

        assert.deepEqual(fake.seen.map(request => [request.url, JSON.parse(request.body)]), [
            ['/api/v1/request', { mediaType: 'tv', mediaId: 77, seasons: [1, 2] }],
            ['/api/v1/request', { mediaType: 'movie', mediaId: 9 }],
            ['/api/v1/request/4/approve', {}],
            ['/api/v1/request/5/decline', {}]
        ]);
    });

    it('never lets guests or regular accounts create or moderate requests (#193)', async () => {
        fake.seen.length = 0;
        const user: Principal = { username: 'bob', role: 'user' };

        await assert.rejects(callAs(GUEST, 'media.request', 'seerr', { mediaType: 'movie', mediaId: 9 }), /Admin access required/);
        await assert.rejects(callAs(GUEST, 'media.approve', 'seerr', { requestId: 4 }), /Admin access required/);
        await assert.rejects(callAs(user, 'media.decline', 'seerr', { requestId: 4 }), /Admin access required/);
        assert.equal(fake.seen.length, 0);
    });

    it('validates input and reports a rejected API key', async () => {
        await assert.rejects(callAs(GUEST, 'media.search', 'seerr', { query: '  ' }), /Search query is required/);
        await assert.rejects(callAs(ADMIN, 'media.request', 'seerr', { mediaType: 'book', mediaId: 1 }), /mediaType and mediaId are required/);
        await assert.rejects(callAs(ADMIN, 'media.approve', 'seerr', {}), /requestId is required/);

        addItem('seerr-wrong', 'media-request-manager-widget', { host: '127.0.0.1', port: String(fake.port), apiKey: 'nope' });
        await assert.rejects(read('media.requests', 'seerr-wrong'), { message: 'Jellyseerr rejected the saved credentials' });
    });
});
