import { ThemeProvider } from '@mui/material';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { AppContextProvider } from './context/AppContextProvider';
import { theme } from './theme/theme';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <AppContextProvider>
                <App />
            </AppContextProvider>
        </ThemeProvider>
    </React.StrictMode>
);
