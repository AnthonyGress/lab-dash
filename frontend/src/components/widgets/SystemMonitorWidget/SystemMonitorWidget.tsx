import { Box, Grid2 as Grid } from '@mui/material';
import { StatusCodes } from 'http-status-codes';
import { useEffect, useState } from 'react';

import { DiskUsageBar } from './DiskUsageWidget';
import { GaugeWidget } from './GaugeWidget';
import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';

export const SystemMonitorWidget = () => {
    const [systemInformation, setSystemInformation] = useState<any>();
    const [memoryInformation, setMemoryInformation] = useState<any>(0);
    const [diskInformation, setDiskInformation] = useState<any>();
    const isMobile = useIsMobile();

    // Helper function to format space dynamically (GB or TB)
    const formatSpace = (space: number): string => {
        return space >= 1000 ? `${(space / 1000).toFixed(2)} TB` : `${space.toFixed(2)} GB`;
    };

    const getRamPercentage = (systemData: any) => {
        let totalPercentage = 0;
        if (systemData?.memory?.total && systemData?.memory?.used) {
            totalPercentage = Math.round((systemData.memory.used / systemData.memory.total) * 100);
        }
        setMemoryInformation(totalPercentage);
    };

    const getSystemInfo = async () => {
        const res = await DashApi.getSystemInformation();
        console.log(res);

        setSystemInformation(res);
        getRamPercentage(res);
        getMainDiskInfo(res);
    };

    const getMainDiskInfo = async (systemData: any) => {
        try {
            const disks = systemData.disk;

            if (!disks.length) {
                throw new Error('No disks found');
            }
            // Filter out network shares or unwanted mounts (e.g., "//network-share")
            const validDisks = disks.filter((disk: { fs: string; }) => !disk.fs.startsWith('//'));

            if (!validDisks.length) {
                throw new Error('No valid disks found');
            }

            // Find the main disk (largest storage space)
            const systemVolumeDisk = validDisks.find((disk: { mount: string; }) => disk.mount === '/System/Volumes/Data');

            // If found, use it. Otherwise, pick the largest disk.
            const mainDisk = systemVolumeDisk ?? validDisks.reduce((prev: { size: number; }, current: { size: number; }) =>
                current.size > prev.size ? current : prev
            );

            console.log(mainDisk);

            // Get total and used space in GB
            const totalSpaceGB = (mainDisk.size / 1e9)?.toFixed(2); // Convert bytes to GB
            const usedSpaceGB = (mainDisk.used / 1e9)?.toFixed(2); // Convert bytes to GB

            console.log(`Main Disk: ${mainDisk.mount} | Total: ${totalSpaceGB} GB | Used: ${usedSpaceGB} GB`);

            setDiskInformation({
                mount: mainDisk.mount,
                totalSpace: totalSpaceGB,
                usedSpace: usedSpaceGB,
                usedPercentage: mainDisk.use
            });

            return {
                mount: mainDisk.mount,
                totalSpace: totalSpaceGB,
                usedSpace: usedSpaceGB,
            };
        } catch (error) {
            console.error('Error getting disk info:', error);
            return null;
        }
    };

    useEffect(() => {
        getSystemInfo();

        // fetch system info every 15 seconds
        const interval = setInterval(() => {
            getSystemInfo();
        }, 10000); // 15000 ms = 15 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <Grid container justifyContent={'center'} gap={2} sx={{ display: 'flex', width: '100%', flexDirection: isMobile ? 'column' : 'row' }}>
            <Grid>
                <GaugeWidget title='CPU' value={systemInformation?.cpu?.currentLoad ? Math.round(systemInformation?.cpu?.currentLoad) : 0} size={135}/>
            </Grid>
            <Grid>
                <GaugeWidget title='TEMP' value={systemInformation?.cpu?.main ? Math.round(systemInformation?.cpu?.main) : 0} size={135} temperature/>
            </Grid>
            <Grid>
                <GaugeWidget title='RAM' value={memoryInformation} size={135}/>
            </Grid>
            <DiskUsageBar totalSpace={diskInformation?.totalSpace ? diskInformation?.totalSpace : 0} usedSpace={diskInformation?.usedSpace ? diskInformation?.usedSpace : 0} usedPercentage={diskInformation?.usedPercentage ? diskInformation?.usedPercentage : 0}/>
            {/* <DiskUsageBar totalSpace={1200} usedSpace={50} usedPercentage={50}/> */}
        </Grid>
    );
};
