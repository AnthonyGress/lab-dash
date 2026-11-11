import { IncomingMessage, Server } from 'http';
import { Duplex } from 'stream';
import WebSocket, { RawData, WebSocketServer } from 'ws';

import { ConfigChange, onConfigChanged } from '../services/config-store';
import { verifyAccessToken } from '../services/users';
import { Principal, RealtimeError } from './access';
import { PollerHub } from './hub';
import { Registry } from './registry';

export const REALTIME_PATH = '/api/ws';

// Close code telling the client its login ended: refresh the session, then reconnect
export const SESSION_ENDED = 4401;

export const DEFAULT_LIMITS = {
    maxPayloadBytes: 256 * 1024,
    maxMessagesPerFrame: 600,
    // Sized for large dashboards: every status dot is one subscription
    maxSubscriptions: 500,
    // One socket per open tab, and dashboards are often a browser start page
    maxConnectionsPerAddress: 50,
    maxBufferedBytes: 8 * 1024 * 1024,
    callBurst: 20,
    callsPerSecond: 5,
    heartbeatMs: 30_000,
    sessionWarningMs: 60_000
};

export type GatewayOptions = {
    registry: Registry;
    hub?: PollerHub;
    limits?: Partial<typeof DEFAULT_LIMITS>;
};

type Subscription = {
    topic: string;
    itemId?: string;
    /** Key of the source being polled; undefined while the subscription cannot be served */
    sourceKey?: string;
    stop?: () => void;
};

type Connection = {
    socket: WebSocket;
    principal: Principal;
    token?: string;
    address: string;
    subscriptions: Map<string, Subscription>;
    alive: boolean;
    callTokens: number;
    callTokensAt: number;
    timers: NodeJS.Timeout[];
};

const gateways = new Set<RealtimeGateway>();

/** Drops every socket that was opened with this access token, e.g. when its owner logs out. */
export const endSession = (accessToken: string | undefined): void => {
    if (!accessToken) return;
    for (const gateway of gateways) gateway.endSession(accessToken);
};

const readCookie = (header: string | undefined, name: string): string | undefined => {
    for (const part of (header ?? '').split(';')) {
        const separator = part.indexOf('=');
        if (separator > 0 && part.slice(0, separator).trim() === name) {
            return decodeURIComponent(part.slice(separator + 1).trim());
        }
    }
    return undefined;
};

const readAccessToken = (request: IncomingMessage): string | undefined => {
    try {
        return readCookie(request.headers.cookie, 'access_token') ?? request.headers.authorization?.split(' ')[1];
    } catch {
        return undefined;
    }
};

const hostnameOf = (host: string | undefined): string | undefined => {
    try {
        return host ? new URL(`http://${host.split(',')[0].trim()}`).hostname : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Browsers do not apply CORS to WebSockets, so another site could open one with
 * the visitor's cookies. Only pages served from this dashboard's own hostname may
 * connect. Scheme and port are ignored on purpose: behind a TLS-terminating proxy
 * the server sees plain HTTP on another port, and the dev frontend runs on its own.
 */
export const isAllowedOrigin = (request: IncomingMessage): boolean => {
    const { origin } = request.headers;
    // Only browsers send Origin, and only browsers carry someone else's cookies
    if (!origin) return true;

    let originUrl: URL;
    try {
        originUrl = new URL(origin);
    } catch {
        return false;
    }

    const configured = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(entry => entry.trim());
    if (configured.includes(originUrl.origin)) return true;

    const forwardedHost = request.headers['x-forwarded-host'];
    return [request.headers.host, Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost]
        .some(host => hostnameOf(host) === originUrl.hostname);
};

const clientAddress = (request: IncomingMessage): string => {
    // Matches Express `trust proxy: 1`: the last entry was added by our own proxy
    const forwarded = request.headers['x-forwarded-for'];
    const lastHop = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',').pop()?.trim();
    return lastHop || request.socket.remoteAddress || 'unknown';
};

const reject = (socket: Duplex, status: number, reason: string): void => {
    socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
};

const describeError = (error: unknown): { code: string; message: string } => {
    if (error instanceof RealtimeError) return { code: error.code, message: error.message };
    console.error('Realtime request failed:', error);
    return { code: 'UNAVAILABLE', message: 'Request failed' };
};

/**
 * One WebSocket per browser tab carries every live widget on the dashboard.
 *
 * Frames are JSON; a client may send an array to batch.
 *   client: { t: 'sub' | 'unsub', topic, itemId? }
 *           { t: 'call', id, method, itemId?, params? }
 *   server: { t: 'data', topic, itemId?, data }
 *           { t: 'err', topic, itemId?, message }
 *           { t: 'res', id, ok, result | code + message }
 *           { t: 'event', name, origin? }
 */
export class RealtimeGateway {
    readonly hub: PollerHub;
    private readonly registry: Registry;
    private readonly limits: typeof DEFAULT_LIMITS;
    private readonly connections = new Set<Connection>();
    private readonly connectionsPerAddress = new Map<string, number>();
    private readonly webSocketServer: WebSocketServer;
    private readonly heartbeat: NodeJS.Timeout;
    private readonly stopWatchingConfig: () => void;

    constructor(private readonly server: Server, options: GatewayOptions) {
        this.registry = options.registry;
        this.hub = options.hub ?? new PollerHub();
        this.limits = { ...DEFAULT_LIMITS, ...options.limits };
        this.webSocketServer = new WebSocketServer({ noServer: true, maxPayload: this.limits.maxPayloadBytes });

        this.server.on('upgrade', this.onUpgrade);
        this.stopWatchingConfig = onConfigChanged(this.onConfigChanged);
        this.heartbeat = setInterval(this.checkConnections, this.limits.heartbeatMs);
        this.heartbeat.unref();
        gateways.add(this);
    }

    get connectionCount(): number {
        return this.connections.size;
    }

    endSession(accessToken: string): void {
        for (const connection of this.connections) {
            if (connection.token === accessToken) connection.socket.close(SESSION_ENDED, 'Logged out');
        }
    }

    close(): void {
        gateways.delete(this);
        clearInterval(this.heartbeat);
        this.stopWatchingConfig();
        this.server.off('upgrade', this.onUpgrade);
        for (const connection of this.connections) connection.socket.terminate();
        this.webSocketServer.close();
        this.hub.close();
    }

    private readonly onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== REALTIME_PATH) {
            reject(socket, 404, 'Not Found');
            return;
        }
        if (!isAllowedOrigin(request)) {
            reject(socket, 403, 'Forbidden');
            return;
        }

        const address = clientAddress(request);
        if ((this.connectionsPerAddress.get(address) ?? 0) >= this.limits.maxConnectionsPerAddress) {
            reject(socket, 429, 'Too Many Requests');
            return;
        }

        // An invalid or expired token connects as a guest, like any HTTP request would
        const token = readAccessToken(request);
        const user = verifyAccessToken(token);

        this.webSocketServer.handleUpgrade(request, socket, head, webSocket => {
            this.accept(webSocket, address, user ? token : undefined, user);
        });
    };

    private accept(
        socket: WebSocket,
        address: string,
        token: string | undefined,
        user: ReturnType<typeof verifyAccessToken>
    ): void {
        const connection: Connection = {
            socket,
            principal: user ? { username: user.username, role: user.role } : undefined,
            token,
            address,
            subscriptions: new Map(),
            alive: true,
            callTokens: this.limits.callBurst,
            callTokensAt: Date.now(),
            timers: []
        };

        this.connections.add(connection);
        this.connectionsPerAddress.set(address, (this.connectionsPerAddress.get(address) ?? 0) + 1);

        socket.on('pong', () => {
            connection.alive = true;
        });
        socket.on('message', (data, isBinary) => this.onMessage(connection, data, isBinary));
        socket.on('error', () => socket.terminate());
        socket.on('close', () => this.release(connection));

        if (typeof user?.exp === 'number') this.scheduleSessionEnd(connection, user.exp * 1000);
    }

    private scheduleSessionEnd(connection: Connection, expiresAt: number): void {
        // setTimeout cannot wait longer than about 24 days
        const wait = (ms: number): number => Math.min(Math.max(ms, 0), 2 ** 31 - 1);
        const remaining = expiresAt - Date.now();

        const warning = setTimeout(
            () => this.send(connection, { t: 'event', name: 'session.expiring' }),
            wait(remaining - this.limits.sessionWarningMs)
        );
        const end = setTimeout(
            () => connection.socket.close(SESSION_ENDED, 'Session expired'),
            wait(remaining)
        );
        warning.unref();
        end.unref();
        connection.timers.push(warning, end);
    }

    private release(connection: Connection): void {
        if (!this.connections.delete(connection)) return;

        for (const timer of connection.timers) clearTimeout(timer);
        for (const subscription of connection.subscriptions.values()) subscription.stop?.();
        connection.subscriptions.clear();

        const remaining = (this.connectionsPerAddress.get(connection.address) ?? 1) - 1;
        if (remaining > 0) this.connectionsPerAddress.set(connection.address, remaining);
        else this.connectionsPerAddress.delete(connection.address);
    }

    private readonly checkConnections = (): void => {
        for (const connection of this.connections) {
            if (!connection.alive) {
                connection.socket.terminate();
                continue;
            }
            connection.alive = false;
            connection.socket.ping();
        }
    };

    private readonly onConfigChanged = (change: ConfigChange): void => {
        const name = change.scope === 'notes' ? 'notes.changed' : 'config.changed';

        for (const connection of this.connections) {
            this.send(connection, { t: 'event', name, origin: change.origin });
            if (change.scope !== 'config') continue;

            // An item may have been re-pointed, hidden, removed, or just been saved.
            // Subscriptions whose source is unchanged keep their poller untouched.
            for (const subscription of connection.subscriptions.values()) this.attach(connection, subscription);
        }
    };

    private onMessage(connection: Connection, data: RawData, isBinary: boolean): void {
        if (isBinary) {
            connection.socket.close(1003, 'Text frames only');
            return;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(data.toString());
        } catch {
            connection.socket.close(1007, 'Invalid JSON');
            return;
        }

        const messages = Array.isArray(parsed) ? parsed : [parsed];
        if (messages.length > this.limits.maxMessagesPerFrame) {
            connection.socket.close(1008, 'Too many messages in one frame');
            return;
        }

        for (const message of messages) {
            if (message && typeof message === 'object') this.handle(connection, message as Record<string, unknown>);
        }
    }

    private handle(connection: Connection, message: Record<string, unknown>): void {
        const { t, topic } = message;
        const itemId = message.itemId === undefined || message.itemId === null ? undefined : message.itemId;
        if (itemId !== undefined && (typeof itemId !== 'string' || itemId.length > 200)) return;

        if (t === 'call') {
            void this.handleCall(connection, message, itemId);
            return;
        }

        if ((t !== 'sub' && t !== 'unsub') || typeof topic !== 'string' || topic.length > 100) return;

        const key = `${topic}|${itemId ?? ''}`;
        const existing = connection.subscriptions.get(key);

        if (t === 'unsub') {
            existing?.stop?.();
            connection.subscriptions.delete(key);
            return;
        }

        if (existing) {
            // Asking again retries a subscription that could not be served
            if (!existing.stop) this.attach(connection, existing);
            return;
        }

        if (connection.subscriptions.size >= this.limits.maxSubscriptions) {
            this.send(connection, { t: 'err', topic, itemId, message: 'Too many live widgets on one page' });
            return;
        }

        const subscription: Subscription = { topic, itemId };
        connection.subscriptions.set(key, subscription);
        this.attach(connection, subscription);
    }

    /** Points a subscription at its current source, doing nothing if that has not changed. */
    private attach(connection: Connection, subscription: Subscription): void {
        const { topic, itemId } = subscription;

        try {
            const source = this.registry.resolveTopic(topic, connection.principal, itemId);
            if (subscription.stop && source.key === subscription.sourceKey) return;

            subscription.stop?.();
            subscription.sourceKey = source.key;
            subscription.stop = this.hub.subscribe(source, {
                onData: json => this.sendRaw(
                    connection,
                    `{"t":"data","topic":${JSON.stringify(topic)}` +
                    `${itemId === undefined ? '' : `,"itemId":${JSON.stringify(itemId)}`},"data":${json}}`
                ),
                onError: message => this.send(connection, { t: 'err', topic, itemId, message })
            });
        } catch (error) {
            // Kept in the map without a source: it is retried when the config changes
            subscription.stop?.();
            subscription.stop = undefined;
            subscription.sourceKey = undefined;
            this.send(connection, { t: 'err', topic, itemId, message: describeError(error).message });
        }
    }

    private async handleCall(
        connection: Connection,
        message: Record<string, unknown>,
        itemId: string | undefined
    ): Promise<void> {
        const { id, method, params } = message;
        if (typeof id !== 'string' && typeof id !== 'number') return;

        try {
            if (!this.takeCallToken(connection)) {
                throw new RealtimeError('RATE_LIMITED', 'Too many requests, slow down');
            }

            const result = await this.registry.call(method, {
                principal: connection.principal,
                itemId,
                params,
                hub: this.hub
            });
            this.send(connection, { t: 'res', id, ok: true, result: result ?? null });
        } catch (error) {
            this.send(connection, { t: 'res', id, ok: false, ...describeError(error) });
        }
    }

    private takeCallToken(connection: Connection): boolean {
        const now = Date.now();
        const refill = ((now - connection.callTokensAt) / 1000) * this.limits.callsPerSecond;
        connection.callTokens = Math.min(this.limits.callBurst, connection.callTokens + refill);
        connection.callTokensAt = now;

        if (connection.callTokens < 1) return false;
        connection.callTokens -= 1;
        return true;
    }

    private send(connection: Connection, message: Record<string, unknown>): void {
        this.sendRaw(connection, JSON.stringify(message));
    }

    private sendRaw(connection: Connection, frame: string): void {
        const { socket } = connection;
        if (socket.readyState !== WebSocket.OPEN) return;

        // A client that stopped reading must not grow the server's memory without bound
        if (socket.bufferedAmount > this.limits.maxBufferedBytes) {
            socket.terminate();
            return;
        }

        socket.send(frame);
    }
}
