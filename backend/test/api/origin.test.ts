// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const ADMIN = cookieFor('admin');
const UPLOADS = process.env.UPLOAD_DIRECTORY!;
const EVIL = 'https://evil.example';

let app: RunningApp;

type Reply = { status: number; headers: http.IncomingHttpHeaders; body: any };

/** Sends the request with exactly these headers: fetch would not let a test set Origin or Host. */
const send = (method: string, url: string, headers: http.OutgoingHttpHeaders, body?: unknown): Promise<Reply> => (
    new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const request = http.request(`${app.baseUrl}${url}`, {
            method,
            headers: {
                // Node leaves the length off a DELETE, and the server would then not read the body
                ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
                ...headers
            }
        }, response => {
            let text = '';
            response.on('data', chunk => {
                text += chunk;
            });
            response.on('end', () => {
                let parsed: unknown = text;
                try {
                    parsed = JSON.parse(text);
                } catch {
                    // Not JSON: the text is handed back as it came
                }
                resolve({ status: response.statusCode ?? 0, headers: response.headers, body: parsed });
            });
        });
        request.on('error', reject);
        request.end(payload);
    })
);

/** An admin's browser deleting an upload, with `headers` describing where the page came from. */
const deleteUpload = async (headers: http.OutgoingHttpHeaders): Promise<{ status: number; body: any; deleted: boolean }> => {
    const file = path.join(UPLOADS, 'wallpaper.jpg');
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.writeFileSync(file, 'image');

    const { status, body } = await send('DELETE', '/api/uploads/images', { cookie: ADMIN, ...headers }, { imagePath: '/uploads/wallpaper.jpg' });
    return { status, body, deleted: !fs.existsSync(file) };
};

before(async () => {
    app = await startApp();
});
after(() => app.close());

describe('changes sent with a logged-in visitor\'s cookies', () => {
    it('are refused when another site sends them, and nothing is changed', async () => {
        // 'null' is what a sandboxed page or a privacy redirect sends
        for (const origin of [EVIL, 'http://127.0.0.1.evil.example', 'null', 'not a url']) {
            const reply = await deleteUpload({ origin });

            assert.equal(reply.status, 403, origin);
            assert.match(reply.body.message, /ALLOWED_ORIGINS/, origin);
            assert.equal(reply.deleted, false, origin);
        }
    });

    it('are accepted from the dashboard\'s own pages, whatever the scheme and port', async () => {
        const origins = [
            app.baseUrl,
            // The dev frontend on its own port, and TLS ended at a reverse proxy
            'http://127.0.0.1:2022',
            'https://127.0.0.1'
        ];

        for (const origin of origins) {
            const reply = await deleteUpload({ origin });

            assert.equal(reply.status, 200, origin);
            assert.equal(reply.deleted, true, origin);
        }
    });

    it('are accepted behind a reverse proxy that passes the public host name on', async () => {
        const origin = 'https://dash.example.com';

        assert.equal((await deleteUpload({ origin, host: 'dash.example.com' })).status, 200);
        assert.equal((await deleteUpload({ origin, 'x-forwarded-host': 'dash.example.com' })).status, 200);
        // The proxy forwards neither: the server cannot tell this is its own address
        assert.equal((await deleteUpload({ origin })).status, 403);
    });

    it('trust the browser when it reports the request as same-origin', async () => {
        const origin = 'https://dash.example.com';

        assert.equal((await deleteUpload({ origin, 'sec-fetch-site': 'same-origin' })).status, 200);
        for (const site of ['same-site', 'cross-site', 'none']) {
            assert.equal((await deleteUpload({ origin, 'sec-fetch-site': site })).status, 403, site);
        }
    });

    it('are accepted from an origin listed in ALLOWED_ORIGINS', async () => {
        process.env.ALLOWED_ORIGINS = 'https://other.example, https://dash.example.com';
        try {
            assert.equal((await deleteUpload({ origin: 'https://dash.example.com' })).status, 200);
            assert.equal((await deleteUpload({ origin: 'http://dash.example.com' })).status, 403, 'the scheme is part of the origin');
            assert.equal((await deleteUpload({ origin: EVIL })).status, 403);
        } finally {
            delete process.env.ALLOWED_ORIGINS;
        }
    });

    it('are accepted from clients that send no Origin, such as scripts', async () => {
        const reply = await deleteUpload({});

        assert.equal(reply.status, 200);
        assert.equal(reply.deleted, true);
    });

    it('cover logging in and out as well', async () => {
        for (const url of ['/api/auth/login', '/api/auth/logout', '/api/auth/refresh', '/api/auth/signup']) {
            const reply = await send('POST', url, { origin: EVIL }, { username: 'admin', password: 'x' });
            assert.equal(reply.status, 403, url);
        }
    });
});

describe('reading the API from another origin', () => {
    it('is allowed with the login for the dashboard\'s own pages on another port', async () => {
        const origin = 'http://127.0.0.1:2022';
        const reply = await send('GET', '/api/auth/check-cookies', { origin, cookie: ADMIN });

        assert.equal(reply.status, 200);
        assert.equal(reply.headers['access-control-allow-origin'], origin);
        assert.equal(reply.headers['access-control-allow-credentials'], 'true');
    });

    it('is not opened to other sites: the browser keeps the answer from them', async () => {
        const reply = await send('GET', '/api/auth/check-cookies', { origin: EVIL, cookie: ADMIN });

        assert.equal(reply.headers['access-control-allow-origin'], undefined);
        assert.equal(reply.headers['access-control-allow-credentials'], undefined);
    });

    it('answers the preflight of its own pages only', async () => {
        const preflight = (origin: string) => send('OPTIONS', '/api/config', {
            origin,
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type,x-client-id'
        });

        const own = await preflight('http://127.0.0.1:2022');
        assert.equal(own.status, 204);
        assert.equal(own.headers['access-control-allow-origin'], 'http://127.0.0.1:2022');
        assert.match(String(own.headers['access-control-allow-methods']), /POST/);

        const other = await preflight(EVIL);
        assert.equal(other.headers['access-control-allow-origin'], undefined);
        assert.equal(other.headers['access-control-allow-methods'], undefined);
    });
});
