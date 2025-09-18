import { ThemeProvider } from '@mui/material';
import { CssBaseline } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';

import { DashApi } from './api/dash-api.ts';
import { App } from './App.tsx';
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
                        <App />
                    </AppContextProvider>
                </ToastProvider>
            </Router>
        </ThemeProvider>
    </StrictMode>
);
