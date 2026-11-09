import { checkHealth, HealthCheckType, INTERNET_CHECK_HOST } from '../../services/health';
import { RealtimeError, resolveItem } from '../access';
import { Registry } from '../registry';

const TWO_MINUTES_MS = 2 * 60 * 1000;

const isHttpUrl = (value: string): boolean => {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
        return false;
    }
};

export const registerHealthTopics = (registry: Registry): void => {
    // The online/offline dot on a shortcut. The target comes from the saved item,
    // never from the client, so this cannot be used to probe arbitrary hosts.
    registry.topic('service.health', (principal, itemId) => {
        // Group children keep these fields on the item itself
        const item = resolveItem(principal, itemId, 'any') as Record<string, any>;
        const target = item.config?.healthUrl || item.healthUrl || item.url;
        const type: HealthCheckType = (item.config?.healthCheckType || item.healthCheckType) === 'ping' ? 'ping' : 'http';

        if (typeof target !== 'string' || !target || (type === 'http' && !isHttpUrl(target))) {
            throw new RealtimeError('BAD_REQUEST', 'Item has no valid health check target');
        }

        return {
            // Shortcuts that point at the same service share one check
            key: `service.health:${type}:${target}`,
            intervalMs: TWO_MINUTES_MS,
            read: async signal => ({ status: await checkHealth(target, type, signal) })
        };
    });

    // Whether the server itself can reach the internet. Open to everyone, like the page it is shown on.
    registry.topic('internet.status', () => ({
        key: 'internet.status',
        intervalMs: TWO_MINUTES_MS,
        read: async () => ({ status: await checkHealth(INTERNET_CHECK_HOST, 'ping') })
    }));
};
