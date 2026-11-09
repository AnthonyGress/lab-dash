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

const read = (itemId: string): Promise<any> => registry.resolveTopic('arr.queue', GUEST, itemId).read(signal);
const removeAs = (principal: Principal, itemId: string, params: unknown): Promise<unknown> => (
    registry.call('arr.queue.remove', { principal, itemId, params, hub })
);

const addItem = (id: string, type: string, config: Record<string, unknown>, adminOnly = false): void => {
    updateConfig(draft => {
        draft.layout.desktop = draft.layout.desktop.filter(item => item.id !== id);
        draft.layout.desktop.push({ id, label: id, type, adminOnly, config });
    });
};

describe('Sonarr and Radarr', () => {
    let fake: Fake;
    let queue: any[] = [];
    const paths = () => fake.seen.map(request => `${request.method} ${request.url}`);

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.headers['x-api-key'] !== 'arr-key') {
                response.writeHead(401).end();
                return;
            }
            const path = request.url.split('?')[0];
            if (path === '/api/v3/queue') {
                json(response, { records: queue });
            } else if (path === '/api/v3/movie' || path === '/api/v3/series') {
                json(response, [{ monitored: true, overview: 'x'.repeat(500) }, { monitored: true }, { monitored: false }]);
            } else {
                json(response, {});
            }
        });
        const connection = { host: '127.0.0.1', port: String(fake.port), apiKey: encrypt('arr-key') };
        addItem('radarr', 'radarr-widget', connection);
        addItem('sonarr', 'sonarr-widget', connection);
        addItem('radarr-private', 'radarr-widget', connection, true);
    });

    after(() => fake.server.close());

    it('lists the queue with only the fields the widget shows, most active first', async () => {
        queue = [
            { id: 7, downloadId: 'dl-7', title: 'Paused.Release', status: 'paused', size: 100, sizeleft: 90, protocol: 'torrent', downloadClient: 'qBit', indexer: 'idx', movie: { title: 'Paused Movie', year: 2020, overview: 'long text' } },
            { id: 8, title: 'Active.Release', status: 'downloading', size: 200, sizeleft: 50, timeleft: '00:10:05', protocol: 'usenet' },
            { id: 9, title: 'Stuck.Release', status: 'unknownStatus', trackedDownloadStatus: 'ok', trackedDownloadState: 'stalledDL', size: 0, sizeleft: 0 }
        ];

        const snapshot = await read('radarr');

        assert.deepEqual(snapshot.queue, [
            { id: 8, hash: '8', name: 'Active.Release', state: 'downloading', progress: 0.75, size: 200, eta: 605, protocol: 'usenet', downloadClient: 'Unknown', indexer: 'Unknown' },
            { id: 7, hash: 'dl-7', name: 'Paused Movie (2020)', state: 'paused', progress: 0.1, size: 100, eta: undefined, protocol: 'torrent', downloadClient: 'qBit', indexer: 'idx' },
            { id: 9, hash: '9', name: 'Stuck.Release', state: 'stalled', progress: 0, size: 0, eta: undefined, protocol: 'Unknown', downloadClient: 'Unknown', indexer: 'Unknown' }
        ]);
        assert.deepEqual(snapshot.statistics, { totalItems: 3, monitoredItems: 2 });
    });

    it('names Sonarr episodes by series, number and title', async () => {
        queue = [{ id: 1, title: 'Show.S01E04.Release', status: 'queued', size: 10, sizeleft: 10, episode: { title: 'Pilot', episodeNumber: 4, series: { title: 'The Show' } } }];

        assert.equal((await read('sonarr')).queue[0].name, 'The Show - S00E04 - Pilot');
    });

    it('fetches the large library list only once in a while', async () => {
        queue = [];
        await read('radarr');
        fake.seen.length = 0;
        await read('radarr');
        await read('radarr');

        assert.deepEqual(paths(), ['GET /api/v3/queue', 'GET /api/v3/queue']);
    });

    it('asks for fresh download progress only while something is downloading', async () => {
        queue = [{ id: 8, title: 'Active', status: 'downloading', size: 200, sizeleft: 50 }];
        await read('radarr');
        fake.seen.length = 0;
        await read('radarr');
        assert.deepEqual(paths(), ['POST /api/v3/command', 'GET /api/v3/queue']);
        assert.deepEqual(JSON.parse(fake.seen[0].body), { name: 'RefreshMonitoredDownloads' });

        queue = [];
        await read('radarr');
        fake.seen.length = 0;
        await read('radarr');
        assert.deepEqual(paths(), ['GET /api/v3/queue']);
    });

    it('polls quickly while downloading and slowly when idle', () => {
        const interval = registry.resolveTopic('arr.queue', GUEST, 'radarr').intervalMs as (data: unknown) => number;

        assert.equal(interval({ queue: [{ state: 'downloading' }] }), 2000);
        assert.equal(interval({ queue: [{ state: 'paused' }] }), 20_000);
        assert.equal(interval(undefined), 20_000);
    });

    it('removes a queue item for admins, with the chosen options', async () => {
        fake.seen.length = 0;
        await removeAs(ADMIN, 'radarr', { id: '8' });
        await removeAs(ADMIN, 'radarr', { id: 9, removeFromClient: false, blocklist: true });

        assert.deepEqual(paths(), [
            'DELETE /api/v3/queue/8?removeFromClient=true&blocklist=false',
            'DELETE /api/v3/queue/9?removeFromClient=false&blocklist=true'
        ]);
    });

    it('never lets guests or regular accounts remove anything (#193)', async () => {
        fake.seen.length = 0;

        await assert.rejects(removeAs(GUEST, 'radarr', { id: 8 }), /Admin access required/);
        await assert.rejects(removeAs({ username: 'bob', role: 'user' }, 'sonarr', { id: 8 }), /Admin access required/);
        await assert.rejects(removeAs(GUEST, 'radarr-private', { id: 8 }), /Item not found/);
        assert.throws(() => registry.resolveTopic('arr.queue', GUEST, 'radarr-private'), /Item not found/);
        assert.equal(fake.seen.length, 0);
    });

    it('rejects a missing queue id, and reports bad or missing API keys', async () => {
        await assert.rejects(removeAs(ADMIN, 'radarr', {}), /Queue item id is required/);

        addItem('radarr-wrong', 'radarr-widget', { host: '127.0.0.1', port: String(fake.port), apiKey: 'nope' });
        await assert.rejects(read('radarr-wrong'), { message: 'Radarr rejected the saved credentials' });

        addItem('sonarr-empty', 'sonarr-widget', { host: '127.0.0.1', port: String(fake.port) });
        await assert.rejects(read('sonarr-empty'), { message: 'API key is required or could not be decrypted' });
    });
});
