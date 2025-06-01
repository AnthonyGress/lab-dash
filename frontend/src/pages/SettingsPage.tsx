import { Box, Paper, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { SettingsForm } from '../components/forms/SettingsForm';
import { useAppContext } from '../context/useAppContext';
import { styles } from '../theme/styles';

export const SettingsPage = () => {
    const { isLoggedIn, isAdmin } = useAppContext();
    const navigate = useNavigate();

    // Check if user is logged in and is an admin
    useEffect(() => {
        // If not logged in, redirect to login page
        if (!isLoggedIn) {
            navigate('/login');
            return;
        }

        // If not admin, redirect to dashboard
        if (!isAdmin) {
            navigate('/');
        }
    }, [isLoggedIn, isAdmin, navigate]);

    if (!isLoggedIn || !isAdmin) {
        return null; // Will redirect in useEffect
    }

    return (
        <Box width={'100%'} sx={styles.center}>
            <Box sx={{
                width: '95%',
                maxWidth: '1200px',
                minHeight: '600px',
                borderRadius: 2,
                mb: 4
            }} component={Paper}>
                <SettingsForm />
            </Box>
        </Box>
    );
};
