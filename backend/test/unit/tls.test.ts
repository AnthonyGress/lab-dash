import assert from 'node:assert/strict';
import https from 'node:https';
import { afterEach, describe, it } from 'node:test';

const MODULE = require.resolve('../../src/services/tls');

/** The agent as the server would build it when started with this VERIFY_CERTIFICATES value. */
const agentFor = async (value: string | undefined): Promise<https.Agent> => {
    if (value === undefined) delete process.env.VERIFY_CERTIFICATES;
    else process.env.VERIFY_CERTIFICATES = value;

    // The setting is read once, when the module loads
    delete require.cache[MODULE];
    return (await import('../../src/services/tls')).upstreamAgent;
};

afterEach(() => {
    delete process.env.VERIFY_CERTIFICATES;
    delete require.cache[MODULE];
});

describe('the agent for HTTPS requests to services', () => {
    it('accepts self-signed certificates unless told otherwise, as homelab services need', async () => {
        for (const value of [undefined, '', 'false', '0', 'yes']) {
            assert.equal((await agentFor(value)).options.rejectUnauthorized, false, String(value));
        }
    });

    it('verifies certificates when VERIFY_CERTIFICATES is true', async () => {
        assert.equal((await agentFor('true')).options.rejectUnauthorized, true);
    });

    it('keeps connections open between polls', async () => {
        assert.equal((await agentFor(undefined)).options.keepAlive, true);
    });
});
