import { Box, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

export interface DiskUsageBarProps {
  totalSpace: number; // Total disk space in GB
  usedSpace: number;  // Used disk space in GB
}

// Helper function to format space dynamically (GB or TB)
const formatSpace = (space: number): string => {
    return space >= 1000 ? `${(space / 1000).toFixed(2)} TB` : `${space.toFixed(2)} GB`;
};

export const DiskUsageBar: React.FC<DiskUsageBarProps> = ({ totalSpace, usedSpace }) => {
    const usedPercentage = (usedSpace / totalSpace) * 100;
    const freeSpace = totalSpace - usedSpace;
    const freePercentage = 100 - usedPercentage;

    return (
        <Box sx={{ width: '100%', padding: 2 }}>
            <Typography variant='body1' gutterBottom>
        Disk Usage: {formatSpace(usedSpace)} / {formatSpace(totalSpace)}
            </Typography>

            <Stack direction='row' sx={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                {/* Used Space Tooltip */}
                <Tooltip title={`Used: ${formatSpace(usedSpace)}`} arrow>
                    <Box
                        sx={{
                            width: `${usedPercentage}%`,
                            backgroundColor: usedPercentage > 80 ? '#d32f2f' : '#1976d2',
                            height: '100%',
                            cursor: 'pointer',
                        }}
                    />
                </Tooltip>

                {/* Free Space Tooltip */}
                <Tooltip title={`Free: ${formatSpace(freeSpace)}`} arrow>
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

            <Typography variant='body2' align='center' sx={{ mt: 1 }}>
                {usedPercentage.toFixed(1)}% Used
            </Typography>
        </Box>
    );
};
