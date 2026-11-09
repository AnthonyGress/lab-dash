import { Principal, RealtimeError } from './access';
import { PollerHub, StreamSource } from './hub';

/**
 * Turns a subscription into the source to poll. Must call `resolveItem` (or decide
 * explicitly that the topic is open to everyone) and throw a RealtimeError otherwise.
 */
export type TopicHandler = (principal: Principal, itemId: string | undefined) => StreamSource;

export type MethodContext = {
    principal: Principal;
    itemId: string | undefined;
    params: unknown;
    hub: PollerHub;
};

/** A one-off action or query. Same access rules as topics apply. */
export type MethodHandler = (context: MethodContext) => Promise<unknown> | unknown;

export class Registry {
    private readonly topics = new Map<string, TopicHandler>();
    private readonly methods = new Map<string, MethodHandler>();

    topic(name: string, handler: TopicHandler): this {
        if (this.topics.has(name)) throw new Error(`Topic already registered: ${name}`);
        this.topics.set(name, handler);
        return this;
    }

    method(name: string, handler: MethodHandler): this {
        if (this.methods.has(name)) throw new Error(`Method already registered: ${name}`);
        this.methods.set(name, handler);
        return this;
    }

    resolveTopic(name: unknown, principal: Principal, itemId: string | undefined): StreamSource {
        const handler = typeof name === 'string' ? this.topics.get(name) : undefined;
        if (!handler) throw new RealtimeError('NOT_FOUND', 'Unknown topic');
        return handler(principal, itemId);
    }

    async call(name: unknown, context: MethodContext): Promise<unknown> {
        const handler = typeof name === 'string' ? this.methods.get(name) : undefined;
        if (!handler) throw new RealtimeError('NOT_FOUND', 'Unknown method');
        return await handler(context);
    }
}
