import './theme/App.css';
import { GlobalStyles } from '@mui/material';
import { Box, Paper } from '@mui/material';
import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';

import { DashApi } from './api/dash-api';
import { SetupForm } from './components/forms/SetupForm';
import { WithNav } from './components/navbar/WithNav';
import { ScrollToTop } from './components/ScrollToTop';
import { BACKEND_URL } from './constants/constants';
import { AppContextProvider } from './context/AppContextProvider';
import { useAppContext } from './context/useAppContext';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { styles } from './theme/styles';
import { theme } from './theme/theme';

const SetupPage = () => {
    const { isFirstTimeSetup, setupComplete, setSetupComplete, checkLoginStatus } = useAppContext();

    // Show loading state while checking
    if (isFirstTimeSetup === null) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                {/* Loading state */}
            </Box>
        );
    }

    return (
        <Box width={'100%'} sx={{ ...styles.center, height: '100vh' }}>
            <Box sx={{ ...styles.vcenter, width: '90%', borderRadius: 2 }} component={Paper}>
                <SetupForm onSuccess={() => setSetupComplete(true)} />
            </Box>
        </Box>
    );
};

export const App = () => {
    const {
        config,
        isFirstTimeSetup,
        setupComplete,
        setSetupComplete,
        refreshDashboard,
        checkLoginStatus,
        isLoggedIn,
        pages
    } = useAppContext();
    
    const navigate = useNavigate();

    // Check if setup is complete based on the config
    useEffect(() => {
        // If configuration has been loaded and isSetupComplete is true
        if (config && config.isSetupComplete) {
            setSetupComplete(true);
        }
    }, [config, setSetupComplete]);

    // Set the document title based on the custom title in config
    useEffect(() => {
        if (config?.title) {
            document.title = config.title;
        } else {
            document.title = 'Lab Dash';
        }
    }, [config?.title]);

    // Global hotkey listener for Ctrl+0-9 / Cmd+0-9 to switch pages
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Ctrl+Number (Windows/Linux) or Cmd+Number (Mac)
            if ((event.ctrlKey || event.metaKey) && (event.key >= '0' && event.key <= '9')) {
                event.preventDefault();
                event.stopPropagation(); // Prevent other listeners from interfering
                
                const keyNumber = parseInt(event.key, 10);
                
                if (keyNumber === 0) {
                    // Cmd+0 goes to Settings page
                    navigate('/settings');
                } else if (keyNumber === 1) {
                    // Cmd+1 always goes to Home page
                    navigate('/');
                } else {
                    // Cmd+2+ goes to custom pages (pages[0], pages[1], etc.)
                    const pageIndex = keyNumber - 2;
                    
                    if (pages && pages.length > pageIndex) {
                        const targetPage = pages[pageIndex];
                        // Convert page name to URL-friendly format: lowercase, spaces to hyphens
                        const pageSlug = targetPage.name.toLowerCase().replace(/\s+/g, '-');
                        navigate(`/${pageSlug}`);
                    }
                }
            }
        };

        // Add event listener to document with capture to handle it early
        document.addEventListener('keydown', handleKeyDown, true);

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [pages, navigate]);

    const backgroundImage = config?.backgroundImage
        ? `url('${BACKEND_URL}/uploads/${config?.backgroundImage}')`
        : 'url(\'/space4k-min.webp\')';

    const globalStyles = (
        <GlobalStyles
            styles={{
                'body': {
                    background: backgroundImage,
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    // backgroundAttachment: 'scroll',
                    imageRendering: 'crispEdges',
                    '&.MuiModal-open': {
                        paddingRight: '0px !important',
                        overflow: 'hidden'
                    }
                },
            }}
        />
    );

    return (
        <>
            {globalStyles}
            <ScrollToTop />
            <Routes>
                <Route element={<WithNav />}>
                    <Route path='/' element={isFirstTimeSetup && !setupComplete ? <SetupPage /> : <DashboardPage />}/>
                    <Route path='/:pageName' element={isFirstTimeSetup && !setupComplete ? <SetupPage /> : <DashboardPage />}/>
                    <Route path='/settings' element={<SettingsPage />}/>
                    <Route path='/login' element={<LoginPage />}/>
                    <Route path='/signup' element={<LoginPage />}/>
                </Route>
            </Routes>
        </>
    );
};
