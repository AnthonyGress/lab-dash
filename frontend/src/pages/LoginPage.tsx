import { Box, Paper } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashApi } from '../api/dash-api';
import { LoginForm } from '../components/forms/LoginForm';
import { SetupForm } from '../components/forms/SetupForm';
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
