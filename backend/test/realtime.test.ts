// Must stay first: it swaps in the test config before any app module loads
// eslint-disable-next-line import/order
import { fixture, saveFixture } from './helpers/fixture-config';

import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { after, afterEach, before, describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import WebSocket from 'ws';

import { createRegistry } from '../src/realtime';
import { RealtimeError, resolveItem } from '../src/realtime/access';
import { endSession, RealtimeGateway } from '../src/realtime/gateway';
import { PollerHub, Subscriber } from '../src/realtime/hub';
import { Registry } from '../src/realtime/registry';
import { updateConfig } from '../src/services/config-store';
import { trackRequestOrigin } from '../src/utils/request-origin';
import { SECRET } from '../src/utils/secret';

const cookieFor = (role: string, options: jwt.SignOptions = {}): string => (
    `access_token=${jwt.sign({ username: role, role }, SECRET, options)}`
);

const until = async (condition: () => boolean, timeoutMs = 2000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Condition was not met in time');
        await sleep(5);
    }
};

describe('poller hub', () => {
    const recorder = () => {
        const seen = { data: [] as unknown[], errors: [] as string[] };
        const subscriber: Subscriber = {
            onData: json => seen.data.push(JSON.parse(json)),
            onError: message => seen.errors.push(message)
        };
        return { seen, subscriber };
    };

    it('reads once for any number of watchers and replays the last value to late joiners', async () => {
        const hub = new PollerHub();
        let reads = 0;
        const source = { key: 'shared', intervalMs: 10_000, read: async () => ({ reads: ++reads }) };
        const first = recorder();
        const second = recorder();

        hub.subscribe(source, first.subscriber);
        hub.subscribe(source, second.subscriber);
        await until(() => first.seen.data.length === 1 && second.seen.data.length === 1);

        const late = recorder();
        hub.subscribe({ ...source }, late.subscriber);

        assert.deepEqual(late.seen.data, [{ reads: 1 }]);
        assert.equal(reads, 1);
        assert.equal(hub.pollerCount, 1);
        hub.close();
    });

    it('does not resend data that has not changed', async () => {
        const hub = new PollerHub();
        let reads = 0;
        const { seen, subscriber } = recorder();

        hub.subscribe({ key: 'steady', intervalMs: 5, read: async () => (++reads, { value: 'same' }) }, subscriber);
        await until(() => reads >= 4);

        assert.deepEqual(seen.data, [{ value: 'same' }]);
        hub.close();
    });

    it('keeps the last value through a short absence, then lets go', async () => {
        const hub = new PollerHub({ lingerMs: 40 });
        let reads = 0;
        const source = { key: 'linger', intervalMs: 10_000, read: async () => ({ reads: ++reads }) };

        const first = recorder();
        const stop = hub.subscribe(source, first.subscriber);
        await until(() => first.seen.data.length === 1);
        stop();

        // Back within the linger window: served from memory at once
        const returning = recorder();
        const stopAgain = hub.subscribe(source, returning.subscriber);
        assert.deepEqual(returning.seen.data, [{ reads: 1 }]);
        stopAgain();

        await until(() => hub.pollerCount === 0);
    });

    it('stops reading while nobody is watching', async () => {
        const hub = new PollerHub({ lingerMs: 10_000 });
        let reads = 0;
        const { seen, subscriber } = recorder();

        const stop = hub.subscribe({ key: 'idle', intervalMs: 5, read: async () => ({ reads: ++reads }) }, subscriber);
        await until(() => seen.data.length >= 2);
        stop();
        await sleep(20);
        const readsAfterLeaving = reads;
        await sleep(40);

        assert.equal(reads, readsAfterLeaving);
        hub.close();
    });

    it('reports a failure once, hides internal details, and recovers', async () => {
        const hub = new PollerHub();
        let reads = 0;
        const { seen, subscriber } = recorder();
        const originalError = console.error;
        console.error = () => undefined;

        hub.subscribe({
            key: 'flaky',
            intervalMs: 5,
            read: async () => {
                reads += 1;
                if (reads <= 2) throw new Error('connect ECONNREFUSED 10.0.0.5:8080');
                return { ok: true };
            }
        }, subscriber);
        await until(() => seen.data.length === 1);
        console.error = originalError;

        assert.deepEqual(seen.errors, ['Service is unavailable']);
        assert.deepEqual(seen.data, [{ ok: true }]);
        hub.close();
    });

    it('passes on messages written for users', async () => {
        const hub = new PollerHub();
        const { seen, subscriber } = recorder();

        hub.subscribe({
            key: 'friendly',
            intervalMs: 10_000,
            read: async () => {
                throw new RealtimeError('UNAVAILABLE', 'qBittorrent rejected the saved password');
            }
        }, subscriber);
        await until(() => seen.errors.length === 1);

        assert.deepEqual(seen.errors, ['qBittorrent rejected the saved password']);
        hub.close();
    });

    it('reads again at once when asked to refresh', async () => {
        const hub = new PollerHub();
        let reads = 0;
        const { seen, subscriber } = recorder();

        hub.subscribe({ key: 'manual', intervalMs: 10_000, read: async () => ({ reads: ++reads }) }, subscriber);
        await until(() => seen.data.length === 1);
        hub.refresh('manual');
        await until(() => seen.data.length === 2);

        assert.deepEqual(seen.data, [{ reads: 1 }, { reads: 2 }]);
        hub.close();
    });
});

describe('realtime gateway', () => {
    let server: http.Server;
    let gateway: RealtimeGateway;
    let url: string;
    let port: number;
    const reads: Record<string, number> = {};
    const open: WebSocket[] = [];

    type Client = {
        socket: WebSocket;
        frames: any[];
        send: (message: unknown) => void;
        next: (match: (frame: any) => boolean) => Promise<any>;
        closed: Promise<number>;
    };

    const connect = (headers: Record<string, string> = {}): Promise<Client> => new Promise((resolve, reject) => {
        const socket = new WebSocket(url, { headers });
        const frames: any[] = [];
        open.push(socket);

        socket.on('message', data => frames.push(JSON.parse(data.toString())));
        socket.on('unexpected-response', (_request, response) => reject(new Error(`HTTP ${response.statusCode}`)));
        socket.on('error', reject);
        socket.on('open', () => resolve({
            socket,
            frames,
            send: message => socket.send(JSON.stringify(message)),
            next: async match => {
                await until(() => frames.some(match));
                return frames.find(match);
            },
            closed: new Promise(done => socket.on('close', code => done(code)))
        }));
    });

    const dataFor = (itemId: string) => (frame: any) => frame.t === 'data' && frame.itemId === itemId;
    const errorFor = (itemId: string) => (frame: any) => frame.t === 'err' && frame.itemId === itemId;

    before(async () => {
        const registry = new Registry()
            .topic('test.value', (principal, itemId) => {
                const item = resolveItem(principal, itemId, 'any');
                const target = item.config?.host ?? 'none';
                return {
                    key: `test.value:${item.id}:${target}`,
                    intervalMs: 20,
                    read: async () => {
                        reads[item.id] = (reads[item.id] ?? 0) + 1;
                        return { item: item.id, target };
                    }
                };
            })
            .method('test.read', ({ principal, itemId }) => ({ type: resolveItem(principal, itemId, 'any').type }))
            .method('test.write', ({ principal, itemId, params }) => {
                resolveItem(principal, itemId, 'any', 'write');
                return { done: params };
            });

        server = http.createServer((request, response) => {
            // Stands in for a config save sent by one browser tab
            const expressLike = Object.assign(request, { get: (name: string) => request.headers[name] });
            trackRequestOrigin(expressLike as any, response as any, () => {
                updateConfig(config => {
                    config.title = `saved-${Date.now()}`;
                });
                response.end('saved');
            });
        });
        gateway = new RealtimeGateway(server, { registry, limits: { sessionWarningMs: 300 } });

        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        port = (server.address() as AddressInfo).port;
        url = `ws://127.0.0.1:${port}/api/ws`;
    });

    afterEach(() => {
        for (const socket of open.splice(0)) socket.terminate();
    });

    after(() => {
        gateway.close();
        server.close();
    });

    it('streams public items to guests and hides admin-only ones', async () => {
        const guest = await connect();
        guest.send([
            { t: 'sub', topic: 'test.value', itemId: 'public-radarr' },
            { t: 'sub', topic: 'test.value', itemId: 'admin-radarr' },
            { t: 'sub', topic: 'test.value', itemId: 'admin-page-item' },
            { t: 'sub', topic: 'nope', itemId: 'public-radarr' }
        ]);

        const data = await guest.next(dataFor('public-radarr'));
        assert.deepEqual(data, {
            t: 'data',
            topic: 'test.value',
            itemId: 'public-radarr',
            data: { item: 'public-radarr', target: '127.0.0.1' }
        });
        assert.equal((await guest.next(errorFor('admin-radarr'))).message, 'Item not found');
        assert.equal((await guest.next(errorFor('admin-page-item'))).message, 'Item not found');
        assert.equal((await guest.next(frame => frame.topic === 'nope')).message, 'Unknown topic');
    });

    it('streams admin-only items to admins', async () => {
        const admin = await connect({ cookie: cookieFor('admin') });
        admin.send({ t: 'sub', topic: 'test.value', itemId: 'admin-radarr' });

        assert.equal((await admin.next(dataFor('admin-radarr'))).data.item, 'admin-radarr');
    });

    it('lets guests query public items but never change anything', async () => {
        const guest = await connect();
        guest.send([
            { t: 'call', id: 1, method: 'test.read', itemId: 'public-radarr' },
            { t: 'call', id: 2, method: 'test.write', itemId: 'public-radarr', params: { x: 1 } },
            { t: 'call', id: 3, method: 'test.read', itemId: 'admin-radarr' },
            { t: 'call', id: 4, method: 'missing' }
        ]);

        assert.deepEqual(await guest.next(frame => frame.id === 1), { t: 'res', id: 1, ok: true, result: { type: 'radarr-widget' } });
        assert.deepEqual(
            await guest.next(frame => frame.id === 2),
            { t: 'res', id: 2, ok: false, code: 'FORBIDDEN', message: 'Admin access required' }
        );
        assert.equal((await guest.next(frame => frame.id === 3)).code, 'NOT_FOUND');
        assert.equal((await guest.next(frame => frame.id === 4)).message, 'Unknown method');
    });

    it('refuses changes from non-admin accounts and allows them for admins', async () => {
        const user = await connect({ cookie: cookieFor('user') });
        user.send({ t: 'call', id: 'u', method: 'test.write', itemId: 'public-radarr' });
        assert.equal((await user.next(frame => frame.id === 'u')).code, 'FORBIDDEN');

        const admin = await connect({ cookie: cookieFor('admin') });
        admin.send({ t: 'call', id: 'a', method: 'test.write', itemId: 'admin-radarr', params: { x: 1 } });
        assert.deepEqual(
            await admin.next(frame => frame.id === 'a'),
            { t: 'res', id: 'a', ok: true, result: { done: { x: 1 } } }
        );
    });

    it('treats a forged or expired token as a guest', async () => {
        const forged = `access_token=${jwt.sign({ username: 'admin', role: 'admin' }, 'wrong-secret')}`;

        for (const cookie of [forged, cookieFor('admin', { expiresIn: -10 })]) {
            const client = await connect({ cookie });
            client.send({ t: 'sub', topic: 'test.value', itemId: 'admin-radarr' });
            assert.equal((await client.next(errorFor('admin-radarr'))).message, 'Item not found');
        }
    });

    it('accepts a large dashboard subscribing in one frame', async () => {
        fixture.layout.desktop.push(...Array.from({ length: 120 }, (_, index) => ({
            id: `bulk-${index}`,
            type: 'app-shortcut',
            url: `http://bulk-${index}.test/`,
            config: {}
        })));
        saveFixture();

        const guest = await connect();
        guest.send(Array.from({ length: 120 }, (_, index) => ({ t: 'sub', topic: 'test.value', itemId: `bulk-${index}` })));

        await until(() => guest.frames.filter(frame => frame.t === 'data').length >= 120);
        assert.equal(guest.socket.readyState, WebSocket.OPEN);
    });

    it('only accepts browsers on the dashboard\'s own hostname', async () => {
        // Another site opening a socket with the visitor's cookies
        await assert.rejects(connect({ origin: 'https://evil.example' }), /HTTP 403/);

        // Same host on another port or scheme: dev frontend, or TLS ended at a reverse proxy
        await connect({ origin: 'http://127.0.0.1:2022' });
        await connect({ origin: 'https://127.0.0.1' });
        await connect({ origin: 'https://dash.example.com', 'x-forwarded-host': 'dash.example.com' });
    });

    it('answers 404 for other upgrade paths', async () => {
        const wrongPath = new Promise<number | undefined>(resolve => {
            const socket = new WebSocket(`ws://127.0.0.1:${port}/other`);
            socket.on('unexpected-response', (_request, response) => resolve(response.statusCode));
            socket.on('error', () => resolve(undefined));
        });

        assert.equal(await wrongPath, 404);
    });

    it('announces config changes, names the tab that made them, and leaves untouched streams alone', async () => {
        const guest = await connect();
        guest.send({ t: 'sub', topic: 'test.value', itemId: 'public-qbit' });
        await guest.next(dataFor('public-qbit'));
        const pollersBefore = gateway.hub.pollerCount;

        const response = await fetch(`http://127.0.0.1:${port}/save`, { headers: { 'x-client-id': 'tab-1' } });
        await response.text();

        const event = await guest.next(frame => frame.t === 'event');
        assert.deepEqual(event, { t: 'event', name: 'config.changed', origin: 'tab-1' });
        // Same source after the change: the poller was reused, not restarted
        assert.equal(gateway.hub.pollerCount, pollersBefore);
        assert.equal(guest.frames.filter(dataFor('public-qbit')).length, 1);
    });

    it('follows an item that is re-pointed, hidden, or saved after the widget appeared', async () => {
        const guest = await connect();
        guest.send([
            { t: 'sub', topic: 'test.value', itemId: 'public-seerr' },
            { t: 'sub', topic: 'test.value', itemId: 'not-saved-yet' }
        ]);
        await guest.next(dataFor('public-seerr'));
        await guest.next(errorFor('not-saved-yet'));

        updateConfig(config => {
            const item = config.layout.desktop.find(entry => entry.id === 'public-seerr')!;
            item.config = { ...item.config, host: '10.9.9.9' };
            config.layout.desktop.push({ id: 'not-saved-yet', label: '', type: 'app-shortcut', config: {} });
        });

        assert.equal((await guest.next(frame => dataFor('public-seerr')(frame) && frame.data.target === '10.9.9.9')).data.item, 'public-seerr');
        await guest.next(dataFor('not-saved-yet'));

        updateConfig(config => {
            config.layout.desktop.find(entry => entry.id === 'public-seerr')!.adminOnly = true;
        });
        await guest.next(errorFor('public-seerr'));
    });

    it('sends note changes as their own event', async () => {
        const guest = await connect();
        updateConfig(config => {
            config.notes = [];
        }, 'notes');

        assert.equal((await guest.next(frame => frame.t === 'event')).name, 'notes.changed');
    });

    it('drops the sockets of a session that logs out, and only those', async () => {
        const token = jwt.sign({ username: 'admin', role: 'admin' }, SECRET);
        const loggedOut = await connect({ cookie: `access_token=${token}` });
        const otherDevice = await connect({ cookie: cookieFor('admin', { expiresIn: '1h' }) });

        endSession(token);

        assert.equal(await loggedOut.closed, 4401);
        assert.equal(otherDevice.socket.readyState, WebSocket.OPEN);
    });

    it('warns before a session expires, then closes the socket', async () => {
        const client = await connect({ cookie: cookieFor('admin', { expiresIn: 1 }) });

        assert.deepEqual(await client.next(frame => frame.t === 'event'), { t: 'event', name: 'session.expiring' });
        assert.equal(await client.closed, 4401);
    });

    it('stops polling when the last watcher disconnects', async () => {
        const guest = await connect();
        guest.send({ t: 'sub', topic: 'test.value', itemId: 'public-pihole' });
        await guest.next(dataFor('public-pihole'));

        guest.socket.close();
        await guest.closed;
        await sleep(30);
        const readsAfterClose = reads['public-pihole'];
        await sleep(80);

        assert.equal(reads['public-pihole'], readsAfterClose);
    });
});

describe('built-in topics', () => {
    it('shares one forecast between weather widgets for the same place', () => {
        updateConfig(config => {
            config.layout.desktop.push(
                { id: 'weather-a', label: '', type: 'weather-widget', config: { location: { name: 'Home', latitude: 52.52, longitude: 13.405 } } },
                { id: 'weather-b', label: '', type: 'weather-widget', config: { location: { name: 'Same', latitude: '52.5200', longitude: 13.4050 } } },
                { id: 'weather-nowhere', label: '', type: 'weather-widget', config: {} },
                { id: 'weather-invalid', label: '', type: 'weather-widget', config: { location: { latitude: 400, longitude: 13 } } }
            );
        });

        const registry = createRegistry();
        const source = (itemId: string) => registry.resolveTopic('weather.forecast', undefined, itemId);

        assert.equal(source('weather-a').key, source('weather-b').key);
        assert.equal(source('weather-a').intervalMs, 15 * 60 * 1000);
        assert.throws(() => source('weather-nowhere'), /set a location/);
        assert.throws(() => source('weather-invalid'), /set a location/);
        assert.throws(() => source('public-radarr'), /Item not found/);
    });

    it('checks the health target saved on the item, not one chosen by the client', async () => {
        const stub = http.createServer((request, response) => {
            response.statusCode = request.url === '/down' ? 500 : 200;
            response.end('ok');
        });
        await new Promise<void>(resolve => stub.listen(0, '127.0.0.1', resolve));
        const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

        updateConfig(config => {
            config.layout.desktop.push(
                { id: 'up', label: '', type: 'app-shortcut', url: `${stubUrl}/up`, config: {} },
                { id: 'down', label: '', type: 'app-shortcut', url: 'http://ignored.test/', config: { healthUrl: `${stubUrl}/down` } },
                { id: 'no-target', label: '', type: 'app-shortcut', config: {} }
            );
        });

        const registry = createRegistry();
        const read = (itemId: string) => registry.resolveTopic('service.health', undefined, itemId).read(new AbortController().signal);

        assert.deepEqual(await read('up'), { status: 'online' });
        assert.deepEqual(await read('down'), { status: 'offline' });
        assert.throws(() => registry.resolveTopic('service.health', undefined, 'no-target'), /no valid health check target/);
        assert.throws(() => registry.resolveTopic('service.health', undefined, 'admin-radarr'), /Item not found/);
        assert.throws(() => registry.resolveTopic('system.metrics', undefined, 'up'), /Item not found/);
        stub.close();
    });
});
