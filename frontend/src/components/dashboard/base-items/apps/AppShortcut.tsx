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
        if (!name) return isMobile ? '.9rem' : '1rem';

        // Adjust font size based on text length
        if (name.length > 20) return isMobile ? '0.6rem' : '0.7rem';
        if (name.length > 15) return isMobile ? '0.7rem' : '0.8rem';
        if (name.length > 10) return isMobile ? '0.8rem' : '0.9rem';

        return isMobile ? '.9rem' : '1rem';
    }, [name, isMobile]);

    // Content to render inside the shortcut component
    const shortcutContent = (
        <Box sx={{
            width: '100%',
            ...styles.vcenter,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
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
                mt: -.5

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
                            width: '80%',
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
