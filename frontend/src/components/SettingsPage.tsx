import { Box, Paper } from '@mui/material';

import { SettingsForm } from './forms/SettingsForm';
import { styles } from '../theme/styles';

export const SettingsPage = () => {
    return (
        <Box width={'100%'} sx={styles.center}>
            <Box sx={{ ...styles.vcenter, width: '90%' }} component={Paper}>
                <SettingsForm />
            </Box>
        </Box>
    );
};
