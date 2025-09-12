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
                    bottom: 5,
                    right: 5,
                    width: 16, // Changed to even number
                    height: 16, // Changed to even number
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Force pixel-perfect centering
                    lineHeight: 0,
                    textAlign: 'center'
                }}
            >
                {dotColor === 'green' && (
                    <KeyboardArrowUpIcon sx={{
                        color: 'white',
                        fontSize: 16,
                        position: 'absolute',
                        top: 8, // Exactly half of 16px container
                        left: 8, // Exactly half of 16px container
                        transform: 'translate(-8px, -8px)', // Exactly half of 16px icon
                        margin: 0,
                        padding: 0,
                        lineHeight: 0
                    }} />
                )}
                {dotColor === 'red' && (
                    <KeyboardArrowDownIcon sx={{
                        color: 'white',
                        fontSize: 16,
                        position: 'absolute',
                        top: 8, // Exactly half of 16px container
                        left: 8, // Exactly half of 16px container
                        transform: 'translate(-8px, -8px)', // Exactly half of 16px icon
                        margin: 0,
                        padding: 0,
                        lineHeight: 0
                    }} />
                )}
            </Box>
        </Tooltip>
    );
};
