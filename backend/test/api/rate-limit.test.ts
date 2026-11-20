// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RunningApp, startApp } from '../helpers/http';

// The limiters are module singletons that count per process, so this file runs
// on its own and its tests are written to run in order.
const AUTH_LIMIT = 150;
const REFUSED = {
    success: false,
    message: 'Too many authentication attempts, please try again after 5 minutes',
    error_source: 'labdash_api'
};

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

before(async () => {
    app = await startApp();
});
after(() => app.close());

describe('the auth rate limit', () => {
    it(`lets ${AUTH_LIMIT} requests through while counting down the standard headers`, async () => {
        for (let sent = 1; sent <= AUTH_LIMIT; sent++) {
            const reply = await call('GET', '/api/auth/check-users');

            assert.equal(reply.status, 200, `request ${sent}`);
            assert.equal(reply.headers.get('ratelimit-limit'), String(AUTH_LIMIT), `request ${sent}`);
            assert.equal(reply.headers.get('ratelimit-remaining'), String(AUTH_LIMIT - sent), `request ${sent}`);
            assert.match(reply.headers.get('ratelimit-reset') ?? '', /^\d+$/);
            assert.equal(reply.headers.get('x-ratelimit-limit'), null);
            assert.equal(reply.headers.get('x-ratelimit-remaining'), null);
        }
    });

    it(`refuses request ${AUTH_LIMIT + 1} with a JSON 429`, async () => {
        const reply = await call('GET', '/api/auth/check-users');

        assert.equal(reply.status, 429);
        assert.deepEqual(reply.body, REFUSED);
        assert.equal(reply.headers.get('ratelimit-remaining'), '0');
        assert.match(reply.headers.get('retry-after') ?? '', /^\d+$/);
    });

    it('covers every route under /api/auth', async () => {
        const login = await call('POST', '/api/auth/login', undefined, { username: 'admin', password: 'anything' });
        const check = await call('GET', '/api/auth/check-admin');

        assert.equal(login.status, 429);
        assert.deepEqual(login.body, REFUSED);
        assert.equal(check.status, 429);
    });

    it('leaves the other route groups alone', async () => {
        const timezone = await call('GET', '/api/timezone?latitude=1&longitude=1');
        const notes = await call('GET', '/api/notes');

        assert.equal(timezone.status, 200);
        assert.equal(timezone.headers.get('ratelimit-limit'), '200');
        assert.equal(notes.status, 200);
    });
});
