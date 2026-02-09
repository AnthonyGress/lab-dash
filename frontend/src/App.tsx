import './theme/App.css';
import { GlobalStyles } from '@mui/material';
import { Box, Paper } from '@mui/material';
import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';

import { SetupForm } from './components/forms/SetupForm';
import { GlobalCustomScrollbar } from './components/GlobalCustomScrollbar';
import { WithNav } from './components/navbar/WithNav';
import { ScrollToTop } from './components/ScrollToTop';
import { BACKEND_URL } from './constants/constants';
import { useAppContext } from './context/useAppContext';
import { useMobilePointer } from './hooks/useMobilePointer';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { styles } from './theme/styles';

const SetupPage = () => {
    const { isFirstTimeSetup, setSetupComplete } = useAppContext();

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
        pages
    } = useAppContext();

    const navigate = useNavigate();
    const isMobilePointer = useMobilePointer();

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

    // Global hotkey listener for Ctrl+1-9 / Cmd+1-9 to switch pages
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Ctrl+Number (Windows/Linux) or Cmd+Number (Mac)
            // Skip 0 to allow default browser behavior (zoom reset)
            if ((event.ctrlKey || event.metaKey) && (event.key >= '1' && event.key <= '9')) {
                event.preventDefault();
                event.stopPropagation(); // Prevent other listeners from interfering

                const keyNumber = parseInt(event.key, 10);

                if (keyNumber === 9) {
                    // Cmd+9 goes to Settings page
                    navigate('/settings');
                } else if (keyNumber === 1) {
                    // Cmd+1 always goes to Home page
                    navigate('/');
                } else {
                    // Cmd+2-8 goes to custom pages (pages[0], pages[1], etc.)
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
        ? (config.backgroundImage.startsWith('http://') || config.backgroundImage.startsWith('https://')
            ? `url('${config.backgroundImage}')`
            : `url('${BACKEND_URL}/uploads/${config.backgroundImage}')`)
        : 'url(\'/space4k-min.webp\')';

    const globalStyles = (
        <GlobalStyles
            styles={{
                'html': {
                    minHeight: '100vh',
                    width: '100vw',
                    position: 'relative',
                },
                'body': {
                    background: 'transparent',
                    margin: 0,
                    padding: 0,
                    minHeight: '100vh',
                    '@media (max-width: 768px)': {
                        overflowX: 'hidden',
                        maxWidth: '100vw',
                    },
                    '&.MuiModal-open': {
                        paddingRight: '0px !important',
                        overflow: 'hidden'
                    }
                },
                // Fixed background element that won't resize
                '#background-container': {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: '#0a0a0f',
                    backgroundImage: backgroundImage,
                    backgroundPosition: 'center center',
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'optimizeQuality',
                    zIndex: -1,
                    // Smooth transition when background changes
                    transition: 'background-image 0.3s ease-in-out',
                    // Ensure no resizing on mobile
                    '@media (max-width: 768px)': {
                        backgroundSize: 'cover !important',
                        backgroundPosition: 'center center !important',
                        // Force hardware acceleration for smoother performance
                        transform: 'translateZ(0)',
                        willChange: 'transform',
                        // Ensure crisp rendering on mobile
                        imageRendering: 'optimizeQuality',
                    }
                },
            }}
        />
    );

    return (
        <>
            {globalStyles}
            <div id='background-container' />
            <ScrollToTop />
            {!isMobilePointer && <GlobalCustomScrollbar />}
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
