import si, { Systeminformation } from 'systeminformation';

import { SysteminformationResponse } from '../types/system-information-response';

const HOUR_MS = 60 * 60 * 1000;

type CacheEntry = { expires: number; value: Promise<unknown> };
const cache = new Map<string, CacheEntry>();

/**
 * Reuses a reading until it is older than `ttlMs`. Hardware facts (CPU model, OS,
 * memory slots) do not change while the server runs, and collecting them spawns
 * child processes, so reading them again on every 5 second tick was wasted work.
 */
const cached = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;

    const entry: CacheEntry = { expires: Date.now() + ttlMs, value: load() };
    cache.set(key, entry);
    // A failed reading is retried on the next call instead of being remembered
    entry.value.catch(() => {
        if (cache.get(key) === entry) cache.delete(key);
    });

    return entry.value as Promise<T>;
};

/** Mounted filesystems and their usage. Changes slowly, so it is read at most every 30 seconds. */
export const getDiskInfo = (): Promise<Systeminformation.FsSizeData[]> => cached('fsSize', 30_000, () => si.fsSize());

// One collection serves every caller within the same second (several widgets, several tabs)
const collect = () => cached('snapshot', 1000, () => Promise.allSettled([
    cached('cpu', HOUR_MS, () => si.cpu()),
    si.cpuTemperature(),
    si.currentLoad(),
    cached('osInfo', HOUR_MS, () => si.osInfo()),
    Promise.resolve(si.time()), // synchronous
    getDiskInfo(),
    si.mem(),
    cached('memLayout', HOUR_MS, () => si.memLayout()),
    si.networkStats(),
    cached('networkInterfaces', 60_000, () => si.networkInterfaces())
]));

export const getSystemInfo = async (networkInterface?: string): Promise<SysteminformationResponse | null> => {
    try {
        const results = await collect();

        // extract values
        const cpuInfo = results[0].status === 'fulfilled' ? (results[0].value as Systeminformation.CpuData) : null;
        const cpuTemp = results[1].status === 'fulfilled' ? (results[1].value as Systeminformation.CpuTemperatureData) : null;
        const currentLoad = results[2].status === 'fulfilled' ? (results[2].value as Systeminformation.CurrentLoadData) : null;
        const os = results[3].status === 'fulfilled' ? (results[3].value as Systeminformation.OsData) : null;
        const uptime = results[4].status === 'fulfilled' ? (results[4].value as Systeminformation.TimeData) : null;
        const disk = results[5].status === 'fulfilled' ? (results[5].value as Systeminformation.FsSizeData[]) : null;
        const memoryInfo = results[6].status === 'fulfilled' ? (results[6].value as Systeminformation.MemData) : null;
        const memoryLayout = results[7].status === 'fulfilled' ? (results[7].value as Systeminformation.MemLayoutData[]) : null;
        const networkInfo = results[8].status === 'fulfilled' ? (results[8].value as Systeminformation.NetworkStatsData[]) : null;
        const networkInterfaces = results[9].status === 'fulfilled' ? (results[9].value as Systeminformation.NetworkInterfacesData[]) : null;

        // construct return objects
        const cpu = cpuInfo
            ? { ...cpuInfo, ...cpuTemp, currentLoad: currentLoad?.currentLoad || 0 }
            : null;
        const system = os ? { ...os, ...uptime } : null;
        const totalInstalled = memoryLayout && memoryLayout.length > 0
            ? memoryLayout.reduce((total, slot) => total + slot.size, 0) / (1024 ** 3)
            : 0;
        const memory = memoryLayout && memoryInfo && { ...memoryInfo, totalInstalled };

        // Get the primary network interface - look for active interfaces first
        let network = null;
        if (networkInfo && networkInfo.length > 0) {
            let selectedInterface;

            // If a specific interface was requested, use it
            if (networkInterface && networkInterfaces) {
                // Find the specified interface in network stats
                selectedInterface = networkInfo.find(iface =>
                    iface.iface === networkInterface
                );
            }

            // If no specific interface or it wasn't found, use the automatic selection logic
            if (!selectedInterface) {
                // First try to find a "real" interface with traffic (excluding loopback)
                const activeInterface = networkInfo.find(iface =>
                    iface.operstate === 'up' &&
                    (iface.rx_sec > 0 || iface.tx_sec > 0) &&
                    !iface.iface.includes('lo') &&
                    !iface.iface.includes('loop'));

                // If no active interface found, get the first non-loopback up interface
                const upInterface = !activeInterface
                    ? networkInfo.find(iface =>
                        iface.operstate === 'up' &&
                        !iface.iface.includes('lo') &&
                        !iface.iface.includes('loop'))
                    : null;

                // Use the best interface we found, or fall back to the first one as a last resort
                selectedInterface = activeInterface || upInterface || networkInfo[0];
            }

            // Find the corresponding interface in networkInterfaces to get speed
            let speed = 0;
            if (networkInterfaces && selectedInterface) {
                const matchingInterface = networkInterfaces.find(
                    ni => ni.iface === selectedInterface.iface
                );

                if (matchingInterface && typeof matchingInterface.speed === 'number' && matchingInterface.speed > 0) {
                    speed = matchingInterface.speed; // Speed in Mbps
                }
            }

            network = {
                rx_sec: selectedInterface.rx_sec || 0,
                tx_sec: selectedInterface.tx_sec || 0,
                iface: selectedInterface.iface || '',
                operstate: selectedInterface.operstate || '',
                speed
            };

        } else {
            console.log('No network interfaces found');
        }

        // Include all network interfaces in the response for the UI to display options
        const allNetworkInterfaces = networkInterfaces && networkInfo
            ? networkInfo
                .filter(iface =>
                    // Filter interfaces that have rx_sec and tx_sec values
                    iface.operstate === 'up' &&
                    !iface.iface.includes('lo') &&
                    !iface.iface.includes('loop') &&
                    typeof iface.rx_sec === 'number' &&
                    typeof iface.tx_sec === 'number' &&
                    iface.rx_sec > 0 &&
                    iface.tx_sec > 0
                )
                .map(iface => {
                    // Find the corresponding interface details from networkInterfaces
                    const matchingInterface = networkInterfaces.find(ni => ni.iface === iface.iface);

                    return {
                        iface: iface.iface,
                        operstate: iface.operstate,
                        speed: matchingInterface?.speed || 0,
                        rx_bytes: iface.rx_bytes || 0,
                        tx_bytes: iface.tx_bytes || 0,
                        rx_sec: iface.rx_sec || 0,
                        tx_sec: iface.tx_sec || 0
                    };
                })
            : [];

        return { cpu, system, memory, disk, network, networkInterfaces: allNetworkInterfaces };
    } catch (e) {
        console.error('Error fetching system info:', e);
        return null;
    }
};
