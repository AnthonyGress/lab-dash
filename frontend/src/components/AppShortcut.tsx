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
        <Grid className='scale'>
            {
                editMode
                    ? <Box>
                        <Box sx={styles.shortcutIcon}>
                            <img src={getIconPath(iconName)} alt={name} width={isMobile ? '50%' : '65%'} crossOrigin='anonymous' draggable='false' />
                            {showLabel && <Box>
                                <Typography fontSize={isMobile ? '1rem' : '1.2rem'}>{name}</Typography>
                            </Box>}
                        </Box>
                    </Box>
                    : <a href={url} rel='noopener noreferrer' target='_blank'>
                        <Box>
                            <Box sx={styles.shortcutIcon}>
                                <img src={getIconPath(iconName)} alt={name} width={isMobile ? '50%' : '65%'} crossOrigin='anonymous' draggable='false' />
                                {showLabel && <Box>
                                    <Typography fontSize={isMobile ? '1rem' : '1.2rem'}>{name}</Typography>
                                </Box>}
                            </Box>
                        </Box>
                    </a>
            }
        </Grid>
    );
};
