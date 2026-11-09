// Must stay first: it swaps in the test config before any app module loads
// eslint-disable-next-line import/order
import './helpers/fixture-config';

import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createApp } from '../src/app';
import { isItemPublic, isPublicWakeTarget } from '../src/utils/config-lookup';
import { decrypt } from '../src/utils/crypto';
import { isWeakSecret, SECRET } from '../src/utils/secret';

const BACKEND_ROOT = path.resolve(__dirname, '..');

const cookieFor = (role: string, options: jwt.SignOptions = {}): string => (
    `access_token=${jwt.sign({ username: role, role }, SECRET, options)}`
);
const ADMIN = cookieFor('admin');
const USER = cookieFor('user');

let server: http.Server;
let baseUrl: string;

const listen = (target: http.Server): Promise<string> => new Promise(resolve => {
    target.listen(0, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${(target.address() as AddressInfo).port}`);
    });
});

type Reply = { status: number; body: any };

const call = async (method: string, url: string, cookie?: string, body?: unknown): Promise<Reply> => {
    const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers: {
            ...(cookie ? { cookie } : {}),
            ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(8000)
    });
    const text = await response.text();
    try {
        return { status: response.status, body: JSON.parse(text) };
    } catch {
        return { status: response.status, body: text };
    }
};

// A request the access guard refused, as opposed to one the upstream service failed
const refused = (reply: Reply): boolean => (
    (reply.status === 401 && reply.body?.message === 'Authentication required') ||
    (reply.status === 403 && reply.body?.message === 'Admin access required')
);

before(async () => {
    server = http.createServer(createApp(BACKEND_ROOT));
    baseUrl = await listen(server);
});

after(() => {
    server.close();
});

describe('item visibility', () => {
    it('follows item, group, and page admin-only flags', () => {
        assert.equal(isItemPublic('public-radarr'), true);
        assert.equal(isItemPublic('group-child'), true);
        assert.equal(isItemPublic('dual-top'), true);
        assert.equal(isItemPublic('admin-radarr'), false);
        assert.equal(isItemPublic('admin-group-child'), false);
        assert.equal(isItemPublic('admin-page-item'), false);
        assert.equal(isItemPublic('missing'), false);
    });

    it('treats an item as public when any layout shows it to guests', () => {
        assert.equal(isItemPublic('admin-on-desktop-only'), true);
    });

    it('only lets guests wake devices configured on public shortcuts', () => {
        assert.equal(isPublicWakeTarget('aa:bb:cc:dd:ee:01'), true);
        assert.equal(isPublicWakeTarget('AA:BB:CC:DD:EE:02'), true);
        assert.equal(isPublicWakeTarget('AA:BB:CC:DD:EE:03'), false);
        assert.equal(isPublicWakeTarget('11:22:33:44:55:66'), false);
    });

});

describe('integration proxy routes (#193)', () => {
    it('lets guests read public items', async () => {
        for (const url of [
            '/api/jellyfin/sessions?itemId=public-radarr',
            '/api/jellyfin/sessions?itemId=dual-top',
            '/api/jellyfin/sessions?itemId=admin-on-desktop-only'
        ]) {
            assert.equal(refused(await call('GET', url)), false, url);
        }
    });

    it('hides admin-only items, groups, and pages from guests', async () => {
        for (const itemId of ['admin-radarr', 'admin-group-child', 'admin-page-item', 'missing']) {
            const reply = await call('GET', `/api/jellyfin/sessions?itemId=${itemId}`);
            assert.equal(reply.status, 401, itemId);
        }
        assert.equal((await call('GET', '/api/jellyfin/sessions')).status, 401);
    });

    it('refuses every guest write, even on public items', async () => {
        const writes: Array<[string, string]> = [
            ['POST', '/api/jellyseerr/request?itemId=public-seerr'],
            ['POST', '/api/jellyseerr/request/1/approve?itemId=public-seerr'],
            ['POST', '/api/jellyseerr/request/1/decline?itemId=public-seerr'],
        ];

        for (const [method, url] of writes) {
            assert.equal((await call(method, url, undefined, {})).status, 401, `${method} ${url}`);
        }
    });

    it('no longer serves the proxy routes that moved to the realtime connection', async () => {
        for (const url of [
            '/api/qbittorrent/torrents?itemId=public-qbit',
            '/api/deluge/stats?itemId=public-qbit',
            '/api/transmission/stats?itemId=public-qbit',
            '/api/sabnzbd/stats?itemId=public-qbit',
            '/api/nzbget/downloads?itemId=public-qbit',
            '/api/pihole/stats?itemId=public-pihole',
            '/api/pihole/v6/blocking-status?itemId=public-pihole',
            '/api/adguard/stats?itemId=public-pihole',
            '/api/radarr/queue?itemId=public-radarr',
            '/api/sonarr/series?itemId=public-radarr'
        ]) {
            assert.equal((await call('GET', url, ADMIN)).status, 404, url);
        }
        assert.equal((await call('POST', '/api/qbittorrent/torrents/delete?itemId=public-qbit', ADMIN, {})).status, 404);
    });

    it('refuses writes and admin-only reads for non-admin accounts', async () => {
        assert.equal((await call('POST', '/api/jellyseerr/request/1/approve?itemId=public-seerr', USER, {})).status, 403);
        assert.equal((await call('GET', '/api/jellyfin/sessions?itemId=admin-radarr', USER)).status, 403);
    });

    it('lets admins read and write everything', async () => {
        assert.equal(refused(await call('GET', '/api/jellyfin/sessions?itemId=admin-page-item', ADMIN)), false);
        assert.equal(refused(await call('POST', '/api/jellyseerr/request/1/approve?itemId=admin-radarr', ADMIN, {})), false);
    });

    it('rejects tokens that are forged, expired, or signed with another algorithm', async () => {
        const url = '/api/jellyseerr/request/1/approve?itemId=public-seerr';
        const forged = `access_token=${jwt.sign({ username: 'admin', role: 'admin' }, 'wrong-secret')}`;

        assert.equal((await call('POST', url, forged, {})).status, 401);
        assert.equal((await call('POST', url, cookieFor('admin', { expiresIn: -10 }), {})).status, 401);
        assert.equal((await call('POST', url, cookieFor('admin', { algorithm: 'HS512' }), {})).status, 401);
    });
});

describe('other previously open routes', () => {
    it('requires an admin for uploads and file management', async () => {
        const routes: Array<[string, string]> = [
            ['POST', '/api/system/upload'],
            ['POST', '/api/system/clean-background'],
            ['POST', '/api/app-shortcut/upload'],
            ['POST', '/api/app-shortcut/upload-batch'],
            ['GET', '/api/uploads/images'],
            ['DELETE', '/api/uploads/images'],
            ['DELETE', '/api/icons/cache']
        ];

        for (const [method, url] of routes) {
            assert.equal((await call(method, url)).status, 401, `guest ${method} ${url}`);
        }
        assert.equal((await call('GET', '/api/uploads/images', USER)).status, 403);
        assert.equal((await call('GET', '/api/uploads/images', ADMIN)).status, 200);
    });

    it('refuses wake-on-LAN for devices that are not on a public shortcut', async () => {
        assert.equal((await call('POST', '/api/system/wol', undefined, { mac: '11:22:33:44:55:66' })).status, 401);
        assert.equal((await call('POST', '/api/system/wol', undefined, { mac: 'AA:BB:CC:DD:EE:03' })).status, 401);
    });

    it('no longer offers an endpoint that fetches a URL chosen by the caller', async () => {
        const url = `/api/health?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data')}`;

        assert.equal((await call('GET', url)).status, 404);
        assert.equal((await call('GET', url, ADMIN)).status, 404);
    });

    it('does not read files outside the icon directories', async () => {
        const assets = path.join(BACKEND_ROOT, 'node_modules/@loganmarchione/homelab-svg-assets/assets');
        const realIcon = `./assets/${fs.readdirSync(assets).find(file => file.endsWith('.svg'))}`;
        const escapes = [
            './assets/../../../../package.json',
            '/uploads/app-icons/../../../package.json',
            path.join(BACKEND_ROOT, 'package.json')
        ];

        const reply = await call('POST', '/api/icons/bulk', undefined, { iconPaths: [realIcon, ...escapes] });

        assert.deepEqual(Object.keys(reply.body.icons), [realIcon]);
        assert.equal(reply.body.errors.length, escapes.length);
    });
});

describe('credential encryption', () => {
    it('encrypts secrets for admins only, and leaves encrypted values alone', async () => {
        assert.equal((await call('POST', '/api/config/encrypt', undefined, { value: 'hunter2' })).status, 401);
        assert.equal((await call('POST', '/api/config/encrypt', USER, { value: 'hunter2' })).status, 403);
        assert.equal((await call('POST', '/api/config/encrypt', ADMIN, {})).status, 400);

        const { body } = await call('POST', '/api/config/encrypt', ADMIN, { value: 'hunter2' });
        assert.match(body.encrypted, /^ENC:/);
        assert.equal(decrypt(body.encrypted), 'hunter2');

        const again = await call('POST', '/api/config/encrypt', ADMIN, { value: body.encrypted });
        assert.equal(again.body.encrypted, body.encrypted);
    });
});

describe('request size limits (#182)', () => {
    const jsonOfSize = (bytes: number): string => JSON.stringify({ padding: 'x'.repeat(bytes) });

    it('accepts a multi-megabyte config save', async () => {
        // Parsed, then stopped by auth: proves the body limit no longer rejects it
        const reply = await call('POST', '/api/config', undefined, jsonOfSize(2 * 1024 * 1024));
        assert.equal(reply.status, 401);
    });

    it('answers oversized bodies with a JSON 413', async () => {
        const tooLargeConfig = await call('POST', '/api/config', undefined, jsonOfSize(11 * 1024 * 1024));
        assert.equal(tooLargeConfig.status, 413);
        assert.equal(typeof tooLargeConfig.body.message, 'string');

        const tooLargeNote = await call('POST', '/api/notes', undefined, jsonOfSize(2 * 1024 * 1024));
        assert.equal(tooLargeNote.status, 413);
    });
});

describe('SECRET check', () => {
    it('flags missing, short, and placeholder secrets', () => {
        assert.equal(isWeakSecret('@jZCgtn^qg8So*^^6A2M'), true);
        assert.equal(isWeakSecret('YOUR_SECRET_KEY'), true);
        assert.equal(isWeakSecret('short'), true);
        assert.equal(isWeakSecret(SECRET), false);
    });
});
