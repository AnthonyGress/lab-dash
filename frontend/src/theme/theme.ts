import { createTheme } from '@mui/material/styles';

import { COLORS } from './styles';

export const theme = createTheme({
    typography: {
        button: {
            textTransform: 'none'
        }
    },
    palette: {
        primary: {
            main: '#734CDE',
        },
        secondary: {
            main: '#242424',
            light: '#ffffff',
            contrastText: '#ffffff'
        },
        background: {
            default: '#242424',
            paper: '#242424'
        },
        text: {
            primary: '#C9C9C9',
            secondary: '#000000',
        },
        success: {
            main: '#4caf50',
            contrastText: '#ffffff',
        },
        warning: {
            main: '#ff9800',
            contrastText: '#ffffff',
        },
        error: {
            main: '#C6112E',
            contrastText: '#ffffff',
        },
    },
    components: {
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: COLORS.GRAY, // Custom hover color globally
                    },
                },
            },
        },
    },
});

export const styles = {
    center: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    vcenter : {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    }
};
