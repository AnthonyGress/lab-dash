// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { Reply, RunningApp, startApp } from '../helpers/http';

let app: RunningApp;

const lookup = (query: Record<string, string>): Promise<Reply> => (
    app.call('GET', `/api/timezone?${new URLSearchParams(query)}`)
);

before(async () => {
    app = await startApp();
});
after(() => app.close());

describe('GET /api/timezone', () => {
    it('is public and names the IANA zone of the coordinates', async () => {
        const cities: Array<[string, string, string]> = [
            ['40.7128', '-74.0060', 'America/New_York'],
            ['51.5074', '-0.1278', 'Europe/London'],
            ['35.6762', '139.6503', 'Asia/Tokyo']
        ];

        for (const [latitude, longitude, timezone] of cities) {
            const reply = await lookup({ latitude, longitude });
            assert.equal(reply.status, 200, timezone);
            assert.deepEqual(reply.body, { timezone });
        }
    });

    it('answers a nautical zone for a point in the ocean', async () => {
        const reply = await lookup({ latitude: '0', longitude: '-150' });

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { timezone: 'Etc/GMT+10' });
    });

    it('requires both coordinates', async () => {
        const incomplete: Array<Record<string, string>> = [{}, { latitude: '40.7' }, { longitude: '-74' }, { latitude: '', longitude: '-74' }];

        for (const query of incomplete) {
            const reply = await lookup(query);
            assert.equal(reply.status, 400, JSON.stringify(query));
            assert.deepEqual(reply.body, { error: 'Both latitude and longitude are required parameters' });
        }
    });

    it('requires numbers', async () => {
        for (const query of [{ latitude: 'north', longitude: '-74' }, { latitude: '40.7', longitude: 'west' }]) {
            const reply = await lookup(query);
            assert.equal(reply.status, 400, JSON.stringify(query));
            assert.deepEqual(reply.body, { error: 'Latitude and longitude must be valid numbers' });
        }
    });

    it('keeps the latitude between -90 and 90', async () => {
        for (const latitude of ['90.1', '-90.1', '400']) {
            const reply = await lookup({ latitude, longitude: '0' });
            assert.equal(reply.status, 400, latitude);
            assert.deepEqual(reply.body, { error: 'Latitude must be between -90 and 90' });
        }
        assert.equal((await lookup({ latitude: '90', longitude: '0' })).status, 200);
        assert.equal((await lookup({ latitude: '-90', longitude: '0' })).status, 200);
    });

    it('keeps the longitude between -180 and 180', async () => {
        for (const longitude of ['180.1', '-180.1', '720']) {
            const reply = await lookup({ latitude: '0', longitude });
            assert.equal(reply.status, 400, longitude);
            assert.deepEqual(reply.body, { error: 'Longitude must be between -180 and 180' });
        }
        assert.equal((await lookup({ latitude: '0', longitude: '180' })).status, 200);
        assert.equal((await lookup({ latitude: '0', longitude: '-180' })).status, 200);
    });
});
