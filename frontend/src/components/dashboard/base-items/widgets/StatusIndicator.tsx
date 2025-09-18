import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Box, Tooltip } from '@mui/material';
import React from 'react';

import { useServiceStatus } from '../../../../hooks/useServiceStatus';
import { isValidHttpUrl } from '../../../../utils/utils';

type StatusIndicatorProps = {
    url?: string;
    healthCheckType?: 'http' | 'ping';
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ url, healthCheckType = 'http' }) => {
    // For ping type, we don't need to validate the URL format
    const isPingType = healthCheckType === 'ping';
    const isValidUrl = isPingType || (url && isValidHttpUrl(url));

    const isOnline = useServiceStatus(isValidUrl ? url : null, healthCheckType);

    let dotColor = 'gray';
    let tooltipText = 'Unknown';

    if (isOnline === true) {
        dotColor = 'green';
        tooltipText = 'Online';
    } else if (isOnline === false) {
        dotColor = 'red';
        tooltipText = 'Offline';
    }

    if (!url || (!isPingType && !isValidHttpUrl(url))) return null;

    return (
        <Tooltip title={tooltipText} arrow placement='top' slotProps={{
            tooltip: {
                sx: {
                    fontSize: 14,
                },
            },
        }}>
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    // Force pixel-perfect centering
                    lineHeight: 0,
                    textAlign: 'center'
                }}
            >
                {dotColor === 'green' && (
                    <KeyboardArrowUpIcon sx={{
                        color: 'white',
                        fontSize: 14
                    }} />
                )}
                {dotColor === 'red' && (
                    <KeyboardArrowDownIcon sx={{
                        color: 'white',
                        fontSize: 14
                    }} />
                )}
            </Box>
        </Tooltip>
    );
};
