// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RealtimeModule = typeof import('../../src/realtime/socket');
type Realtime = RealtimeModule['realtime'];
type Frame = Record<string, unknown>;
type Outcome = { ok: true; result: unknown } | { ok: false; message: string };
type Registered = [EventTarget, string, Parameters<EventTarget['addEventListener']>[1]];

// Outside production BACKEND_URL falls back to http://<hostname>:5000, and jsdom runs at http://localhost:3000
const WS_URL = 'ws://localhost:5000/api/ws';

/** Stands in for the browser's WebSocket; the test plays the server through open/message/serverClose. */
class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.CONNECTING;
    readonly createdAt = Date.now();
    /** Every payload passed to send(), each one a JSON array of messages */
    readonly frames: Frame[][] = [];
    closed = false;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    send(raw: string): void {
        this.frames.push(JSON.parse(raw));
    }

    close(): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.closed = true;
    }

    open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    message(frame: Frame | string): void {
        this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
    }

    serverClose(code = 1006): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ code });
    }
}

let realtime: Realtime;
let registered: Registered[] = [];
let hidden = false;

Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

const noop = () => undefined;

const latest = (): FakeWebSocket => {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (!socket) throw new Error('No socket has been opened');
    return socket;
};

const openLatest = (): FakeWebSocket => {
    const socket = latest();
    socket.open();
    return socket;
};

const framesSent = (socket: FakeWebSocket = latest()): Frame[][] => socket.frames;
const receive = (frame: Frame | string): void => latest().message(frame);
const sub = (topic: string, itemId: string): Frame => ({ t: 'sub', topic, itemId });

/** Lets the batched send() microtask run */
const flush = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
};

/** Settles a call promise either way so a rejection never goes unhandled while timers advance */
const outcome = (promise: Promise<unknown>): Promise<Outcome> => promise.then(
    result => ({ ok: true, result }),
    (error: Error) => ({ ok: false, message: error.message }),
);

const stillPending = async (promise: Promise<unknown>): Promise<boolean> => (
    (await Promise.race([promise, Promise.resolve('pending')])) === 'pending'
);

const setHidden = (value: boolean): void => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
};

/** Closes the newest socket before it opens, waits out the longest possible backoff, and returns the wait */
const failAttempt = async (attempt: number): Promise<number> => {
    const before = FakeWebSocket.instances.length;
    const closedAt = Date.now();
    latest().serverClose();
    await vi.advanceTimersByTimeAsync(Math.min(1000 * 2 ** (attempt - 1), 30_000) * 1.2);
    expect(FakeWebSocket.instances).toHaveLength(before + 1);
    return latest().createdAt - closedAt;
};

/** Imports a fresh singleton, remembering the document/window listeners its constructor installs */
const load = async (): Promise<void> => {
    const onDocument = vi.spyOn(document, 'addEventListener');
    const onWindow = vi.spyOn(window, 'addEventListener');
    ({ realtime } = await import('../../src/realtime/socket'));
    registered = [
        ...onDocument.mock.calls.map(([type, listener]): Registered => [document, type, listener]),
        ...onWindow.mock.calls.map(([type, listener]): Registered => [window, type, listener]),
    ];
    onDocument.mockRestore();
    onWindow.mockRestore();
};

beforeEach(async () => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.resetModules();
    await load();
});

afterEach(() => {
    // Each test gets its own singleton; the previous one must stop reacting to the shared document
    registered.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
    hidden = false;
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('connecting', () => {
    it('opens nothing until something needs the server', () => {
        expect(FakeWebSocket.instances).toHaveLength(0);
        expect(realtime.getStatus()).toBe('idle');
    });

    it('opens one socket at the backend websocket address on the first watch', () => {
        realtime.watch('system', 'item-1', noop);
        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(latest().url).toBe(WS_URL);
    });

    it('shares one socket between everything that connects in the same tick', () => {
        realtime.watch('sonarr', 'item-1', noop);
        realtime.watch('radarr', 'item-2', noop);
        realtime.on('config.changed', noop);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('reports idle, then connecting, then open, to anyone listening', () => {
        const seen: string[] = [];
        const stop = realtime.onStatus(() => seen.push(realtime.getStatus()));
        expect(realtime.getStatus()).toBe('idle');
        realtime.watch('system', 'item-1', noop);
        expect(realtime.getStatus()).toBe('connecting');
        openLatest();
        expect(realtime.getStatus()).toBe('open');
        expect(seen).toEqual(['connecting', 'open']);

        stop();
        latest().serverClose();
        expect(realtime.getStatus()).toBe('connecting');
        expect(seen).toEqual(['connecting', 'open']);
    });
});

describe('subscriptions', () => {
    it('sends every watched stream in one frame when the socket opens', () => {
        realtime.watch('sonarr', 'item-1', noop);
        realtime.watch('radarr', 'item-2', noop);
        realtime.watch('weather', undefined, noop);
        const socket = openLatest();
        expect(framesSent(socket)).toEqual([[
            sub('sonarr', 'item-1'),
            sub('radarr', 'item-2'),
            { t: 'sub', topic: 'weather' },
        ]]);
    });

    it('subscribes once no matter how many widgets watch the same stream', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        realtime.watch('sonarr', 'item-1', () => undefined);
        const socket = openLatest();
        realtime.watch('sonarr', 'item-1', () => undefined);
        await flush();
        expect(framesSent(socket)).toEqual([[sub('sonarr', 'item-1')]]);
    });

    it('batches watches made on an open socket into one frame after the current tick', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const socket = openLatest();
        realtime.watch('radarr', 'item-2', noop);
        realtime.watch('weather', 'item-3', noop);
        expect(framesSent(socket)).toHaveLength(1);

        await flush();
        expect(framesSent(socket)).toEqual([
            [sub('sonarr', 'item-1')],
            [sub('radarr', 'item-2'), sub('weather', 'item-3')],
        ]);
    });

    it('returns the same frozen empty state for streams with no data yet', () => {
        const empty = realtime.getState('nobody', 'item-9');
        expect(empty).toEqual({});
        expect(Object.isFrozen(empty)).toBe(true);
        expect(realtime.getState('other')).toBe(empty);
        realtime.watch('sonarr', 'item-1', noop);
        expect(realtime.getState('sonarr', 'item-1')).toBe(empty);
    });
});

describe('incoming data', () => {
    it('stores a data frame and tells only the listeners of that stream', () => {
        const first = vi.fn();
        const second = vi.fn();
        const other = vi.fn();
        realtime.watch('sonarr', 'item-1', first);
        realtime.watch('sonarr', 'item-1', second);
        realtime.watch('radarr', 'item-2', other);
        openLatest();

        receive({ t: 'data', topic: 'sonarr', itemId: 'item-1', data: { queue: 3 } });
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ data: { queue: 3 } });
        expect(realtime.getState('radarr', 'item-2')).toEqual({});
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(other).not.toHaveBeenCalled();
    });

    it('keeps the last good value next to an error until new data arrives', () => {
        const listener = vi.fn();
        realtime.watch('sonarr', 'item-1', listener);
        openLatest();

        receive({ t: 'data', topic: 'sonarr', itemId: 'item-1', data: 'fresh' });
        receive({ t: 'err', topic: 'sonarr', itemId: 'item-1', message: 'Sonarr is unreachable' });
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ data: 'fresh', error: 'Sonarr is unreachable' });
        expect(listener).toHaveBeenCalledTimes(2);
        receive({ t: 'data', topic: 'sonarr', itemId: 'item-1', data: 'newer' });
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ data: 'newer' });
    });

    it('shows a generic message for an error frame that carries none', () => {
        realtime.watch('sonarr', 'item-1', noop);
        openLatest();

        receive({ t: 'err', topic: 'sonarr', itemId: 'item-1' });
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ error: 'Live data is unavailable' });
        receive({ t: 'err', topic: 'sonarr', itemId: 'item-1', message: '' });
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ error: 'Live data is unavailable' });
    });

    it('ignores frames for unknown streams, unknown kinds and text that is not JSON', () => {
        const listener = vi.fn();
        realtime.watch('sonarr', 'item-1', listener);
        openLatest();

        expect(() => receive({ t: 'data', topic: 'ghost', itemId: 'item-9', data: 1 })).not.toThrow();
        expect(() => receive({ t: 'mystery' })).not.toThrow();
        expect(() => receive('{ not json')).not.toThrow();
        // JSON that parses to something other than an object
        expect(() => receive('null')).not.toThrow();
        expect(() => receive('42')).not.toThrow();
        expect(() => receive('"text"')).not.toThrow();
        expect(listener).not.toHaveBeenCalled();
        expect(realtime.getState('sonarr', 'item-1')).toEqual({});
        expect(realtime.getState('ghost', 'item-9')).toEqual({});
    });
});

describe('releasing', () => {
    it('unsubscribes and forgets a stream five seconds after its last listener leaves', async () => {
        // Listeners are kept in a Set, so two widgets need two functions
        const stopFirst = realtime.watch('sonarr', 'item-1', () => undefined);
        const stopSecond = realtime.watch('sonarr', 'item-1', () => undefined);
        const socket = openLatest();
        receive({ t: 'data', topic: 'sonarr', itemId: 'item-1', data: 1 });

        stopFirst();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(framesSent(socket)).toHaveLength(1);

        stopSecond();
        await vi.advanceTimersByTimeAsync(4999);
        expect(framesSent(socket)).toHaveLength(1);
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ data: 1 });

        await vi.advanceTimersByTimeAsync(1);
        expect(framesSent(socket)).toEqual([
            [sub('sonarr', 'item-1')],
            [{ t: 'unsub', topic: 'sonarr', itemId: 'item-1' }],
        ]);
        expect(realtime.getState('sonarr', 'item-1')).toEqual({});
    });

    it('keeps the stream and its value when it is watched again within the delay', async () => {
        const stop = realtime.watch('sonarr', 'item-1', noop);
        const socket = openLatest();
        receive({ t: 'data', topic: 'sonarr', itemId: 'item-1', data: 1 });

        stop();
        await vi.advanceTimersByTimeAsync(4000);
        realtime.watch('sonarr', 'item-1', noop);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(framesSent(socket)).toHaveLength(1);
        expect(realtime.getState('sonarr', 'item-1')).toEqual({ data: 1 });
    });
});

describe('calls', () => {
    it('sends calls with increasing ids and resolves each with its own result', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const socket = openLatest();
        const first = outcome(realtime.call('sonarr.search', 'item-1', { term: 'x' }));
        const second = outcome(realtime.call('radarr.refresh', 'item-2'));
        await flush();
        expect(framesSent(socket)[1]).toEqual([
            { t: 'call', id: 1, method: 'sonarr.search', itemId: 'item-1', params: { term: 'x' } },
            { t: 'call', id: 2, method: 'radarr.refresh', itemId: 'item-2' },
        ]);

        receive({ t: 'res', id: 2, ok: true, result: 'second done' });
        receive({ t: 'res', id: 1, ok: true, result: { hits: 2 } });
        expect(await first).toEqual({ ok: true, result: { hits: 2 } });
        expect(await second).toEqual({ ok: true, result: 'second done' });
    });

    it('rejects with the server message, or a generic one when there is none', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        openLatest();
        const explained = outcome(realtime.call('sonarr.search', 'item-1'));
        const bare = outcome(realtime.call('sonarr.search', 'item-1'));
        await flush();

        receive({ t: 'res', id: 1, ok: false, message: 'No such series' });
        receive({ t: 'res', id: 2, ok: false });
        expect(await explained).toEqual({ ok: false, message: 'No such series' });
        expect(await bare).toEqual({ ok: false, message: 'Request failed' });
    });

    it('gives up on a call the server has not answered after fifteen seconds', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        openLatest();
        const result = outcome(realtime.call('sonarr.slow', 'item-1'));

        await vi.advanceTimersByTimeAsync(14_999);
        expect(await stillPending(result)).toBe(true);
        await vi.advanceTimersByTimeAsync(1);
        expect(await result).toEqual({ ok: false, message: 'The server did not answer in time' });
    });

    it('rejects calls in flight when the connection drops and never repeats them', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const first = openLatest();
        const result = outcome(realtime.call('sonarr.search', 'item-1'));
        await flush();
        expect(framesSent(first)).toHaveLength(2);

        first.serverClose();
        expect(await result).toEqual({ ok: false, message: 'Connection lost. Please try again.' });
        await vi.advanceTimersByTimeAsync(1200);
        const second = openLatest();
        expect(second).not.toBe(first);
        expect(framesSent(second)).toEqual([[sub('sonarr', 'item-1')]]);
    });

    it('connects for a call made while disconnected and sends it along with the subscriptions', async () => {
        const result = outcome(realtime.call('weather.refresh', 'item-1', { units: 'c' }));
        expect(FakeWebSocket.instances).toHaveLength(1);
        realtime.watch('sonarr', 'item-2', noop);
        const socket = openLatest();
        expect(framesSent(socket)).toEqual([[
            sub('sonarr', 'item-2'),
            { t: 'call', id: 1, method: 'weather.refresh', itemId: 'item-1', params: { units: 'c' } },
        ]]);

        receive({ t: 'res', id: 1, ok: true, result: 'done' });
        expect(await result).toEqual({ ok: true, result: 'done' });
    });
});

describe('events', () => {
    it('delivers server events to listeners, except the ones this tab caused', () => {
        const listener = vi.fn();
        realtime.on('config.changed', listener);
        expect(FakeWebSocket.instances).toHaveLength(1);
        openLatest();

        receive({ t: 'event', name: 'config.changed', origin: 'another-tab' });
        expect(listener).toHaveBeenCalledWith({ name: 'config.changed', origin: 'another-tab' });
        receive({ t: 'event', name: 'config.changed', origin: realtime.clientId });
        receive({ t: 'event', name: 'something.else' });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops delivering once the listener unsubscribes', () => {
        const listener = vi.fn();
        const stop = realtime.on('config.changed', listener);
        openLatest();
        stop();
        receive({ t: 'event', name: 'config.changed' });
        expect(listener).not.toHaveBeenCalled();
    });

    it('emits session.ended when the server closes the socket with 4401', async () => {
        const listener = vi.fn();
        realtime.on('session.ended', listener);
        openLatest();
        latest().serverClose(1006);
        expect(listener).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1200);
        openLatest();
        latest().serverClose(4401);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({ name: 'session.ended' });
    });
});

describe('reconnecting', () => {
    it('reports idle, not open, when the server closes a socket nobody needs any more', async () => {
        const stop = realtime.watch('sonarr', 'item-1', noop);
        openLatest();
        expect(realtime.getStatus()).toBe('open');

        stop();
        await vi.advanceTimersByTimeAsync(5000);
        latest().serverClose();

        expect(realtime.getStatus()).toBe('idle');
        await vi.advanceTimersByTimeAsync(60_000);
        expect(FakeWebSocket.instances).toHaveLength(1);

        // The same when this tab asks for a fresh connection with nothing to send
        realtime.reconnect();
        expect(realtime.getStatus()).toBe('idle');
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('reconnects about a second after an unexpected close', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        openLatest();
        latest().serverClose();
        expect(realtime.getStatus()).toBe('connecting');
        expect(FakeWebSocket.instances).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(799);
        expect(FakeWebSocket.instances).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(401);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(latest().url).toBe(WS_URL);
    });

    it('replays every subscription in one frame when the connection comes back', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        realtime.watch('radarr', 'item-2', noop);
        openLatest();
        latest().serverClose();

        await vi.advanceTimersByTimeAsync(1200);
        const socket = openLatest();
        expect(framesSent(socket)).toEqual([[sub('sonarr', 'item-1'), sub('radarr', 'item-2')]]);
        expect(realtime.getStatus()).toBe('open');
    });

    it('says live updates are unavailable after four failed attempts in a row', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const seen: string[] = [];
        realtime.onStatus(() => seen.push(realtime.getStatus()));
        for (let attempt = 1; attempt <= 3; attempt++) await failAttempt(attempt);
        expect(realtime.getStatus()).toBe('connecting');

        latest().serverClose();
        expect(realtime.getStatus()).toBe('unavailable');
        expect(seen).toEqual(['unavailable']);
    });

    it('doubles the wait between attempts with jitter and caps it at thirty seconds', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const waits: number[] = [];
        for (let attempt = 1; attempt <= 7; attempt++) waits.push(await failAttempt(attempt));

        waits.forEach((wait, index) => {
            const nominal = Math.min(1000 * 2 ** index, 30_000);
            expect(wait).toBeGreaterThanOrEqual(nominal * 0.8);
            expect(wait).toBeLessThanOrEqual(nominal * 1.2);
        });
    });

    it('trusts a connection again only after it has held for ten seconds', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        for (let attempt = 1; attempt <= 4; attempt++) await failAttempt(attempt);
        expect(realtime.getStatus()).toBe('unavailable');

        openLatest();
        expect(realtime.getStatus()).toBe('unavailable');
        await vi.advanceTimersByTimeAsync(9999);
        expect(realtime.getStatus()).toBe('unavailable');
        await vi.advanceTimersByTimeAsync(1);
        expect(realtime.getStatus()).toBe('open');

        // The failure count started over: the next drop is an ordinary one-second retry
        latest().serverClose();
        expect(realtime.getStatus()).toBe('connecting');
        await vi.advanceTimersByTimeAsync(1200);
        expect(FakeWebSocket.instances).toHaveLength(6);
    });

    it('reconnect() drops the current socket and opens a new one at once', () => {
        realtime.watch('sonarr', 'item-1', noop);
        const first = openLatest();
        realtime.reconnect();
        expect(first.closed).toBe(true);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(realtime.getStatus()).toBe('connecting');

        openLatest();
        expect(realtime.getStatus()).toBe('open');
        first.message({ t: 'data', topic: 'sonarr', itemId: 'item-1', data: 'stale' });
        expect(realtime.getState('sonarr', 'item-1')).toEqual({});
    });

    it('reconnects when the browser reports it is back online', () => {
        realtime.watch('sonarr', 'item-1', noop);
        const first = openLatest();
        window.dispatchEvent(new Event('online'));
        expect(first.closed).toBe(true);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(latest()).not.toBe(first);
    });
});

describe('hidden tab', () => {
    it('gives up the connection after a minute hidden and does not reconnect', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const socket = openLatest();
        setHidden(true);
        await vi.advanceTimersByTimeAsync(59_999);
        expect(socket.closed).toBe(false);
        expect(realtime.getStatus()).toBe('open');

        await vi.advanceTimersByTimeAsync(1);
        expect(socket.closed).toBe(true);
        expect(realtime.getStatus()).toBe('idle');
        realtime.watch('radarr', 'item-2', noop);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('connects again with every subscription when the tab is shown', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        openLatest();
        setHidden(true);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(realtime.getStatus()).toBe('idle');

        setHidden(false);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(realtime.getStatus()).toBe('connecting');
        expect(framesSent(openLatest())).toEqual([[sub('sonarr', 'item-1')]]);
    });

    it('keeps the connection when the tab is shown again within the minute', async () => {
        realtime.watch('sonarr', 'item-1', noop);
        const socket = openLatest();
        setHidden(true);
        await vi.advanceTimersByTimeAsync(30_000);
        setHidden(false);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(socket.closed).toBe(false);
        expect(realtime.getStatus()).toBe('open');
        expect(FakeWebSocket.instances).toHaveLength(1);
    });
});
