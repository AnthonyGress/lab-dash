// Must stay first: it swaps in the test config before any app module loads
 
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createRegistry } from '../../src/realtime';
import { Principal } from '../../src/realtime/access';
import { PollerHub } from '../../src/realtime/hub';
import { updateConfig } from '../../src/services/config-store';
import { encrypt } from '../../src/utils/crypto';
import { Fake, json, startFake } from '../helpers/fake-upstream';

const ADMIN: Principal = { username: 'admin', role: 'admin' };
const GUEST: Principal = undefined;

const registry = createRegistry();
const hub = new PollerHub();
const signal = new AbortController().signal;

const read = (itemId: string): Promise<any> => registry.resolveTopic('dns.stats', GUEST, itemId).read(signal);
const callAs = (principal: Principal, method: string, itemId: string, params?: unknown): Promise<unknown> => (
    registry.call(method, { principal, itemId, params, hub })
);

const addItem = (id: string, type: string, config: Record<string, unknown>): void => {
    updateConfig(draft => {
        draft.layout.desktop = draft.layout.desktop.filter(item => item.id !== id);
        draft.layout.desktop.push({ id, label: id, type, config });
    });
};

describe('Pi-hole v5', () => {
    let fake: Fake;
    let blocking = 'enabled';

    before(async () => {
        fake = await startFake((request, response) => {
            const params = new URL(request.url, 'http://localhost').searchParams;
            if (params.get('auth') !== 'v5-token') {
                json(response, []);
                return;
            }
            if (params.has('disable')) blocking = 'disabled';
            if (params.has('enable')) blocking = 'enabled';
            if (params.has('summary')) {
                json(response, {
                    domains_being_blocked: '120,000', dns_queries_today: '5,000', ads_blocked_today: '750',
                    ads_percentage_today: '15.0', status: blocking, unique_clients: '9'
                });
                return;
            }
            json(response, { status: blocking });
        });
        addItem('pihole5', 'pihole-widget', { host: '127.0.0.1', port: String(fake.port), apiToken: encrypt('v5-token') });
    });

    after(() => fake.server.close());

    it('reads the summary with the saved token', async () => {
        assert.deepEqual(await read('pihole5'), {
            domains_being_blocked: '120,000',
            dns_queries_today: '5,000',
            ads_blocked_today: '750',
            ads_percentage_today: '15.0',
            status: 'enabled',
            timer: null
        });
    });

    it('disables for a while, reports the time left, and enables again', async () => {
        fake.seen.length = 0;
        await callAs(ADMIN, 'dns.disable', 'pihole5', { seconds: 300 });

        assert.match(fake.seen[0].url, /^\/api\.php\?disable=300&auth=v5-token$/);
        const disabled = await read('pihole5');
        assert.equal(disabled.status, 'disabled');
        assert.ok(disabled.timer > 295 && disabled.timer <= 300, `timer was ${disabled.timer}`);

        await callAs(ADMIN, 'dns.enable', 'pihole5');
        assert.deepEqual([(await read('pihole5')).status, (await read('pihole5')).timer], ['enabled', null]);
    });

    it('disables without a time limit', async () => {
        fake.seen.length = 0;
        await callAs(ADMIN, 'dns.disable', 'pihole5', { seconds: null });

        assert.match(fake.seen[0].url, /^\/api\.php\?disable&auth=v5-token$/);
        assert.deepEqual([(await read('pihole5')).status, (await read('pihole5')).timer], ['disabled', null]);
        await callAs(ADMIN, 'dns.enable', 'pihole5');
    });

    it('lets guests watch but not switch blocking off', async () => {
        fake.seen.length = 0;
        await assert.rejects(callAs(GUEST, 'dns.disable', 'pihole5', { seconds: 60 }), /Admin access required/);
        await assert.rejects(callAs({ username: 'bob', role: 'user' }, 'dns.enable', 'pihole5'), /Admin access required/);
        assert.equal(fake.seen.length, 0);
    });

    it('rejects a nonsensical duration', async () => {
        for (const seconds of [0, -5, 1.5, 'soon', 10 ** 9]) {
            await assert.rejects(callAs(ADMIN, 'dns.disable', 'pihole5', { seconds }), /whole number of seconds/);
        }
    });

    it('reports a rejected token', async () => {
        addItem('pihole5-wrong', 'pihole-widget', { host: '127.0.0.1', port: String(fake.port), apiToken: 'nope' });
        await assert.rejects(read('pihole5-wrong'), { message: 'Pi-hole rejected the saved API token' });
    });

    it('checks often while blocking is off, rarely otherwise', () => {
        const interval = registry.resolveTopic('dns.stats', GUEST, 'pihole5').intervalMs as (data: unknown) => number;
        assert.equal(interval({ status: 'disabled' }), 5000);
        assert.equal(interval({ status: 'enabled' }), 30_000);
        assert.equal(interval(undefined), 30_000);
    });
});

describe('Pi-hole v6', () => {
    let fake: Fake;
    let validSid = 'sid-1';
    let logins = 0;
    let state: { blocking: boolean; timer: number | null } = { blocking: true, timer: null };

    before(async () => {
        fake = await startFake((request, response) => {
            const url = new URL(request.url, 'http://localhost');
            if (url.pathname === '/api/auth') {
                logins += 1;
                if (JSON.parse(request.body).password !== 'v6-pass') {
                    response.writeHead(401).end(JSON.stringify({ error: { message: 'Unauthorized' } }));
                    return;
                }
                json(response, { session: { valid: true, sid: validSid, csrf: 'csrf-1', validity: 1800 } });
                return;
            }
            if (url.searchParams.get('sid') !== validSid || request.headers['x-ftl-csrf'] !== 'csrf-1') {
                response.writeHead(401).end();
                return;
            }
            if (url.pathname === '/api/stats/summary') {
                json(response, { queries: { total: 9000, blocked: 1800, percent_blocked: 20 }, gravity: { domains_being_blocked: 250000 } });
            } else if (url.pathname === '/api/dns/blocking') {
                if (request.method === 'POST') state = JSON.parse(request.body);
                json(response, { blocking: state.blocking ? 'enabled' : 'disabled', timer: state.timer });
            } else {
                response.writeHead(404).end();
            }
        });
        addItem('pihole6', 'pihole-widget', { host: '127.0.0.1', port: String(fake.port), password: encrypt('v6-pass') });
    });

    after(() => fake.server.close());

    it('logs in once and maps the summary', async () => {
        assert.deepEqual(await read('pihole6'), {
            domains_being_blocked: 250000,
            dns_queries_today: 9000,
            ads_blocked_today: 1800,
            ads_percentage_today: 20,
            status: 'enabled',
            timer: null
        });
        await read('pihole6');
        assert.equal(logins, 1);
    });

    it('logs in again when Pi-hole has dropped the session', async () => {
        validSid = 'sid-2';
        assert.equal((await read('pihole6')).status, 'enabled');
        assert.equal(logins, 2);
    });

    it('disables with a timer and enables again', async () => {
        await callAs(ADMIN, 'dns.disable', 'pihole6', { seconds: 600 });
        assert.deepEqual(state, { blocking: false, timer: 600 });
        assert.deepEqual([(await read('pihole6')).status, (await read('pihole6')).timer], ['disabled', 600]);

        await callAs(ADMIN, 'dns.enable', 'pihole6');
        assert.deepEqual(state, { blocking: true, timer: null });
    });

    it('reports a rejected password', async () => {
        addItem('pihole6-wrong', 'pihole-widget', { host: '127.0.0.1', port: String(fake.port), password: 'wrong' });
        await assert.rejects(read('pihole6-wrong'), { message: 'Pi-hole rejected the saved password' });
    });
});

describe('AdGuard Home', () => {
    let fake: Fake;
    let status = { protection_enabled: true, protection_disabled_duration: 0, num_blocked_filtering: 4321 };

    before(async () => {
        fake = await startFake((request, response) => {
            if (request.headers.authorization !== `Basic ${Buffer.from('ag-user:ag-pass').toString('base64')}`) {
                response.writeHead(401).end();
                return;
            }
            if (request.url === '/control/status') {
                json(response, status);
            } else if (request.url === '/control/stats') {
                json(response, { time_units: 'hours', dns_queries: Array(30).fill(10), blocked_filtering: Array(30).fill(1) });
            } else if (request.url === '/control/protection') {
                const body = JSON.parse(request.body);
                status = { ...status, protection_enabled: body.enabled, protection_disabled_duration: body.duration ?? 0 };
                response.writeHead(200).end();
            } else if (request.url === '/control/dns_config') {
                status = { ...status, protection_enabled: true, protection_disabled_duration: 0 };
                response.writeHead(200).end();
            } else {
                response.writeHead(404).end();
            }
        });
        addItem('adguard', 'adguard-widget', {
            host: '127.0.0.1', port: String(fake.port), username: encrypt('ag-user'), password: encrypt('ag-pass')
        });
    });

    after(() => fake.server.close());

    it('sums the last 24 hours and decrypts both stored credentials', async () => {
        assert.deepEqual(await read('adguard'), {
            domains_being_blocked: 4321,
            dns_queries_today: 240,
            ads_blocked_today: 24,
            ads_percentage_today: 10,
            status: 'enabled',
            timer: null
        });
    });

    it('lets AdGuard Home itself time the pause, so it ends even with no tab open', async () => {
        fake.seen.length = 0;
        await callAs(ADMIN, 'dns.disable', 'adguard', { seconds: 120 });

        assert.deepEqual(JSON.parse(fake.seen[0].body), { enabled: false, duration: 120_000 });
        assert.deepEqual([(await read('adguard')).status, (await read('adguard')).timer], ['disabled', 120]);

        await callAs(ADMIN, 'dns.enable', 'adguard');
        assert.equal((await read('adguard')).status, 'enabled');
    });

    it('reports rejected credentials', async () => {
        addItem('adguard-wrong', 'adguard-widget', { host: '127.0.0.1', port: String(fake.port), username: 'ag-user', password: 'bad' });
        await assert.rejects(read('adguard-wrong'), { message: 'AdGuard Home rejected the saved credentials' });
    });
});

describe('dns.stats access', () => {
    it('does not serve other widget types or hidden items', () => {
        assert.throws(() => registry.resolveTopic('dns.stats', GUEST, 'public-radarr'), /Item not found/);
        assert.throws(() => registry.resolveTopic('dns.stats', GUEST, 'admin-radarr'), /Item not found/);
    });
});
