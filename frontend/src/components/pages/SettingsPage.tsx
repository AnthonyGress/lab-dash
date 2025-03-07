import { Box, Paper } from '@mui/material';

import { styles } from '../../theme/styles';
import { SettingsForm } from '../forms/SettingsForm';

export const SettingsPage = () => {
    return (
        <Box width={'100%'} sx={styles.center}>
            <Box sx={{ ...styles.vcenter, width: '90%', borderRadius: 2 }} component={Paper}>
                <SettingsForm />
            </Box>
        </Box>
    );
};
