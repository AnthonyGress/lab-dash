import { ThemeProvider } from '@mui/material';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DashApi } from './api/dash-api.ts';
import { App } from './App.tsx';
import { AppContextProvider } from './context/AppContextProvider.tsx';
import { theme } from './theme/theme.ts';
import './theme/index.css';

DashApi.setupAxiosInterceptors();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <AppContextProvider>
                <CssBaseline />
                <App />
            </AppContextProvider>
        </ThemeProvider>
    </StrictMode>,
);
