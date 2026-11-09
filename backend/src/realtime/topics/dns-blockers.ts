import { createHash } from 'crypto';

import { adguard, DnsBlocker, DnsStats, piholeV5, piholeV6 } from '../../services/dns-blockers';
import { describeUpstreamError, readConnection, UpstreamConnection } from '../../services/upstream';
import { DashboardItem } from '../../types';
import { Principal, RealtimeError, resolveItem } from '../access';
import { MethodContext, Registry } from '../registry';

const DNS_WIDGET_TYPES = ['pihole-widget', 'adguard-widget'];

// While blocking is off, look often so the widget notices when it comes back
const DISABLED_INTERVAL_MS = 5000;
const ENABLED_INTERVAL_MS = 30_000;
const MAX_DISABLE_SECONDS = 7 * 24 * 60 * 60;

const pickBlocker = (item: DashboardItem): DnsBlocker => {
    if (item.type === 'adguard-widget') return adguard;
    // Pi-hole v6 logs in with a password, v5 with an API token
    return item.config?.password && !item.config?.apiToken ? piholeV6 : piholeV5;
};

type Target = { blocker: DnsBlocker; connection: UpstreamConnection; key: string };

const resolveTarget = (principal: Principal, itemId: string | undefined, mode: 'read' | 'write'): Target => {
    const item = resolveItem(principal, itemId, DNS_WIDGET_TYPES, mode);
    const blocker = pickBlocker(item);
    const connection = readConnection(item, blocker.defaultPort);
    const fingerprint = createHash('sha1')
        .update(JSON.stringify([blocker === piholeV6, connection]))
        .digest('hex')
        .slice(0, 16);

    return { blocker, connection, key: `dns.stats:${fingerprint}` };
};

const action = (
    run: (blocker: DnsBlocker, connection: UpstreamConnection, params: Record<string, unknown>) => Promise<void>
) => async ({ principal, itemId, params, hub }: MethodContext) => {
    const { blocker, connection, key } = resolveTarget(principal, itemId, 'write');

    try {
        await run(blocker, connection, (params && typeof params === 'object' ? params : {}) as Record<string, unknown>);
    } catch (error) {
        throw describeUpstreamError(blocker.name, error);
    }

    // Push the new state to every watcher now instead of at the next poll
    hub.refresh(key);
    return { success: true };
};

export const registerDnsBlockerTopics = (registry: Registry): void => {
    // Query statistics and whether blocking is on, for Pi-hole and AdGuard Home
    registry.topic('dns.stats', (principal, itemId) => {
        const { blocker, connection, key } = resolveTarget(principal, itemId, 'read');

        return {
            key,
            intervalMs: data => (
                (data as DnsStats | undefined)?.status === 'disabled' ? DISABLED_INTERVAL_MS : ENABLED_INTERVAL_MS
            ),
            read: async signal => {
                try {
                    return await blocker.stats(connection, signal);
                } catch (error) {
                    throw describeUpstreamError(blocker.name, error);
                }
            }
        };
    });

    registry
        .method('dns.disable', action((blocker, connection, { seconds }) => {
            if (seconds === undefined || seconds === null) return blocker.disable(connection);
            if (!Number.isInteger(seconds) || (seconds as number) < 1 || (seconds as number) > MAX_DISABLE_SECONDS) {
                throw new RealtimeError('BAD_REQUEST', 'seconds must be a whole number of seconds');
            }
            return blocker.disable(connection, seconds as number);
        }))
        .method('dns.enable', action((blocker, connection) => blocker.enable(connection)));
};
