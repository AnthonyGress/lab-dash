// Must stay first: it swaps in the test config before any app module loads
// eslint-disable-next-line import/order
import './helpers/fixture-config';

import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { createRegistry } from '../src/realtime';
import { Principal } from '../src/realtime/access';
import { PollerHub } from '../src/realtime/hub';
import { updateConfig } from '../src/services/config-store';
import { encrypt } from '../src/utils/crypto';

const ADMIN: Principal = { username: 'admin', role: 'admin' };
const GUEST: Principal = undefined;

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders; body: string };
type Fake = { server: http.Server; port: number; seen: Seen[] };

/** A stand-in for a download client's web API. */
const startFake = async (
    handle: (request: Seen, response: http.ServerResponse) => void
): Promise<Fake> => {
    const seen: Seen[] = [];
    const server = http.createServer((request, response) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk;
        });
        request.on('end', () => {
            const entry = { method: request.method ?? '', url: request.url ?? '', headers: request.headers, body };
            seen.push(entry);
            handle(entry, response);
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return { server, port: (server.address() as AddressInfo).port, seen };
};

const json = (response: http.ServerResponse, body: unknown, headers: http.OutgoingHttpHeaders = {}): void => {
    response.writeHead(200, { 'content-type': 'application/json', ...headers });
    response.end(JSON.stringify(body));
};

const registry = createRegistry();
const hub = new PollerHub();
const signal = new AbortController().signal;

const read = (itemId: string, principal: Principal = GUEST): Promise<any> => (
    registry.resolveTopic('download.client', principal, itemId).read(signal)
);
const callAs = (principal: Principal, method: string, itemId: string, params: unknown): Promise<unknown> => (
    registry.call(method, { principal, itemId, params, hub })
);
const call = (method: string, itemId: string, params: unknown): Promise<unknown> => callAs(ADMIN, method, itemId, params);

const addItem = (id: string, config: Record<string, unknown>, adminOnly = false): void => {
    updateConfig(draft => {
        draft.layout.desktop = draft.layout.desktop.filter(item => item.id !== id);
        draft.layout.desktop.push({ id, label: id, type: 'download-client', adminOnly, config });
    });
};

describe('qBittorrent', () => {
    let fake: Fake;
    let validSid = 'sid-1';
    let logins = 0;

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.url === '/api/v2/auth/login') {
                logins += 1;
                const accepted = request.body === 'username=user&password=secret';
                response.writeHead(200, accepted ? { 'set-cookie': `SID=${validSid}; HttpOnly; path=/` } : {});
                response.end(accepted ? 'Ok.' : 'Fails.');
                return;
            }
            if (!String(request.headers.cookie).includes(`SID=${validSid}`)) {
                response.writeHead(403).end('Forbidden');
                return;
            }
            if (request.url === '/api/v2/transfer/info') {
                json(response, { dl_info_speed: 1000, up_info_speed: 50, dl_info_data: 5000, up_info_data: 700 });
            } else if (request.url === '/api/v2/torrents/info') {
                json(response, [
                    { hash: 'aaa', name: 'Seeding', state: 'uploading', progress: 1, size: 10, dlspeed: 0, upspeed: 5, eta: 0, tracker: 'x', save_path: '/secret/path' },
                    { hash: 'bbb', name: 'Active', state: 'downloading', progress: 0.4, size: 20, dlspeed: 9, upspeed: 0, eta: 60, tracker: 'y' },
                    { hash: 'ccc', name: 'Paused', state: 'pausedDL', progress: 0.1, size: 30, dlspeed: 0, upspeed: 0, eta: 0 }
                ]);
            } else {
                response.writeHead(200).end();
            }
        });
        addItem('qbit', { clientType: 'qbittorrent', host: `http://127.0.0.1/`, port: String(fake.port), username: 'user', password: encrypt('secret') });
    });

    after(() => fake.server.close());

    it('logs in with the saved credentials and returns only what the widget shows', async () => {
        const snapshot = await read('qbit');

        assert.deepEqual(snapshot.stats, {
            dl_info_speed: 1000,
            up_info_speed: 50,
            dl_info_data: 5000,
            up_info_data: 700,
            torrents: { total: 3, downloading: 1, seeding: 1, completed: 1, paused: 1 }
        });
        // Downloading first, then least complete
        assert.deepEqual(snapshot.torrents.map((torrent: any) => torrent.hash), ['bbb', 'ccc', 'aaa']);
        assert.deepEqual(snapshot.torrents[0], {
            hash: 'bbb', name: 'Active', state: 'downloading', progress: 0.4, size: 20, dlspeed: 9, upspeed: 0, eta: 60
        });
    });

    it('reuses the session, and logs in again when qBittorrent drops it', async () => {
        const loginsBefore = logins;
        await read('qbit');
        assert.equal(logins, loginsBefore);

        validSid = 'sid-2';
        await read('qbit');
        assert.equal(logins, loginsBefore + 1);
    });

    it('polls quickly while something is downloading', () => {
        const source = registry.resolveTopic('download.client', GUEST, 'qbit');
        const interval = source.intervalMs as (data: unknown) => number;

        assert.equal(interval({ torrents: [{ state: 'downloading' }] }), 2000);
        assert.equal(interval({ torrents: [{ state: 'pausedDL' }] }), 20_000);
        assert.equal(interval(undefined), 20_000);
    });

    it('sends pause, resume and delete to the right endpoints', async () => {
        fake.seen.length = 0;
        await call('download.pause', 'qbit', { id: 'bbb' });
        await call('download.resume', 'qbit', { id: 'bbb' });
        await call('download.remove', 'qbit', { id: 'bbb', deleteFiles: true });

        assert.deepEqual(
            fake.seen.map(request => `${request.url} ${request.body}`),
            [
                '/api/v2/torrents/stop hashes=bbb',
                '/api/v2/torrents/start hashes=bbb',
                '/api/v2/torrents/delete hashes=bbb&deleteFiles=true'
            ]
        );
    });

    it('lets guests watch a public client but never control it', async () => {
        fake.seen.length = 0;

        await assert.rejects(callAs(GUEST, 'download.pause', 'qbit', { id: 'bbb' }), /Admin access required/);
        await assert.rejects(callAs({ username: 'bob', role: 'user' }, 'download.remove', 'qbit', { id: 'bbb' }), /Admin access required/);
        assert.equal(fake.seen.length, 0);
    });

    it('hides an admin-only client from guests', async () => {
        addItem('qbit-private', { clientType: 'qbittorrent', host: '127.0.0.1', port: String(fake.port), username: 'user', password: 'secret' }, true);

        assert.throws(() => registry.resolveTopic('download.client', GUEST, 'qbit-private'), /Item not found/);
        await assert.rejects(callAs(GUEST, 'download.pause', 'qbit-private', { id: 'bbb' }), /Item not found/);
        assert.equal((await read('qbit-private', ADMIN)).torrents.length, 3);
    });

    it('explains a wrong password, an undecryptable one, and an unreachable client without leaking addresses', async () => {
        addItem('qbit-wrong', { clientType: 'qbittorrent', host: '127.0.0.1', port: String(fake.port), username: 'user', password: 'nope' });
        await assert.rejects(read('qbit-wrong'), { message: 'qBittorrent rejected the saved credentials' });

        addItem('qbit-undecryptable', { clientType: 'qbittorrent', host: '127.0.0.1', port: String(fake.port), username: 'user', password: 'ENC:bad:data' });
        assert.throws(
            () => registry.resolveTopic('download.client', GUEST, 'qbit-undecryptable'),
            /Failed to decrypt password/
        );

        addItem('qbit-offline', { clientType: 'qbittorrent', host: '127.0.0.1', port: '1', username: 'user', password: 'secret' });
        await assert.rejects(read('qbit-offline'), { message: 'qBittorrent is unreachable' });
    });

    it('rejects actions without a download id and unknown client types', async () => {
        await assert.rejects(call('download.pause', 'qbit', {}), /Download id is required/);

        addItem('mystery', { clientType: 'rtorrent', host: '127.0.0.1', port: '1' });
        assert.throws(() => registry.resolveTopic('download.client', ADMIN, 'mystery'), /Unsupported download client/);
    });
});

describe('Deluge', () => {
    let fake: Fake;
    let validCookie = 'session-1';
    let logins = 0;

    before(async () => {
        fake = await startFake((request, response) => {
            const { method, params } = JSON.parse(request.body);
            if (method === 'auth.login') {
                logins += 1;
                const accepted = params[0] === 'deluge-pass';
                json(response, { result: accepted, error: null }, accepted ? { 'set-cookie': `_session_id=${validCookie}` } : {});
                return;
            }
            if (!String(request.headers.cookie).includes(validCookie)) {
                json(response, { result: null, error: { message: 'Not authenticated', code: 1 } });
                return;
            }
            if (method === 'web.update_ui') {
                json(response, {
                    result: {
                        stats: { download_rate: 300, upload_rate: 20 },
                        torrents: {
                            h1: { name: 'Queued', state: 'Queued', progress: 0, download_payload_rate: 0, upload_payload_rate: 0, total_size: 5, eta: 0 },
                            h2: { name: 'Going', state: 'Downloading', progress: 50, download_payload_rate: 300, upload_payload_rate: 1, total_size: 8, eta: 30 },
                            h3: { name: 'Done', state: 'Seeding', progress: 100, download_payload_rate: 0, upload_payload_rate: 19, total_size: 9, eta: 0 }
                        }
                    },
                    error: null
                });
            } else if (method === 'core.get_session_status') {
                json(response, { result: { total_download: 111, total_upload: 222 }, error: null });
            } else {
                json(response, { result: null, error: null });
            }
        });
        addItem('deluge', { clientType: 'deluge', host: '127.0.0.1', port: String(fake.port), password: 'deluge-pass' });
    });

    after(() => fake.server.close());

    it('maps Deluge torrents and totals to the common shape', async () => {
        const snapshot = await read('deluge');

        assert.deepEqual(snapshot.stats, {
            dl_info_speed: 300,
            up_info_speed: 20,
            dl_info_data: 111,
            up_info_data: 222,
            torrents: { total: 3, downloading: 1, seeding: 1, completed: 1, paused: 0 }
        });
        assert.deepEqual(snapshot.torrents.map((torrent: any) => [torrent.hash, torrent.state, torrent.progress]), [
            ['h2', 'downloading', 0.5],
            ['h1', 'stalledDL', 0],
            ['h3', 'seeding', 1]
        ]);
    });

    it('logs in again when the session cookie is no longer accepted', async () => {
        const loginsBefore = logins;
        validCookie = 'session-2';

        assert.equal((await read('deluge')).torrents.length, 3);
        assert.equal(logins, loginsBefore + 1);
    });

    it('sends pause, resume and remove as RPC calls', async () => {
        fake.seen.length = 0;
        await call('download.pause', 'deluge', { id: 'h2' });
        await call('download.resume', 'deluge', { id: 'h2' });
        await call('download.remove', 'deluge', { id: 'h2', deleteFiles: false });

        assert.deepEqual(fake.seen.map(request => JSON.parse(request.body)).map(({ method, params }) => [method, params]), [
            ['core.pause_torrent', [['h2']]],
            ['core.resume_torrent', [['h2']]],
            ['core.remove_torrent', ['h2', false]]
        ]);
    });

    it('reports a rejected password', async () => {
        addItem('deluge-wrong', { clientType: 'deluge', host: '127.0.0.1', port: String(fake.port), password: 'wrong' });
        await assert.rejects(read('deluge-wrong'), { message: 'Deluge rejected the saved password' });
    });
});

describe('Transmission', () => {
    let fake: Fake;
    let sessionId = 'token-1';

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.headers.authorization !== `Basic ${Buffer.from('tr-user:tr-pass').toString('base64')}`) {
                response.writeHead(401).end();
                return;
            }
            if (request.headers['x-transmission-session-id'] !== sessionId) {
                response.writeHead(409, { 'x-transmission-session-id': sessionId }).end();
                return;
            }

            const { method } = JSON.parse(request.body);
            if (method === 'session-stats') {
                json(response, {
                    result: 'success',
                    arguments: {
                        downloadSpeed: 400, uploadSpeed: 40, torrentCount: 2, activeTorrentCount: 1, pausedTorrentCount: 1,
                        'cumulative-stats': { downloadedBytes: 9000, uploadedBytes: 800 }
                    }
                });
            } else if (method === 'torrent-get') {
                json(response, {
                    result: 'success',
                    arguments: {
                        torrents: [
                            { id: 1, hashString: 'tr-a', name: 'Stopped', status: 0, percentDone: 0.2, totalSize: 50, rateDownload: 0, rateUpload: 0, eta: -1 },
                            { id: 2, hashString: 'tr-b', name: 'Loading', status: 4, percentDone: 0.7, totalSize: 60, rateDownload: 400, rateUpload: 3, eta: 120 }
                        ]
                    }
                });
            } else {
                json(response, { result: 'success', arguments: {} });
            }
        });
        addItem('transmission', { clientType: 'transmission', host: '127.0.0.1', port: String(fake.port), username: 'tr-user', password: 'tr-pass' });
    });

    after(() => fake.server.close());

    it('completes the session handshake and maps status codes', async () => {
        const snapshot = await read('transmission');

        assert.deepEqual(snapshot.stats, {
            dl_info_speed: 400,
            dl_info_data: 9000,
            up_info_speed: 40,
            up_info_data: 800,
            torrents: { total: 2, downloading: 1, seeding: 1, completed: 0, paused: 1 }
        });
        assert.deepEqual(snapshot.torrents, [
            { hash: 'tr-b', name: 'Loading', state: 'downloading', progress: 0.7, size: 60, dlspeed: 400, upspeed: 3, eta: 120 },
            { hash: 'tr-a', name: 'Stopped', state: 'stopped', progress: 0.2, size: 50, dlspeed: 0, upspeed: 0, eta: undefined }
        ]);
    });

    it('picks up a renewed session token', async () => {
        sessionId = 'token-2';
        assert.equal((await read('transmission')).torrents.length, 2);
    });

    it('sends stop, start and remove with the torrent hash', async () => {
        fake.seen.length = 0;
        await call('download.pause', 'transmission', { id: 'tr-b' });
        await call('download.resume', 'transmission', { id: 'tr-b' });
        await call('download.remove', 'transmission', { id: 'tr-b', deleteFiles: true });

        assert.deepEqual(fake.seen.map(request => JSON.parse(request.body)), [
            { method: 'torrent-stop', arguments: { ids: ['tr-b'] } },
            { method: 'torrent-start', arguments: { ids: ['tr-b'] } },
            { method: 'torrent-remove', arguments: { ids: ['tr-b'], 'delete-local-data': true } }
        ]);
    });

    it('reports rejected credentials', async () => {
        addItem('transmission-wrong', { clientType: 'transmission', host: '127.0.0.1', port: String(fake.port), username: 'tr-user', password: 'bad' });
        await assert.rejects(read('transmission-wrong'), { message: 'Transmission rejected the saved credentials' });
    });
});

describe('SABnzbd', () => {
    let fake: Fake;

    before(async () => {
        fake = await startFake((request, response) => {
            const params = new URL(request.url, 'http://localhost').searchParams;
            if (params.get('apikey') !== 'sab-key') {
                json(response, { status: false, error: 'API Key Incorrect' });
                return;
            }

            const mode = params.get('mode');
            if (mode === 'queue' && !params.get('name')) {
                json(response, {
                    queue: {
                        kbpersec: '2048.00',
                        noofslots: 2,
                        paused: false,
                        slots: [
                            { nzo_id: 'nzo-1', filename: 'First', status: 'Downloading', percentage: '25', mb: '1000', mbleft: '750', timeleft: '0:10:30' },
                            { nzo_id: 'nzo-2', filename: 'Second', status: 'Queued', percentage: '0', mb: '500', mbleft: '500', timeleft: '1:00:00:00' }
                        ]
                    }
                });
            } else if (mode === 'history') {
                json(response, { history: { noofslots: 7, slots: [] } });
            } else if (mode === 'server_stats') {
                json(response, { month: 123456 });
            } else {
                json(response, { status: true });
            }
        });
        addItem('sab', { clientType: 'sabnzbd', host: '127.0.0.1', port: String(fake.port), password: encrypt('sab-key') });
    });

    after(() => fake.server.close());

    it('reads the queue in its own order, with the speed on the active job', async () => {
        const snapshot = await read('sab');

        assert.deepEqual(snapshot.stats, {
            dl_info_speed: 2048 * 1024,
            dl_info_data: 123456,
            up_info_speed: 0,
            up_info_data: 0,
            torrents: { total: 9, downloading: 2, seeding: 0, completed: 7, paused: 0 }
        });
        assert.deepEqual(snapshot.torrents, [
            { hash: 'nzo-1', name: 'First', state: 'downloading', progress: 0.25, size: 1000 * 1024 * 1024, dlspeed: 2048 * 1024, upspeed: 0, eta: 630 },
            { hash: 'nzo-2', name: 'Second', state: 'queued', progress: 0, size: 500 * 1024 * 1024, dlspeed: 0, upspeed: 0, eta: 86400 }
        ]);
    });

    it('sends pause, resume and delete', async () => {
        fake.seen.length = 0;
        await call('download.pause', 'sab', { id: 'nzo-1' });
        await call('download.resume', 'sab', { id: 'nzo-1' });
        await call('download.remove', 'sab', { id: 'nzo-1', deleteFiles: true });

        const sent = fake.seen.map(request => Object.fromEntries(new URL(request.url, 'http://localhost').searchParams));
        assert.deepEqual(sent.map(({ mode, name, value, del_files }) => ({ mode, name, value, del_files })), [
            { mode: 'pause', name: undefined, value: undefined, del_files: undefined },
            { mode: 'resume', name: undefined, value: undefined, del_files: undefined },
            { mode: 'queue', name: 'delete', value: 'nzo-1', del_files: '1' }
        ]);
    });

    it('reports a rejected or missing API key', async () => {
        addItem('sab-wrong', { clientType: 'sabnzbd', host: '127.0.0.1', port: String(fake.port), apiKey: 'nope' });
        await assert.rejects(read('sab-wrong'), { message: 'SABnzbd rejected the saved API key' });

        addItem('sab-empty', { clientType: 'sabnzbd', host: '127.0.0.1', port: String(fake.port) });
        await assert.rejects(read('sab-empty'), { message: 'API key must be configured for this item' });
    });
});

describe('NZBGet', () => {
    let fake: Fake;

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.headers.authorization !== `Basic ${Buffer.from('nzb-user:nzb-pass').toString('base64')}`) {
                response.writeHead(401).end();
                return;
            }

            const { method } = JSON.parse(request.body);
            if (method === 'status') {
                json(response, { result: { DownloadRate: 5000, DownloadedSizeMB: 2, DownloadedFileCount: 4, PostJobCount: 1, DownloadPaused: false } });
            } else if (method === 'history') {
                json(response, { result: [{ Status: 'SUCCESS' }, { Status: 'FAILURE' }, { Status: 'SUCCESS' }] });
            } else if (method === 'listgroups') {
                json(response, {
                    result: [
                        { NZBID: 11, NZBName: 'Active job', Status: 'DOWNLOADING', FileSizeMB: 100, RemainingSizeMB: 50 },
                        { NZBID: 12, NZBName: 'Waiting job', Status: 'QUEUED', FileSizeMB: 10, RemainingSizeMB: 10 }
                    ]
                });
            } else {
                json(response, { result: true });
            }
        });
        addItem('nzbget', { clientType: 'nzbget', host: '127.0.0.1', port: String(fake.port), username: 'nzb-user', password: 'nzb-pass' });
    });

    after(() => fake.server.close());

    it('maps the queue and totals to the common shape', async () => {
        const snapshot = await read('nzbget');
        const megabyte = 1024 * 1024;

        assert.deepEqual(snapshot.stats, {
            dl_info_speed: 5000,
            dl_info_data: 2 * megabyte,
            up_info_speed: 0,
            up_info_data: 0,
            torrents: { total: 4, downloading: 1, seeding: 0, completed: 2, paused: 0 }
        });
        assert.deepEqual(snapshot.torrents, [
            { hash: '11', name: 'Active job', state: 'downloading', progress: 0.5, size: 100 * megabyte, dlspeed: 5000, upspeed: 0, eta: Math.round(50 * megabyte / 5000) },
            { hash: '12', name: 'Waiting job', state: 'queued', progress: 0, size: 10 * megabyte, dlspeed: 0, upspeed: 0, eta: undefined }
        ]);
        assert.equal(registry.resolveTopic('download.client', GUEST, 'nzbget').intervalMs, 5000);
    });

    it('edits the queue for pause, resume and delete', async () => {
        fake.seen.length = 0;
        await call('download.pause', 'nzbget', { id: '11' });
        await call('download.resume', 'nzbget', { id: '11' });
        await call('download.remove', 'nzbget', { id: '11' });

        assert.deepEqual(fake.seen.map(request => JSON.parse(request.body).params), [
            ['GroupPause', 0, '', [11]],
            ['GroupResume', 0, '', [11]],
            ['GroupDelete', 0, '', [11]]
        ]);
    });

    it('reports rejected credentials', async () => {
        addItem('nzbget-wrong', { clientType: 'nzbget', host: '127.0.0.1', port: String(fake.port), username: 'nzb-user', password: 'bad' });
        await assert.rejects(read('nzbget-wrong'), { message: 'NZBGet rejected the saved credentials' });
    });
});

describe('shared polling', () => {
    it('uses one poller for two widgets that point at the same client', () => {
        addItem('twin-a', { clientType: 'deluge', host: '10.1.1.1', port: '8112', password: 'p' });
        addItem('twin-b', { clientType: 'deluge', host: 'http://10.1.1.1', port: '8112', password: 'p' });
        addItem('other-login', { clientType: 'deluge', host: '10.1.1.1', port: '8112', password: 'different' });

        const key = (itemId: string) => registry.resolveTopic('download.client', ADMIN, itemId).key;

        assert.equal(key('twin-a'), key('twin-b'));
        assert.notEqual(key('twin-a'), key('other-login'));
        // The key is logged on failures, so it must not contain the address or password
        assert.doesNotMatch(key('twin-a'), /10\.1\.1\.1|8112/);
    });
});
