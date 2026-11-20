import { RealtimeError } from './access';

/** Where a stream's data comes from. Sources with the same key share one poller. */
export type StreamSource = {
    /** Identifies the upstream target, never the subscriber or the config revision */
    key: string;
    /** Delay between reads. A function can slow down while the last result is idle; it gets `undefined` until a read succeeds */
    intervalMs: number | ((data: unknown) => number);
    read: (signal: AbortSignal) => Promise<unknown>;
};

export type Subscriber = {
    /** `json` is the already serialized data, so it is only stringified once */
    onData: (json: string) => void;
    onError: (message: string) => void;
};

export type HubOptions = {
    /** How long an unwatched poller keeps its last value before it is dropped */
    lingerMs?: number;
    readTimeoutMs?: number;
    maxErrorBackoffMs?: number;
};

type Poller = {
    source: StreamSource;
    subscribers: Set<Subscriber>;
    json?: string;
    data?: unknown;
    error?: string;
    failures: number;
    reading: boolean;
    refreshQueued: boolean;
    timer?: NodeJS.Timeout;
    lingerTimer?: NodeJS.Timeout;
    abort?: AbortController;
};

const GENERIC_ERROR = 'Service is unavailable';

/**
 * Shares upstream polling between everyone watching the same thing. Ten tabs on
 * one torrent widget cause one request per interval, not ten, and nothing is
 * polled while nobody is watching.
 */
export class PollerHub {
    private readonly pollers = new Map<string, Poller>();
    private readonly lingerMs: number;
    private readonly readTimeoutMs: number;
    private readonly maxErrorBackoffMs: number;

    constructor(options: HubOptions = {}) {
        this.lingerMs = options.lingerMs ?? 30_000;
        this.readTimeoutMs = options.readTimeoutMs ?? 30_000;
        this.maxErrorBackoffMs = options.maxErrorBackoffMs ?? 60_000;
    }

    /** Starts (or joins) polling of a source. Returns the function that stops watching. */
    subscribe(source: StreamSource, subscriber: Subscriber): () => void {
        let poller = this.pollers.get(source.key);
        if (!poller) {
            poller = { source, subscribers: new Set(), failures: 0, reading: false, refreshQueued: false };
            this.pollers.set(source.key, poller);
        }

        clearTimeout(poller.lingerTimer);
        poller.lingerTimer = undefined;
        poller.subscribers.add(subscriber);

        // Show the last known value at once instead of waiting for the next read
        if (poller.error !== undefined) subscriber.onError(poller.error);
        else if (poller.json !== undefined) subscriber.onData(poller.json);

        // A poller that was idle (new, or kept alive by linger) reads right away
        if (!poller.reading && !poller.timer) this.poll(poller);

        const watched = poller;
        let active = true;
        return () => {
            if (!active) return;
            active = false;
            watched.subscribers.delete(subscriber);
            if (watched.subscribers.size === 0) this.startLinger(watched);
        };
    }

    /** Reads a source again now, for example right after a change was made upstream. */
    refresh(key: string): void {
        const poller = this.pollers.get(key);
        if (!poller || poller.subscribers.size === 0) return;

        if (poller.reading) {
            // The read in flight may have started before the change
            poller.refreshQueued = true;
            return;
        }

        this.poll(poller);
    }

    get pollerCount(): number {
        return this.pollers.size;
    }

    close(): void {
        for (const poller of this.pollers.values()) this.stop(poller);
    }

    private startLinger(poller: Poller): void {
        // Stop reading now, but keep the last value so a reconnect or a page
        // switch within the linger window does not hit the upstream again
        clearTimeout(poller.timer);
        poller.timer = undefined;
        poller.lingerTimer = setTimeout(() => this.stop(poller), this.lingerMs);
        poller.lingerTimer.unref();
    }

    private stop(poller: Poller): void {
        clearTimeout(poller.timer);
        clearTimeout(poller.lingerTimer);
        poller.timer = undefined;
        poller.lingerTimer = undefined;
        poller.abort?.abort();
        poller.subscribers.clear();
        if (this.isLive(poller)) this.pollers.delete(poller.source.key);
    }

    private poll(poller: Poller): void {
        clearTimeout(poller.timer);
        poller.timer = undefined;
        poller.reading = true;
        poller.refreshQueued = false;

        const abort = new AbortController();
        poller.abort = abort;

        // Settles even if the source ignores the abort signal or throws synchronously
        const read = new Promise<unknown>((resolve, reject) => {
            const timeout = setTimeout(() => {
                abort.abort();
                reject(new Error('Read timed out'));
            }, this.readTimeoutMs);
            timeout.unref();

            Promise.resolve()
                .then(() => poller.source.read(abort.signal))
                .then(resolve, reject)
                .finally(() => clearTimeout(timeout));
        });

        void read
            .then(
                data => this.onRead(poller, data),
                error => this.onFailure(poller, error)
            )
            .finally(() => {
                poller.reading = false;
                poller.abort = undefined;
                if (!this.isLive(poller) || poller.subscribers.size === 0) return;

                if (poller.refreshQueued) {
                    this.poll(poller);
                    return;
                }

                poller.timer = setTimeout(() => this.poll(poller), this.nextDelay(poller));
                poller.timer.unref();
            });
    }

    private isLive(poller: Poller): boolean {
        return this.pollers.get(poller.source.key) === poller;
    }

    private onRead(poller: Poller, data: unknown): void {
        if (!this.isLive(poller)) return;

        const json = JSON.stringify(data ?? null);
        const recovered = poller.error !== undefined;
        poller.failures = 0;
        poller.error = undefined;
        poller.data = data;

        // Unchanged data is not sent again
        if (json === poller.json && !recovered) return;

        poller.json = json;
        for (const subscriber of poller.subscribers) subscriber.onData(json);
    }

    private onFailure(poller: Poller, error: unknown): void {
        if (!this.isLive(poller)) return;

        poller.failures += 1;

        // Only messages written for users are passed on; the rest may name internal hosts
        const message = error instanceof RealtimeError ? error.message : GENERIC_ERROR;
        if (message === poller.error) return;

        if (!(error instanceof RealtimeError)) {
            console.error(`Stream ${poller.source.key} failed:`, (error as Error)?.message ?? error);
        }
        poller.error = message;
        for (const subscriber of poller.subscribers) subscriber.onError(message);
    }

    private nextDelay(poller: Poller): number {
        const { intervalMs } = poller.source;
        const base = typeof intervalMs === 'function' ? intervalMs(poller.data) : intervalMs;
        if (poller.failures === 0) return base;

        return Math.min(base * 2 ** Math.min(poller.failures, 6), Math.max(base, this.maxErrorBackoffMs));
    }
}
