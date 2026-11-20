// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';

import { Fake, json, startFake } from '../helpers/fake-upstream';
import { RunningApp } from '../helpers/http';

const WAN_IP = '203.0.113.7';
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

let fake: Fake;
let app: RunningApp;
let answer: (response: http.ServerResponse) => void = response => json(response, { ip: WAN_IP });

before(async () => {
    fake = await startFake((_request, response) => answer(response));

    // The route reads the lookup URL when its module loads, so the app is started only after this
    process.env.WAN_IP_LOOKUP_URL = `http://127.0.0.1:${fake.port}/?format=json`;
    const { startApp } = await import('../helpers/http');
    app = await startApp();
});
after(() => {
    app.close();
    fake.server.close();
});

describe('GET /api/health/ip', () => {
    it('is public and reports the WAN address the lookup service answered next to the LAN address', async () => {
        const reply = await app.call('GET', '/api/health/ip');

        assert.equal(reply.status, 200);
        assert.deepEqual(Object.keys(reply.body).sort(), ['lan', 'wan']);
        assert.equal(reply.body.wan, WAN_IP);
        assert.ok(reply.body.lan === null || IPV4.test(reply.body.lan), `lan is an IPv4 address or null: ${reply.body.lan}`);
    });

    it('asks the lookup service exactly once per request', async () => {
        const alreadySeen = fake.seen.length;

        await app.call('GET', '/api/health/ip');
        await app.call('GET', '/api/health/ip');

        assert.equal(fake.seen.length, alreadySeen + 2);
        assert.deepEqual(fake.seen.slice(alreadySeen).map(request => `${request.method} ${request.url}`), ['GET /?format=json', 'GET /?format=json']);
    });

    it('answers with a null WAN address when the lookup service fails', async () => {
        answer = response => {
            response.writeHead(500, { 'content-type': 'text/plain' });
            response.end('upstream broke');
        };

        const reply = await app.call('GET', '/api/health/ip');

        assert.equal(reply.status, 200);
        assert.equal(reply.body.wan, null);
        assert.ok(reply.body.lan === null || IPV4.test(reply.body.lan));
    });

    it('answers with a null WAN address when the lookup service cannot be reached', async () => {
        // Closing the fake leaves its port refusing connections
        fake.server.closeAllConnections();
        await new Promise<void>(resolve => fake.server.close(() => resolve()));

        const reply = await app.call('GET', '/api/health/ip');

        assert.equal(reply.status, 200);
        assert.equal(reply.body.wan, null);
    });
});
