import si, { Systeminformation } from 'systeminformation';

export const getSystemInfo = async () => {
    try {
        const results = await Promise.allSettled([
            si.cpu(),
            si.cpuTemperature(),
            si.currentLoad(),
            si.osInfo(),
            Promise.resolve(si.time()), // synchronous
            si.fsSize(),
            si.mem(),
        ]);

        // extract values
        const cpuInfo = results[0].status === 'fulfilled' ? (results[0].value as Systeminformation.CpuData) : null;
        const cpuTemp = results[1].status === 'fulfilled' ? (results[1].value as Systeminformation.CpuTemperatureData) : null;
        const currentLoad = results[2].status === 'fulfilled' ? (results[2].value as Systeminformation.CurrentLoadData) : null;
        const os = results[3].status === 'fulfilled' ? (results[3].value as Systeminformation.OsData) : null;
        const uptime = results[4].status === 'fulfilled' ? (results[4].value as Systeminformation.TimeData) : null;
        const disk = results[5].status === 'fulfilled' ? (results[5].value as Systeminformation.FsSizeData[]) : null;
        const memory = results[6].status === 'fulfilled' ? (results[6].value as Systeminformation.MemData) : null;

        // construct return objects
        const cpu = cpuInfo
            ? { ...cpuInfo, ...cpuTemp, currentLoad: currentLoad?.currentLoad || 0 }
            : null;
        const system = os ? { ...os, ...uptime } : null;

        return { cpu, system, memory, disk };
    } catch (e) {
        console.error('Error fetching system info:', e);
        return null;
    }
};
