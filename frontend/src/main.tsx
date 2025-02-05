import { ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './theme/index.css';
import App from './App.tsx';
import { theme } from './theme/theme.ts';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <App />
        </ThemeProvider>
    </StrictMode>,
);
