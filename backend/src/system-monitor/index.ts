import si, { Systeminformation } from 'systeminformation';

import { SysteminformationResponse } from '../types/system-information-response';

export const getSystemInfo = async (): Promise<SysteminformationResponse | null> => {
    try {
        const results = await Promise.allSettled([
            si.cpu(),
            si.cpuTemperature(),
            si.currentLoad(),
            si.osInfo(),
            Promise.resolve(si.time()), // synchronous
            si.fsSize(),
            si.mem(),
            si.memLayout(),
            si.networkStats(),
            si.networkInterfaces()
        ]);

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
            const bestInterface = activeInterface || upInterface || networkInfo[0];

            // Find the corresponding interface in networkInterfaces to get speed
            let speed = 0;
            if (networkInterfaces && bestInterface) {
                const matchingInterface = networkInterfaces.find(
                    ni => ni.iface === bestInterface.iface
                );

                if (matchingInterface && typeof matchingInterface.speed === 'number' && matchingInterface.speed > 0) {
                    speed = matchingInterface.speed; // Speed in Mbps
                }
            }

            network = {
                rx_sec: bestInterface.rx_sec || 0,
                tx_sec: bestInterface.tx_sec || 0,
                iface: bestInterface.iface || '',
                operstate: bestInterface.operstate || '',
                speed
            };

        } else {
            console.log('No network interfaces found');
        }

        return { cpu, system, memory, disk, network };
    } catch (e) {
        console.error('Error fetching system info:', e);
        return null;
    }
};
