import { getDiskInfo, getSystemInfo } from '../../system-monitor';
import { RealtimeError, resolveItem } from '../access';
import { Registry } from '../registry';

const SYSTEM_WIDGET_TYPES = ['system-monitor-widget', 'disk-monitor-widget'];

export const registerSystemTopics = (registry: Registry): void => {
    // CPU, memory, temperature and network throughput of the host
    registry.topic('system.metrics', (principal, itemId) => {
        const item = resolveItem(principal, itemId, SYSTEM_WIDGET_TYPES);
        const configured = item.config?.networkInterface;
        const networkInterface = typeof configured === 'string' && configured ? configured : undefined;

        return {
            key: `system.metrics:${networkInterface ?? 'auto'}`,
            intervalMs: 5000,
            read: async () => {
                const info = await getSystemInfo(networkInterface);
                if (!info) throw new RealtimeError('UNAVAILABLE', 'Error fetching system info');
                return info;
            }
        };
    });

    // Disk usage changes slowly and is only resent when it does
    registry.topic('system.disks', (principal, itemId) => {
        resolveItem(principal, itemId, SYSTEM_WIDGET_TYPES);

        return {
            key: 'system.disks',
            intervalMs: 30_000,
            read: () => getDiskInfo()
        };
    });
};
