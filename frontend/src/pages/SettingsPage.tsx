import { Box, Paper } from '@mui/material';

import { SettingsForm } from '../components/forms/SettingsForm';
import { styles } from '../theme/styles';

export const SettingsPage = () => {
    return (
        <Box width={'100%'} sx={styles.center}>
            <Box sx={{
                width: '95%',
                maxWidth: '1200px',
                minHeight: '600px',
                borderRadius: 2
            }} component={Paper}>
                <SettingsForm />
            </Box>
        </Box>
    );
};
