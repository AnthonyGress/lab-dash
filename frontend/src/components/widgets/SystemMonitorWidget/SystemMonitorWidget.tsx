import { Box, Grid2 as Grid, IconButton, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';


import { DiskUsageBar } from './DiskUsageWidget';
import { GaugeWidget } from './GaugeWidget';
import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { convertBytesToGB, convertSecondsToUptime } from '../../../utils/utils';
import { CenteredModal } from '../../modals/CenteredModal';

export const SystemMonitorWidget = () => {
    const [systemInformation, setSystemInformation] = useState<any>();
    const [memoryInformation, setMemoryInformation] = useState<any>(0);
    const [diskInformation, setDiskInformation] = useState<any>();
    const [openSystemModal, setOpenSystemModal] = useState(false);

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
            const totalSpaceGB = (mainDisk.size / 1e9)?.toFixed(0); // Convert bytes to GB
            const usedSpaceGB = (mainDisk.used / 1e9)?.toFixed(0); // Convert bytes to GB

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
        <Grid container justifyContent={'space-evenly'} gap={0} sx={{ display: 'flex', width: '100%' }}>
            <div
                onPointerDownCapture={(e) => e.stopPropagation()} // Stop drag from interfering
                onClick={(e) => e.stopPropagation()} // Prevent drag from triggering on click
            >
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                    onClick={() => setOpenSystemModal(true)}
                >
                    <IoInformationCircleOutline style={{ color: theme.palette.text.primary, fontSize: '1.75rem' }}/>
                </IconButton>
            </div>
            <Grid>
                <GaugeWidget title='CPU' value={systemInformation?.cpu?.currentLoad ? Math.round(systemInformation?.cpu?.currentLoad) : 0} />
            </Grid>
            <Grid>
                <GaugeWidget title='TEMP' value={systemInformation?.cpu?.main ? Math.round(systemInformation?.cpu?.main) : 0} temperature/>
            </Grid>
            <Grid>
                <GaugeWidget title='RAM' value={memoryInformation} />
            </Grid>
            <DiskUsageBar totalSpace={diskInformation?.totalSpace ? diskInformation?.totalSpace : 0} usedSpace={diskInformation?.usedSpace ? diskInformation?.usedSpace : 0} usedPercentage={diskInformation?.usedPercentage ? diskInformation?.usedPercentage : 0}/>
            <CenteredModal open={openSystemModal} handleClose={() => setOpenSystemModal(false)} title='System Information' width={isMobile ? '90vw' :'30vw'} height='35vh'>
                <Box component={Paper} p={2} sx={{ backgroundColor: COLORS.GRAY }} elevation={0}>
                    <Typography>Processor: {systemInformation?.cpu?.physicalCores} Core {systemInformation?.cpu?.manufacturer} {systemInformation?.cpu?.brand}</Typography>
                    <Typography>Architecture: {systemInformation?.system?.arch} </Typography>
                    <Typography>Memory: {convertBytesToGB(systemInformation?.memory?.total)} </Typography>
                    <Typography>OS: {systemInformation?.system?.distro} {systemInformation?.system?.codename} {systemInformation?.system?.release}</Typography>
                    <Typography>Kernel: {systemInformation?.system?.kernel}</Typography>
                    <Typography>Uptime: {convertSecondsToUptime(systemInformation?.system?.uptime)}</Typography>
                    <Typography>Disk Mount: {diskInformation?.mount}</Typography>
                    <Typography>Disk Usage: {`${diskInformation?.usedPercentage.toFixed(0)}%`}</Typography>
                    <Typography>Disk Total: {`${diskInformation?.totalSpace}`}</Typography>
                </Box>
            </CenteredModal>
            {/* <DiskUsageBar totalSpace={1200} usedSpace={50} usedPercentage={50}/> */}
        </Grid>
    );
};
