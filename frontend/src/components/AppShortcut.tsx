import { Box, Grid2 as Grid, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';

import { styles } from '../theme/styles';
import { theme } from '../theme/theme';
import { getIconPath } from '../utils/utils';

type Props = {
    url: string;
    name: string;
    iconName: string;
}

export const AppShortcut = ({ url, name, iconName }: Props) => {
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(url);
                setIsOnline(response.ok);
            } catch (error) {
                setIsOnline(false);
            }
        };

        // Initial check
        checkStatus();

        // Poll every 15 seconds
        const timer = setInterval(checkStatus, 60000);

        return () => clearInterval(timer);
    }, [url]);

    // Determine dot color
    let dotColor = 'gray'; // unknown
    if (isOnline === true) {
        dotColor = 'green';
    } else if (isOnline === false) {
        dotColor = 'red';
    }
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
