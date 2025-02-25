import { ThemeProvider } from '@mui/material';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { AppContextProvider } from './context/AppContextProvider.tsx';
import { theme } from './theme/theme.ts';
import './theme/index.css';


const globalStyles = (
    <GlobalStyles
        styles={{
            'html, body': {
                background: 'url(\'/space4k-min.webp\')',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                // backgroundAttachment: 'scroll',
                imageRendering: 'crispEdges',
            },
        }}
    />
);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <AppContextProvider>
                <CssBaseline />
                {globalStyles}
                <App />
            </AppContextProvider>
        </ThemeProvider>
    </StrictMode>,
);
