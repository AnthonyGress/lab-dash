import { Request, Response } from 'express';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLIENT_ID_HEADER, getRequestOrigin, trackRequestOrigin } from '../../src/utils/request-origin';

/** Runs `next` the way Express would for a request carrying only `headers`. */
const handle = (headers: Record<string, string>, next: () => void | Promise<void>): void => {
    const request = { get: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
    trackRequestOrigin(request, {} as Response, next);
};

/** What a handler sees as the origin of a request carrying `headers`. */
const originSeenBy = (headers: Record<string, string>): string | undefined => {
    const seen: (string | undefined)[] = [];
    handle(headers, () => {
        seen.push(getRequestOrigin());
    });
    assert.equal(seen.length, 1, 'the handler runs exactly once');
    return seen[0];
};

const afterPendingCallbacks = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('request origin', () => {
    it('is undefined outside a tracked request', () => {
        assert.equal(getRequestOrigin(), undefined);
    });

    it('is the x-client-id header while the request is handled', () => {
        assert.equal(CLIENT_ID_HEADER, 'x-client-id');
        assert.equal(originSeenBy({ 'x-client-id': 'tab-1' }), 'tab-1');
        assert.equal(originSeenBy({ 'X-Client-Id': 'tab-2' }), undefined, 'the fake request is case-sensitive on purpose');
    });

    it('is undefined when the request has no x-client-id header', () => {
        assert.equal(originSeenBy({}), undefined);
        assert.equal(originSeenBy({ 'x-client-id': '' }), undefined);
    });

    it('drops a client id longer than 64 characters', () => {
        assert.equal(originSeenBy({ 'x-client-id': 'a'.repeat(64) }), 'a'.repeat(64));
        assert.equal(originSeenBy({ 'x-client-id': 'a'.repeat(65) }), undefined);
    });

    it('does not leak from one request into the next', () => {
        assert.equal(originSeenBy({ 'x-client-id': 'first' }), 'first');
        assert.equal(originSeenBy({ 'x-client-id': 'second' }), 'second');
        assert.equal(originSeenBy({}), undefined);
        assert.equal(getRequestOrigin(), undefined);
    });

    it('keeps each id with its own request when two overlap', async () => {
        const seen: Record<string, (string | undefined)[]> = { a: [], b: [] };
        const handleSlowly = (key: string, clientId: string): Promise<void> => new Promise(resolve => {
            handle({ 'x-client-id': clientId }, async () => {
                seen[key].push(getRequestOrigin());
                await afterPendingCallbacks();
                seen[key].push(getRequestOrigin());
                resolve();
            });
        });

        await Promise.all([handleSlowly('a', 'tab-a'), handleSlowly('b', 'tab-b')]);

        assert.deepEqual(seen, { a: ['tab-a', 'tab-a'], b: ['tab-b', 'tab-b'] });
        assert.equal(getRequestOrigin(), undefined);
    });
});
