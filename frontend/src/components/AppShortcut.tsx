import { Box, Grid2 as Grid, Typography } from '@mui/material';
import { useState } from 'react';

import { DashApi } from '../api/dash-api';
import { styles } from '../theme/styles';
import { getIconPath } from '../utils/utils';

type Props = {
    url: string;
    name: string;
    iconName: string;
}

export const AppShortcut = ({ url, name, iconName }: Props) => {
    const [icon, setIcon] = useState('');

    const getIcon = async () => {
        const iconRes = await DashApi.getIcon(iconName);
        console.log(iconRes);

        setIcon(iconRes);
    };

    getIcon();


    return (
        <Grid className='scale'>
            <a href={url} rel='noopener noreferrer' target='_blank'>
                <Box>
                    <Box sx={styles.shortcutIcon}>
                        <img src={getIconPath(iconName)} alt={name} width={'65%'}/>
                        <Box>
                            <Typography fontSize={'1.2rem'}>{name}</Typography>
                        </Box>
                    </Box>
                </Box>
            </a>
        </Grid>
    );
};
