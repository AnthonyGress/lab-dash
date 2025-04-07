import { Box, Grid2 as Grid, Typography, useMediaQuery } from '@mui/material';
import { useMemo } from 'react';

import { styles } from '../../../../theme/styles';
import { theme } from '../../../../theme/theme';
import { getIconPath } from '../../../../utils/utils';

type Props = {
    url: string;
    name: string;
    iconName: string;
    showLabel?: boolean;
    editMode?: boolean;
}

export const AppShortcut = ({ url, name, iconName, showLabel, editMode }: Props) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Calculate font size based on name length
    const fontSize = useMemo(() => {
        if (!name) return isMobile ? '1rem' : '1.2rem';

        // Adjust font size based on text length
        if (name.length > 20) return isMobile ? '0.7rem' : '0.8rem';
        if (name.length > 15) return isMobile ? '0.8rem' : '0.9rem';
        if (name.length > 10) return isMobile ? '0.9rem' : '1rem';

        return isMobile ? '1rem' : '1.2rem';
    }, [name, isMobile]);

    // Content to render inside the shortcut component
    const shortcutContent = (
        <Box sx={{
            width: { xs: '45%', sm: showLabel ? '25%' : '30%', md: '45%', lg: '40%', xl: '30%' },
            ...styles.vcenter,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <img
                    src={getIconPath(iconName)}
                    alt={name}
                    style={{ maxWidth: '90%', maxHeight: '100%', objectFit: 'contain' }}
                    crossOrigin='anonymous'
                    draggable='false'
                />
            </Box>

            <Box sx={{
                height: showLabel ? (isMobile ? '2.2rem' : '2.5rem') : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                visibility: showLabel ? 'visible' : 'hidden'
            }}>
                {showLabel && (
                    <Typography
                        align='center'
                        fontSize={fontSize}
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                            maxWidth: '100%',
                            lineHeight: 1.2
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
