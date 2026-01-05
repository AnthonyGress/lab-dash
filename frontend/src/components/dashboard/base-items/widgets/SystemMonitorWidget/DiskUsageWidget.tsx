import { Box, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

import { useIsMobile } from '../../../../../hooks/useIsMobile';
import { theme } from '../../../../../theme/theme';



export interface DiskUsageBarProps {
  totalSpace: number; // Total disk space in GB
  usedSpace: number;  // Used disk space in GB
  usedPercentage: number;
}

// Helper function to format space dynamically (GB or TB)
const formatSpace = (space: number): string => {
    if (space > 0) {
        return space >= 1000 ? `${(space / 1000)} TB` : `${space} GB`;
    }

    return '0 GB';
};

export const DiskUsageBar: React.FC<DiskUsageBarProps> = ({ totalSpace, usedSpace, usedPercentage }) => {
    const freeSpace = totalSpace - usedSpace;
    const freePercentage = 100 - usedPercentage;
    const isMobile = useIsMobile();
    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant='body1' gutterBottom sx={{ fontSize: { xs: 14, md: 15 } }}>
                        Disk Usage: {usedPercentage.toFixed(1)}%
                </Typography>
                <Typography variant='body1' gutterBottom sx={{ fontSize: { xs: 14, md: 15 } }}>
                    {formatSpace(usedSpace)} / {formatSpace(totalSpace)}
                </Typography>
            </Box>

            <Stack direction='row' sx={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                {/* Used Space Tooltip */}
                <Tooltip title={`Used: ${formatSpace(usedSpace)}`} arrow slotProps={{
                    tooltip: {
                        sx: {
                            fontSize: 14,
                        },
                    },
                }}>
                    <Box
                        sx={{
                            width: `${usedPercentage}%`,
                            backgroundColor: 'primary.main',
                            height: '100%',
                            cursor: 'pointer',
                        }}
                    />
                </Tooltip>

                {/* Free Space Tooltip */}
                <Tooltip title={`Free: ${formatSpace(freeSpace)}`} arrow slotProps={{
                    tooltip: {
                        sx: {
                            fontSize: 14,
                        },
                    },
                }}>
                    <Box
                        sx={{
                            width: `${freePercentage}%`,
                            backgroundColor: '#cfd8dc',
                            height: '100%',
                            cursor: 'pointer',
                        }}
                    />
                </Tooltip>
            </Stack>
        </Box>
    );
};
