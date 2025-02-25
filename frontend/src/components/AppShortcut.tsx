import { Box, Grid2 as Grid, Typography, useMediaQuery } from '@mui/material';

import { styles } from '../theme/styles';
import { theme } from '../theme/theme';
import { getIconPath } from '../utils/utils';

type Props = {
    url: string;
    name: string;
    iconName: string;
    showLabel?: boolean;
    editMode?: boolean;
}

export const AppShortcut = ({ url, name, iconName, showLabel, editMode }: Props) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <>
            {
                editMode
                    ?
                    <Box sx={{ ...styles.center }} className='scale'>
                        <Box sx={{ width: { xs: '50%', sm: '40%', md: '55%', lg: '50%', xl: '35%' } }}>
                            <img
                                src={getIconPath(iconName)}
                                alt={name}
                                width='100%' // Ensure it scales within the Box
                                crossOrigin='anonymous'
                                draggable='false'
                            />
                        </Box>
                        {showLabel && <Box>
                            <Typography fontSize={isMobile ? '1rem' : '1.2rem'}>{name}</Typography>
                        </Box>}
                    </Box>
                    : <a href={url} rel='noopener noreferrer' target='_blank' style={{ width: '100%', height: '100%' }}>
                        <Box sx={{ ...styles.center }} className='scale'>
                            <Box sx={{ width: { xs: '50%', sm: '40%', md: '55%', lg: '50%', xl: '35%' } }}>
                                <img
                                    src={getIconPath(iconName)}
                                    alt={name}
                                    width='100%' // Ensure it scales within the Box
                                    crossOrigin='anonymous'
                                    draggable='false'
                                />
                            </Box>
                            {showLabel && <Box>
                                <Typography fontSize={isMobile ? '1rem' : '1.2rem'}>{name}</Typography>
                            </Box>}
                        </Box>
                    </a>
            }
        </>

    );
};
