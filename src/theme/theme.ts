import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    typography: {
        button: {
            textTransform: 'none'
        }
    },
    palette: {
        primary: {
            main: '#010B24',
        },
        secondary: {
            main: '#242424',
            light: '#ffffff',
            contrastText: '#ffffff'
        },
        background: {
            default: '#ffffff',
            paper: '#ffffff'
        },
        text: {
            primary: '#000000',
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
