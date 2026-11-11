// Must stay first: it swaps in the test config before any app module loads
 
import '../helpers/fixture-config';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createApp } from '../../src/app';
import { getConfig, updateConfig } from '../../src/services/config-store';
import { readUsers, writeUsers } from '../../src/services/users';
import { isItemPublic, isPublicWakeTarget } from '../../src/utils/config-lookup';
import { decrypt } from '../../src/utils/crypto';
import { ACCESS_TOKEN_KEY, isWeakSecret, SECRET, secretProblem } from '../../src/utils/secret';
import { cookieFor, tokenFor } from '../helpers/sessions';

const BACKEND_ROOT = path.resolve(__dirname, '../..');

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
    const url = '/api/uploads/images';

    it('rejects tokens that are forged, expired, or signed with another algorithm', async () => {
        const forged = `access_token=${jwt.sign({ username: 'admin', role: 'admin' }, 'wrong-secret')}`;

        assert.equal((await call('GET', url, forged)).status, 401);
        assert.equal((await call('GET', url, cookieFor('admin', { expiresIn: -10 }))).status, 401);
        assert.equal((await call('GET', url, cookieFor('admin', { algorithm: 'HS512' }))).status, 401);
        assert.equal((await call('GET', url, ADMIN)).status, 200);
    });

    // A leaked SECRET used to be all it took to become admin
    it('does not let someone who knows SECRET sign their way in', async () => {
        const claims = { username: 'admin', role: 'admin' };
        const signedLikeOlderReleases = jwt.sign(claims, SECRET, { expiresIn: '3d' });
        const signedWithTheRightKey = jwt.sign({ ...claims, sid: 'made-up-session' }, ACCESS_TOKEN_KEY, { expiresIn: '3d' });

        for (const token of [signedLikeOlderReleases, signedWithTheRightKey]) {
            assert.equal((await call('GET', url, `access_token=${token}`)).status, 401);
            assert.equal((await call('GET', '/api/config/export', `access_token=${token}`)).status, 401);
        }
    });

    it('takes the role from the account, not from the token', async () => {
        const { sid } = jwt.decode(tokenFor('user')) as { sid: string };
        const claimsToBeAdmin = jwt.sign({ username: 'user', role: 'admin', sid }, ACCESS_TOKEN_KEY);

        assert.equal((await call('GET', url, `access_token=${claimsToBeAdmin}`)).status, 403);
    });

    it('follows the account when it is demoted, removed, or its session runs out', async () => {
        const account = { username: 'temporary', passwordHash: '', role: 'admin' as const };
        const others = () => readUsers().filter(user => user.username !== account.username);
        const stored = () => readUsers().find(user => user.username === account.username)!;

        writeUsers([...others(), account]);
        const cookie = cookieFor(account.username);
        assert.equal((await call('GET', url, cookie)).status, 200);

        writeUsers([...others(), { ...stored(), role: 'user' }]);
        assert.equal((await call('GET', url, cookie)).status, 403);

        writeUsers([...others(), { ...stored(), sessions: stored().sessions!.map(session => ({ ...session, expiresAt: Date.now() - 1 })) }]);
        assert.equal((await call('GET', url, cookie)).status, 401);

        writeUsers(others());
        assert.equal((await call('GET', url, cookieFor('admin'))).status, 200);
        assert.equal((await call('GET', url, cookie)).status, 401);
    });
});

describe('logging in', () => {
    const PASSWORD = 'correct horse battery staple';
    type Cookies = Record<string, string>;

    const post = async (url: string, cookies: Cookies = {}, body: unknown = {}) => {
        const response = await fetch(`${baseUrl}${url}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
            },
            body: JSON.stringify(body)
        });

        const received: Cookies = {};
        for (const line of response.headers.getSetCookie()) {
            const [pair] = line.split(';');
            received[pair.slice(0, pair.indexOf('='))] = pair.slice(pair.indexOf('=') + 1);
        }
        return { status: response.status, body: await response.json().catch(() => null), cookies: received };
    };

    const adminAllowed = async (accessToken: string): Promise<number> => (
        (await call('GET', '/api/uploads/images', `access_token=${accessToken}`)).status
    );

    before(() => {
        writeUsers([
            ...readUsers(),
            // Carries a refresh token the way older releases stored them
            { username: 'owner', passwordHash: bcrypt.hashSync(PASSWORD, 4), role: 'admin', refreshTokens: ['legacy-token'] }
        ]);
    });

    it('needs the right password', async () => {
        const wrong = await post('/api/auth/login', {}, { username: 'owner', password: 'guess' });
        assert.equal(wrong.status, 401);
        assert.deepEqual(wrong.cookies, {});

        // Fixture accounts have no password at all
        assert.equal((await post('/api/auth/login', {}, { username: 'admin', password: 'anything' })).status, 401);
    });

    it('signs up later accounts as regular users', async () => {
        const credentials = { username: 'guest-account', password: PASSWORD };
        assert.equal((await post('/api/auth/signup', {}, credentials)).status, 201);

        const login = await post('/api/auth/login', {}, credentials);
        assert.equal(login.body.isAdmin, false);
        assert.equal(await adminAllowed(login.cookies.access_token), 403);
    });

    it('keeps a session alive through refreshes and retires the pair that was traded in', async () => {
        const login = await post('/api/auth/login', {}, { username: 'owner', password: PASSWORD });
        assert.equal(login.status, 200);
        assert.equal(login.body.isAdmin, true);
        assert.equal(await adminAllowed(login.cookies.access_token), 200);

        const refreshed = await post('/api/auth/refresh', { refresh_token: login.cookies.refresh_token });
        assert.equal(refreshed.status, 200);
        assert.equal(refreshed.body.isAdmin, true);
        assert.equal(await adminAllowed(refreshed.cookies.access_token), 200);

        // Other tabs may still be sending the old pair, so it is not cut off mid-request
        assert.equal(await adminAllowed(login.cookies.access_token), 200);

        // A minute later it is finished
        writeUsers(readUsers().map(user => ({
            ...user,
            sessions: user.sessions?.map(session => (
                session.expiresAt < Date.now() + 5 * 60 * 1000 ? { ...session, expiresAt: 0 } : session
            ))
        })));
        assert.equal(await adminAllowed(login.cookies.access_token), 401);
        const replayed = await post('/api/auth/refresh', { refresh_token: login.cookies.refresh_token });
        assert.equal(replayed.status, 401);
        assert.deepEqual(replayed.cookies, { access_token: '', refresh_token: '' });
        assert.equal(await adminAllowed(refreshed.cookies.access_token), 200);
    });

    it('does not accept one kind of token in place of the other', async () => {
        const login = await post('/api/auth/login', {}, { username: 'owner', password: PASSWORD });

        // A refresh token lives longer and is never meant to open the API
        assert.equal(await adminAllowed(login.cookies.refresh_token), 401);
        assert.equal((await call('POST', '/api/notes', `access_token=${login.cookies.refresh_token}`, {})).status, 401);
        assert.equal((await post('/api/auth/refresh', { refresh_token: login.cookies.access_token })).status, 401);
    });

    it('ends the session on the server at logout', async () => {
        const login = await post('/api/auth/login', {}, { username: 'owner', password: PASSWORD });
        const otherDevice = await post('/api/auth/login', {}, { username: 'owner', password: PASSWORD });

        assert.equal((await post('/api/auth/logout', login.cookies)).status, 200);

        // A copy of the cookies is worthless afterwards
        assert.equal(await adminAllowed(login.cookies.access_token), 401);
        assert.equal((await post('/api/auth/refresh', { refresh_token: login.cookies.refresh_token })).status, 401);
        assert.equal(await adminAllowed(otherDevice.cookies.access_token), 200);
    });

    it('stores nothing that would let a reader of users.json log in', async () => {
        const login = await post('/api/auth/login', {}, { username: 'owner', password: PASSWORD });
        const { sid } = jwt.decode(login.cookies.access_token) as { sid: string };
        const onDisk = fs.readFileSync(process.env.USERS_FILE!, 'utf-8');

        for (const usable of [login.cookies.access_token, login.cookies.refresh_token, sid, 'legacy-token']) {
            assert.equal(onDisk.includes(usable), false);
        }
        assert.equal(readUsers().find(user => user.username === 'owner')!.refreshTokens, undefined);
    });

    it('tells the page whether it is logged in without handing back the cookies', async () => {
        const login = await post('/api/auth/login', {}, { username: 'owner', password: PASSWORD });
        const { access_token, refresh_token } = login.cookies;
        // Cookies of other apps on the same host name arrive here too
        const sent = `access_token=${access_token}; refresh_token=${refresh_token}; other_app_session=not-ours-to-share`;

        const response = await fetch(`${baseUrl}/api/auth/check-cookies`, { headers: { cookie: sent } });
        const text = await response.text();

        assert.deepEqual(JSON.parse(text), { hasAccessToken: true, hasRefreshToken: true });
        for (const value of [access_token, refresh_token, 'not-ours-to-share']) {
            assert.equal(text.includes(value), false);
        }
        assert.deepEqual((await call('GET', '/api/auth/check-cookies')).body, { hasAccessToken: false, hasRefreshToken: false });
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

    it('serves icons and uploads from their own folders only', async () => {
        // Sent as written: fetch() would resolve the dots before the request leaves
        const rawGet = (requestPath: string): Promise<string> => new Promise((resolve, reject) => {
            http.get({ host: '127.0.0.1', port: (server.address() as AddressInfo).port, path: requestPath }, response => {
                let body = '';
                response.on('data', chunk => (body += chunk));
                response.on('end', () => resolve(body));
            }).on('error', reject);
        });

        for (const escape of ['../../../../package.json', '..%2f..%2f..%2f..%2fpackage.json', '%2e%2e/%2e%2e/%2e%2e/%2e%2e/package.json']) {
            assert.doesNotMatch(await rawGet(`/icons/${escape}`), /lab-dash-backend/, escape);
        }
        for (const escape of ['../../package.json', '..%2f..%2fpackage.json', '%2e%2e/%2e%2e/package.json']) {
            assert.doesNotMatch(await rawGet(`/uploads/${escape}`), /lab-dash-backend/, escape);
        }
    });
});

describe('saving one layout', () => {
    const shortcut = (id: string) => ({ id, label: id, type: 'app-shortcut', url: 'http://example.test/', config: {} });

    it('is for admins only', async () => {
        const body = { pageId: null, viewport: 'mobile', items: [] };

        assert.equal((await call('PUT', '/api/config/layout', undefined, body)).status, 401);
        assert.equal((await call('PUT', '/api/config/layout', USER, body)).status, 403);
    });

    it('replaces just that layout and keeps stored secrets', async () => {
        const configBefore = getConfig();
        const secretItem = { id: 'keeps-secret', label: '', type: 'radarr-widget', config: { host: 'h', _hasApiKey: true } };
        updateConfig(config => {
            config.pages![0].layout.desktop.push({ ...secretItem, config: { host: 'h', apiKey: 'ENC:stored' } });
        });

        const reply = await call('PUT', '/api/config/layout', ADMIN, {
            pageId: 'admin-page', viewport: 'desktop', items: [shortcut('moved-first'), secretItem]
        });
        assert.equal(reply.status, 200);

        const configAfter = getConfig();
        const saved = configAfter.pages![0].layout.desktop;
        assert.deepEqual(saved.map(item => item.id), ['moved-first', 'keeps-secret']);
        assert.deepEqual(saved[1].config, { host: 'h', apiKey: 'ENC:stored' });
        // Everything else is untouched
        assert.deepEqual(configAfter.layout, configBefore.layout);
        assert.deepEqual(configAfter.pages![0].layout.mobile, configBefore.pages![0].layout.mobile);
    });

    it('saves the home layout when no page is named', async () => {
        const reply = await call('PUT', '/api/config/layout', ADMIN, { pageId: null, viewport: 'mobile', items: [shortcut('home-mobile')] });

        assert.equal(reply.status, 200);
        assert.deepEqual(getConfig().layout.mobile.map(item => item.id), ['home-mobile']);
    });

    it('rejects unknown pages and malformed requests', async () => {
        assert.equal((await call('PUT', '/api/config/layout', ADMIN, { pageId: 'nope', viewport: 'desktop', items: [] })).status, 404);
        assert.equal((await call('PUT', '/api/config/layout', ADMIN, { pageId: null, viewport: 'tablet', items: [] })).status, 400);
        assert.equal((await call('PUT', '/api/config/layout', ADMIN, { pageId: null, viewport: 'desktop' })).status, 400);
    });
});

describe('response delivery', () => {
    it('compresses large JSON responses', async () => {
        updateConfig(config => {
            config.title = 'x'.repeat(5000);
        });
        const response = await fetch(`${baseUrl}/api/config`, { headers: { 'accept-encoding': 'gzip' } });

        assert.equal(response.headers.get('content-encoding'), 'gzip');
        assert.equal((await response.json()).title.length, 5000);
    });

    it('lets browsers keep icons for a day', async () => {
        const icon = fs.readdirSync(path.join(BACKEND_ROOT, 'node_modules/@loganmarchione/homelab-svg-assets/assets'))
            .find(file => file.endsWith('.svg'));
        const response = await fetch(`${baseUrl}/icons/${icon}`);

        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control') ?? '', /max-age=86400/);
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
    it('refuses a missing SECRET and every value that shipped with the app', () => {
        for (const unusable of [undefined, '', '   ', '@jZCgtn^qg8So*^^6A2M', 'YOUR_SECRET_KEY', 'changeme']) {
            assert.equal(typeof secretProblem(unusable), 'string', String(unusable));
        }
        assert.equal(secretProblem('short'), undefined);
        assert.equal(secretProblem(SECRET), undefined);
    });

    it('only warns about a short SECRET', () => {
        assert.equal(isWeakSecret('short'), true);
        assert.equal(isWeakSecret(SECRET), false);
    });

    it('has no fallback: the server exits when SECRET is missing', () => {
        const env: NodeJS.ProcessEnv = { ...process.env, TS_NODE_TRANSPILE_ONLY: '1' };
        delete env.SECRET;

        const result = spawnSync(
            process.execPath,
            ['--require', 'ts-node/register', '-e', 'require("./src/utils/secret")'],
            { cwd: BACKEND_ROOT, env, encoding: 'utf-8' }
        );

        assert.equal(result.status, 1);
        assert.match(result.stderr, /SECRET is not set/);
    });
});
