import { ThemeProvider } from '@mui/material';
import { CssBaseline } from '@mui/material';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';

import './i18n';

import { DashApi } from './api/dash-api.ts';
import { App } from './App.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx'; // Import isolated component
import { ToastInitializer } from './components/toast/ToastInitializer.tsx';
import { ToastProvider } from './components/toast/ToastManager.tsx';
import { AppContextProvider } from './context/AppContextProvider.tsx';
import { theme } from './theme/theme.ts';
import './theme/index.css';

DashApi.setupAxiosInterceptors();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <Router>
                <ToastProvider>
                    <AppContextProvider>
                        <ToastInitializer />
                        <CssBaseline />
                        {/* Suspense wrapper added for i18n support. 
                           Handles async loading of translation files and prevents rendering 
                           before resources are ready.
                        */}
                        <Suspense fallback={<LoadingScreen />}>
                            <App />
                        </Suspense>
                    </AppContextProvider>
                </ToastProvider>
            </Router>
        </ThemeProvider>
    </StrictMode>
);