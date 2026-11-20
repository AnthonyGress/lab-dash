// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sourceId, UpstreamConnection } from '../../src/services/upstream';

const connection = (overrides: Partial<UpstreamConnection> = {}): UpstreamConnection => ({
    origin: 'http://192.168.1.5:7878',
    username: 'admin',
    password: 'hunter2-password',
    apiKey: 'api-key-0123456789',
    ...overrides
});

describe('sourceId', () => {
    it('gives equal connections the same name, so their widgets share one poller', () => {
        assert.equal(sourceId('radarr', connection()), sourceId('radarr', connection()));
    });

    it('tells apart connections that differ in address, login or kind', () => {
        const ids = [
            sourceId('radarr', connection()),
            sourceId('sonarr', connection()),
            sourceId('radarr', connection({ origin: 'https://192.168.1.5:7878' })),
            sourceId('radarr', connection({ username: 'guest' })),
            sourceId('radarr', connection({ password: 'another-password' })),
            sourceId('radarr', connection({ apiKey: 'another-key' })),
            sourceId('radarr', connection({ apiToken: 'token' }))
        ];

        assert.equal(new Set(ids).size, ids.length);
    });

    it('says nothing about the credentials it stands for', () => {
        const secret = connection({ password: 'first-secret', apiKey: 'second-secret' });
        const id = sourceId(secret);

        assert.match(id, /^\d+$/);
        assert.ok(!id.includes('secret'));
    });
});
