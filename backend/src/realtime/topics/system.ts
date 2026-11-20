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

                // Sent every 5 seconds: only what the widget shows (the full report
                // carries the CPU flag list, cache sizes and more)
                const { cpu, system, memory, disk, network } = info;
                return {
                    cpu: cpu && {
                        currentLoad: cpu.currentLoad,
                        main: cpu.main,
                        brand: cpu.brand,
                        manufacturer: cpu.manufacturer,
                        physicalCores: cpu.physicalCores
                    },
                    system: system && {
                        arch: system.arch,
                        codename: system.codename,
                        distro: system.distro,
                        kernel: system.kernel,
                        release: system.release,
                        uptime: system.uptime
                    },
                    memory: memory && {
                        active: memory.active,
                        total: memory.total,
                        totalInstalled: (memory as typeof memory & { totalInstalled?: number }).totalInstalled
                    },
                    disk: disk?.map(entry => ({
                        fs: entry.fs,
                        type: entry.type,
                        size: entry.size,
                        used: entry.used,
                        available: entry.available,
                        use: entry.use,
                        mount: entry.mount
                    })),
                    network
                };
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
