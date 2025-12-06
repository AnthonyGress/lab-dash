import { Box, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next'; // Import hook

import { useIsMobile } from '../../../../../hooks/useIsMobile';
import { theme } from '../../../../../theme/theme';

export interface DiskUsageBarProps {
  totalSpace: number; // Total disk space in GB
  usedSpace: number;  // Used disk space in GB
  usedPercentage: number;
}

// Helper function to format space dynamically (GB or TB)
const formatSpace = (space: number | string): string => {
    const numSpace = typeof space === 'string' ? parseFloat(space) : space;
    
    if (numSpace > 0) {
        return numSpace >= 1000 ? `${(numSpace / 1000)} TB` : `${numSpace} GB`;
    }

    return '0 GB';
};

export const DiskUsageBar: React.FC<DiskUsageBarProps> = ({ totalSpace, usedSpace, usedPercentage }) => {
    const { t } = useTranslation(); // Initialize hook
    
    // Ensure we work with numbers for calculations
    const total = typeof totalSpace === 'string' ? parseFloat(totalSpace) : totalSpace;
    const used = typeof usedSpace === 'string' ? parseFloat(usedSpace) : usedSpace;
    
    const freeSpace = total - used;
    const freePercentage = 100 - usedPercentage;
    const isMobile = useIsMobile();

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant='body1' gutterBottom sx={{ fontSize: { xs: 14, md: 15 } }}>
                        {t('widgets.system.diskUsage')}: {usedPercentage.toFixed(1)}%
                </Typography>
                <Typography variant='body1' gutterBottom sx={{ fontSize: { xs: 14, md: 15 } }}>
                    {formatSpace(usedSpace)} / {formatSpace(totalSpace)}
                </Typography>
            </Box>

            <Stack direction='row' sx={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                {/* Used Space Tooltip */}
                <Tooltip title={`${t('widgets.system.used')}: ${formatSpace(usedSpace)}`} arrow slotProps={{
                    tooltip: {
                        sx: {
                            fontSize: 14,
                        },
                    },
                }}>
                    <Box
                        sx={{
                            width: `${usedPercentage}%`,
                            backgroundColor: theme.palette.primary.main,
                            height: '100%',
                            cursor: 'pointer',
                        }}
                    />
                </Tooltip>

                {/* Free Space Tooltip */}
                <Tooltip title={`${t('widgets.system.free')}: ${formatSpace(freeSpace)}`} arrow slotProps={{
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