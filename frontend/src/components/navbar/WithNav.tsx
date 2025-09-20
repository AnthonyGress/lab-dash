import { Box } from '@mui/material';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ResponsiveAppBar } from './ResponsiveAppBar';
import { useAppContext } from '../../context/useAppContext';

export const WithNav = () => {
    const { isLoggedIn, isAdmin } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();

    // Protect settings route - only accessible to logged in admin users
    useEffect(() => {
        if (location.pathname === '/settings' && (!isLoggedIn || !isAdmin)) {
            navigate('/');
        }
    }, [location.pathname, isLoggedIn, isAdmin, navigate]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <ResponsiveAppBar>
                <Outlet />
            </ResponsiveAppBar>
        </Box>
    );
};
