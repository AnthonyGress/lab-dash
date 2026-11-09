import { Server } from 'http';

import { GatewayOptions, RealtimeGateway } from './gateway';
import { Registry } from './registry';
import { registerArrTopics } from './topics/arr';
import { registerDnsBlockerTopics } from './topics/dns-blockers';
import { registerDownloadClientTopics } from './topics/download-clients';
import { registerHealthTopics } from './topics/health';
import { registerSystemTopics } from './topics/system';

/** Every live topic and action the dashboard offers. New integrations are added here. */
export const createRegistry = (): Registry => {
    const registry = new Registry();
    registerSystemTopics(registry);
    registerHealthTopics(registry);
    registerDownloadClientTopics(registry);
    registerDnsBlockerTopics(registry);
    registerArrTopics(registry);
    return registry;
};

/** Serves the realtime WebSocket on the same port as the HTTP server. */
export const attachRealtime = (
    server: Server,
    options: Partial<GatewayOptions> = {}
): RealtimeGateway => new RealtimeGateway(server, { registry: createRegistry(), ...options });
