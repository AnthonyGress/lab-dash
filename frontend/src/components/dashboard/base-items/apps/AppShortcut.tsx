import { Box, Grid2 as Grid, Typography, useMediaQuery } from '@mui/material';
import { useCallback, useMemo } from 'react';

import { DashApi } from '../../../../api/dash-api';
import { styles } from '../../../../theme/styles';
import { theme } from '../../../../theme/theme';
import { getIconPath } from '../../../../utils/utils';
import { PopupManager } from '../../../modals/PopupManager';

type Props = {
    url?: string;
    name: string;
    iconName: string;
    showLabel?: boolean;
    editMode?: boolean;
    config?: any;
    isPreview?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export const AppShortcut = ({ url, name, iconName, showLabel, editMode, config, isPreview, size = 'medium' }: Props) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isWolShortcut = config?.isWol === true;

    // Calculate font size based on name length
    const fontSize = useMemo(() => {
        if (!name) return isMobile ? '0.8rem' : '0.9rem';

        // Adjust font size based on text length - reduced all sizes to prevent overlap with status indicator
        if (name.length > 20) return isMobile ? '0.55rem' : '0.65rem';
        if (name.length > 15) return isMobile ? '0.65rem' : '0.75rem';
        if (name.length > 10) return isMobile ? '0.75rem' : '0.85rem';

        return isMobile ? '0.8rem' : '0.9rem';
    }, [name, isMobile]);

    // Calculate text width based on size prop to prevent overlap with status icons
    const textWidth = useMemo(() => {
        if (size === 'small') {
            return '70%'; // Narrower for 4x2 layout to prevent overlap
        }
        return '80%'; // Default width for other layouts
    }, [size]);

    const handleWakeOnLan = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();

        if (!isWolShortcut || !config?.macAddress) {
            PopupManager.failure('Invalid Wake-on-LAN configuration');
            return;
        }

        try {
            // Prepare payload
            const payload: any = { mac: config.macAddress };
            if (config.broadcastAddress) payload.ip = config.broadcastAddress;
            if (config.port) payload.port = parseInt(config.port, 10);

            // Send WOL request
            await DashApi.sendWakeOnLan(payload);

            // Show success message
            PopupManager.success(`Wake-on-LAN packet sent to ${config.macAddress}`);
        } catch (error) {
            console.error('Error sending Wake-on-LAN packet:', error);
            PopupManager.failure('Failed to send Wake-on-LAN packet');
        }
    }, [config, isWolShortcut]);

    const shortcutContent = (
        <Box sx={{
            width: '100%',
            ...styles.vcenter,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative'
        }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Fixed height for icon container based on device
                height: { xs: '60px', sm: '70px', md: '40px', lg: '50px', xl: '60px' },
                width: '100%',
                padding: '10px',
                marginTop: showLabel ? '5px' : '0',
                position: 'relative',
                mt: isMobile ? -1.5 : 0

            }}>
                <Box
                    sx={{
                        width: { xs: '45px', sm: '50px', md: '45px', lg: '50px', xl: '55px' },
                        height: { xs: '45px', sm: '50px', md: '45px', lg: '50px', xl: '55px' },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}
                >
                    <img
                        src={getIconPath(iconName)}
                        alt={name}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            position: 'absolute'
                        }}
                        crossOrigin='anonymous'
                        draggable='false'
                    />
                </Box>
            </Box>

            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                visibility: showLabel ? 'visible' : 'hidden',
                px: 1
            }}>
                {showLabel && (
                    <Typography
                        align='center'
                        fontSize={fontSize}
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                            width: textWidth,
                            lineHeight: 1.2,
                            mt: 1
                        }}
                    >
                        {name}
                    </Typography>
                )}
            </Box>
        </Box>
    );

    return (
        <>
            {editMode ? (
                <Box sx={{ ...styles.center, width: '100%', height: '100%' }} className='scale'>
                    {shortcutContent}
                </Box>
            ) : isPreview ? (
                <Box sx={{ ...styles.center, width: '100%', height: '100%' }} className='scale'>
                    {shortcutContent}
                </Box>
            ) : isWolShortcut ? (
                <a href='#' onClick={handleWakeOnLan} style={{ width: '100%', height: '100%' }}>
                    <Box sx={{ ...styles.center }} className='scale'>
                        {shortcutContent}
                    </Box>
                </a>
            ) : !url && config?.healthUrl ? (
                <Box sx={{ ...styles.center, width: '100%', height: '100%' }} className='scale'>
                    {shortcutContent}
                </Box>
            ) : (
                <a href={url} rel='noopener noreferrer' target='_blank' style={{ width: '100%', height: '100%' }}>
                    <Box sx={{ ...styles.center }} className='scale'>
                        {shortcutContent}
                    </Box>
                </a>
            )}
        </>
    );
};
