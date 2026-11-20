import { BACKEND_URL } from '../constants/constants';

/** Latest value of one live stream. Both fields empty means it is still loading. */
export type LiveState = {
    data?: unknown;
    error?: string;
};

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'unavailable';
export type RealtimeEvent = { name: string; origin?: string };

type Listener = () => void;

type Stream = {
    topic: string;
    itemId?: string;
    state: LiveState;
    listeners: Set<Listener>;
    releaseTimer?: ReturnType<typeof setTimeout>;
};

type PendingCall = {
    frame: unknown;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

const EMPTY_STATE: LiveState = Object.freeze({});

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
// A connection must survive this long before it counts as working
const STABLE_AFTER_MS = 10_000;
// Failed attempts in a row before the UI says live updates are unavailable
const UNAVAILABLE_AFTER_ATTEMPTS = 4;
// Keeps a stream through quick unmount/remount cycles (page switches, drag overlays)
const RELEASE_DELAY_MS = 5000;
// A tab hidden for this long gives up its connection until it is shown again
const HIDDEN_SUSPEND_MS = 60_000;
const CALL_TIMEOUT_MS = 15_000;
// Close code the server uses when the login behind the socket ended
const SESSION_ENDED = 4401;

const streamKey = (topic: string, itemId?: string): string => `${topic}|${itemId ?? ''}`;

/**
 * One WebSocket shared by every live widget in this tab.
 *
 * Widgets watch a topic (optionally for one dashboard item) and get pushed the
 * latest value; they never poll. Subscriptions made in the same tick travel in
 * one frame, survive reconnects, and are dropped while the tab is hidden.
 */
class RealtimeSocket {
    /** Sent with config saves so this tab can skip reloading its own change */
    readonly clientId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    private socket?: WebSocket;
    private status: RealtimeStatus = 'idle';
    private readonly streams = new Map<string, Stream>();
    private readonly calls = new Map<number, PendingCall>();
    private readonly eventListeners = new Map<string, Set<(event: RealtimeEvent) => void>>();
    private readonly statusListeners = new Set<Listener>();
    private outbox: unknown[] = [];
    private flushQueued = false;
    private nextCallId = 1;
    private failedAttempts = 0;
    private suspended = false;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private stableTimer?: ReturnType<typeof setTimeout>;
    private hiddenTimer?: ReturnType<typeof setTimeout>;

    constructor() {
        if (typeof document === 'undefined') return;

        const onVisibilityChange = () => {
            clearTimeout(this.hiddenTimer);
            if (document.hidden) {
                this.hiddenTimer = setTimeout(() => this.suspend(), HIDDEN_SUSPEND_MS);
            } else if (this.suspended) {
                this.suspended = false;
                this.connect();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        // A tab opened in the background never gets the event
        onVisibilityChange();
        window.addEventListener('online', () => this.reconnect());
    }

    /** Watches a stream. The listener is told when its state changes; returns the function to stop. */
    watch = (topic: string, itemId: string | undefined, listener: Listener): (() => void) => {
        const key = streamKey(topic, itemId);
        let stream = this.streams.get(key);

        if (!stream) {
            stream = { topic, itemId, state: EMPTY_STATE, listeners: new Set() };
            this.streams.set(key, stream);
            this.send({ t: 'sub', topic, itemId });
        }

        clearTimeout(stream.releaseTimer);
        stream.releaseTimer = undefined;
        stream.listeners.add(listener);
        this.connect();

        const watched = stream;
        return () => {
            watched.listeners.delete(listener);
            if (watched.listeners.size > 0) return;

            watched.releaseTimer = setTimeout(() => {
                if (watched.listeners.size > 0 || this.streams.get(key) !== watched) return;
                this.streams.delete(key);
                this.send({ t: 'unsub', topic, itemId });
            }, RELEASE_DELAY_MS);
        };
    };

    getState = (topic: string, itemId?: string): LiveState => (
        this.streams.get(streamKey(topic, itemId))?.state ?? EMPTY_STATE
    );

    /** Runs a one-off action or query on the server. Rejects with a message meant for the user. */
    call = <T = unknown>(method: string, itemId?: string, params?: unknown): Promise<T> => (
        new Promise<T>((resolve, reject) => {
            const id = this.nextCallId++;
            const frame = { t: 'call', id, method, itemId, params };
            const timer = setTimeout(() => {
                this.calls.delete(id);
                reject(new Error('The server did not answer in time'));
            }, CALL_TIMEOUT_MS);

            this.calls.set(id, { frame, resolve: resolve as (result: unknown) => void, reject, timer });
            if (this.isOpen()) this.send(frame);
            else this.connect();
        })
    );

    /** Listens for a server event such as `config.changed`. Changes made by this tab are not reported. */
    on = (name: string, listener: (event: RealtimeEvent) => void): (() => void) => {
        const listeners = this.eventListeners.get(name) ?? new Set();
        this.eventListeners.set(name, listeners);
        listeners.add(listener);
        this.connect();

        return () => {
            listeners.delete(listener);
        };
    };

    /** Opens a fresh connection, e.g. after logging in or out so the server sees the new session. */
    reconnect = (): void => {
        this.failedAttempts = 0;
        this.suspended = false;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        this.dropSocket();
        this.connect();
    };

    getStatus = (): RealtimeStatus => this.status;

    onStatus = (listener: Listener): (() => void) => {
        this.statusListeners.add(listener);
        return () => {
            this.statusListeners.delete(listener);
        };
    };

    private isOpen(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    private hasWork(): boolean {
        return this.streams.size > 0 || this.calls.size > 0 ||
            [...this.eventListeners.values()].some(listeners => listeners.size > 0);
    }

    private setStatus(status: RealtimeStatus): void {
        if (this.status === status) return;
        this.status = status;
        this.statusListeners.forEach(listener => listener());
    }

    private connect(): void {
        if (this.socket || this.reconnectTimer || this.suspended) return;
        if (!this.hasWork()) {
            // Nothing to do and no socket: say so, e.g. after the server closed the last idle connection
            this.setStatus('idle');
            return;
        }

        const url = `${(BACKEND_URL || window.location.origin).replace(/^http/, 'ws')}/api/ws`;
        let socket: WebSocket;
        try {
            socket = new WebSocket(url);
        } catch {
            this.scheduleReconnect();
            return;
        }

        this.socket = socket;
        if (this.status !== 'unavailable') this.setStatus('connecting');

        socket.onopen = () => {
            if (this.socket !== socket) return;

            this.stableTimer = setTimeout(() => {
                this.failedAttempts = 0;
                this.setStatus('open');
            }, STABLE_AFTER_MS);
            // After repeated failures, wait until the connection holds before saying it works
            if (this.status !== 'unavailable') this.setStatus('open');

            // Everything this tab wants, in one frame
            this.outbox = [];
            const frames: unknown[] = [...this.streams.values()].map(({ topic, itemId }) => ({ t: 'sub', topic, itemId }));
            this.calls.forEach(call => frames.push(call.frame));
            if (frames.length > 0) socket.send(JSON.stringify(frames));
        };

        socket.onmessage = event => {
            if (this.socket === socket) this.receive(event.data);
        };

        socket.onclose = event => {
            if (this.socket !== socket) return;
            this.dropSocket();

            if (event.code === SESSION_ENDED) this.emit({ name: 'session.ended' });
            if (!this.suspended) this.scheduleReconnect();
        };
    }

    /** Forgets the current socket without scheduling anything. */
    private dropSocket(): void {
        const socket = this.socket;
        this.socket = undefined;
        clearTimeout(this.stableTimer);
        this.outbox = [];

        // An action may or may not have reached the server: never repeat it silently
        this.calls.forEach(call => {
            clearTimeout(call.timer);
            call.reject(new Error('Connection lost. Please try again.'));
        });
        this.calls.clear();

        if (socket) {
            socket.onopen = socket.onmessage = socket.onclose = null;
            socket.close();
        }
    }

    private suspend(): void {
        this.suspended = true;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        this.dropSocket();
        this.setStatus('idle');
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        if (!this.hasWork()) {
            this.setStatus('idle');
            return;
        }

        this.failedAttempts += 1;
        if (this.failedAttempts >= UNAVAILABLE_AFTER_ATTEMPTS) this.setStatus('unavailable');
        else this.setStatus('connecting');

        const backoff = Math.min(RECONNECT_BASE_MS * 2 ** (this.failedAttempts - 1), RECONNECT_MAX_MS);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            this.connect();
        }, backoff * (0.8 + Math.random() * 0.4));
    }

    private send(frame: unknown): void {
        // While disconnected nothing is queued: subscriptions are replayed when the socket opens
        if (!this.isOpen()) return;

        this.outbox.push(frame);
        if (this.flushQueued) return;

        this.flushQueued = true;
        queueMicrotask(() => {
            this.flushQueued = false;
            const frames = this.outbox;
            this.outbox = [];
            if (frames.length > 0 && this.isOpen()) this.socket!.send(JSON.stringify(frames));
        });
    }

    private receive(raw: unknown): void {
        let frame: any;
        try {
            frame = JSON.parse(String(raw));
        } catch {
            return;
        }
        if (!frame || typeof frame !== 'object') return;

        if (frame.t === 'data' || frame.t === 'err') {
            const stream = this.streams.get(streamKey(frame.topic, frame.itemId));
            if (!stream) return;

            // The last good value stays visible next to an error
            stream.state = frame.t === 'data'
                ? { data: frame.data }
                : { data: stream.state.data, error: typeof frame.message === 'string' && frame.message ? frame.message : 'Live data is unavailable' };
            stream.listeners.forEach(listener => listener());
        } else if (frame.t === 'res') {
            const call = this.calls.get(frame.id);
            if (!call) return;

            this.calls.delete(frame.id);
            clearTimeout(call.timer);
            if (frame.ok) call.resolve(frame.result);
            else call.reject(new Error(frame.message || 'Request failed'));
        } else if (frame.t === 'event' && frame.origin !== this.clientId) {
            this.emit({ name: String(frame.name), origin: frame.origin });
        }
    }

    private emit(event: RealtimeEvent): void {
        this.eventListeners.get(event.name)?.forEach(listener => listener(event));
    }
}

export const realtime = new RealtimeSocket();
