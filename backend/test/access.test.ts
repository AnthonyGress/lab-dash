// Must stay first: it swaps in the test config before any app module loads
// eslint-disable-next-line import/order
import './helpers/fixture-config';

import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
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
    // They acted with the owner's stored credentials and had no authentication.
    // Their work moved behind the realtime gateway, where one rule guards every item.
    it('are gone, for guests and admins alike', async () => {
        const removed: Array<[string, string]> = [
            ['GET', '/api/radarr/queue?itemId=public-radarr'],
            ['DELETE', '/api/radarr/queue/1?itemId=public-radarr'],
            ['POST', '/api/radarr/refresh-monitored-downloads?itemId=public-radarr'],
            ['GET', '/api/sonarr/series?itemId=public-radarr'],
            ['DELETE', '/api/sonarr/queue/1?itemId=public-radarr'],
            ['GET', '/api/jellyfin/sessions?itemId=public-radarr'],
            ['GET', '/api/jellyseerr/requests?itemId=public-seerr'],
            ['POST', '/api/jellyseerr/request?itemId=public-seerr'],
            ['POST', '/api/jellyseerr/request/1/approve?itemId=public-seerr'],
            ['POST', '/api/jellyseerr/request/1/decline?itemId=public-seerr'],
            ['GET', '/api/qbittorrent/torrents?itemId=public-qbit'],
            ['POST', '/api/qbittorrent/torrents/delete?itemId=public-qbit'],
            ['GET', '/api/deluge/stats?itemId=public-qbit'],
            ['GET', '/api/transmission/stats?itemId=public-qbit'],
            ['GET', '/api/sabnzbd/stats?itemId=public-qbit'],
            ['GET', '/api/nzbget/downloads?itemId=public-qbit'],
            ['GET', '/api/pihole/stats?itemId=public-pihole'],
            ['POST', '/api/pihole/disable?itemId=public-pihole'],
            ['GET', '/api/pihole/v6/blocking-status?itemId=public-pihole'],
            ['GET', '/api/adguard/stats?itemId=public-pihole']
        ];

        for (const [method, url] of removed) {
            for (const cookie of [undefined, ADMIN]) {
                const reply = await call(method, url, cookie, method === 'GET' ? undefined : {});
                assert.equal(reply.status, 404, `${method} ${url}`);
            }
        }
    });
});

describe('session tokens', () => {
    it('rejects tokens that are forged, expired, or signed with another algorithm', async () => {
        const url = '/api/uploads/images';
        const forged = `access_token=${jwt.sign({ username: 'admin', role: 'admin' }, 'wrong-secret')}`;

        assert.equal((await call('GET', url, forged)).status, 401);
        assert.equal((await call('GET', url, cookieFor('admin', { expiresIn: -10 }))).status, 401);
        assert.equal((await call('GET', url, cookieFor('admin', { algorithm: 'HS512' }))).status, 401);
        assert.equal((await call('GET', url, ADMIN)).status, 200);
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
            ['DELETE', '/api/uploads/images']
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

    it('no longer offers the bulk endpoints, one of which could read any file on the server', async () => {
        const escape = { iconPaths: ['./assets/../../../../package.json'] };

        assert.equal((await call('POST', '/api/icons/bulk', undefined, escape)).status, 404);
        assert.equal((await call('POST', '/api/icons/bulk', ADMIN, escape)).status, 404);
        assert.equal((await call('POST', '/api/widgets/bulk-data', ADMIN, { widgets: [] })).status, 404);
        assert.equal((await call('DELETE', '/api/icons/cache', ADMIN)).status, 404);
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
