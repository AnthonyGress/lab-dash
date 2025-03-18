import { Box, Paper } from '@mui/material';

import { LoginForm } from '../components/forms/LoginForm';
import { styles } from '../theme/styles';

export const LoginPage = () => {

    return (
        <Box width={'100%'} sx={styles.center}>
            <Box sx={{ ...styles.vcenter, width: '90%', borderRadius: 2 }} component={Paper}>
                <LoginForm />
            </Box>
        </Box>
    );
};
