import { Box, Grid2 as Grid, Typography, useMediaQuery } from '@mui/material';

import { styles } from '../theme/styles';
import { theme } from '../theme/theme';
import { getIconPath } from '../utils/utils';

type Props = {
    url: string;
    name: string;
    iconName: string;
}

export const AppShortcut = ({ url, name, iconName }: Props) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Grid className='scale'>
            <a href={url} rel='noopener noreferrer' target='_blank'>
                <Box>
                    <Box sx={styles.shortcutIcon}>
                        <img src={getIconPath(iconName)} alt={name} width={isMobile ? '50%' : '65%'} crossOrigin='anonymous'/>
                        <Box>
                            <Typography fontSize={isMobile ? '1rem' : '1.2rem'}>{name}</Typography>
                        </Box>
                    </Box>
                </Box>
            </a>
        </Grid>
    );
};
