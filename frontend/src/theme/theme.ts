import { createTheme } from '@mui/material/styles';

import { COLORS } from './styles';

// Get custom theme color from localStorage or use default
const getThemeColor = (): string => {
    try {
        const storedConfig = localStorage.getItem('dashConfig');
        if (storedConfig) {
            const config = JSON.parse(storedConfig);
            return config.themeColor || '#734CDE';
        }
    } catch (error) {
        console.error('Error reading theme color from localStorage:', error);
    }
    return '#734CDE'; // Default purple
};

const primaryColor = getThemeColor();

export const theme = createTheme({
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1180,
            xl: 1536,
        },
    },
    typography: {
        button: {
            textTransform: 'none'
        },
        caption: {
            color: COLORS.LIGHT_GRAY, // Change caption text color globally (e.g., orange)
        },
    },
    palette: {
        primary: {
            main: primaryColor,
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
        action: {
            // Make disabled items lighter
            disabledBackground: 'rgba(255, 255, 255, 0.12)',
            disabled: 'rgba(255, 255, 255, 0.5)'
        }
    },
    components: {
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`, // Custom hover color globally
                    },
                    '&.Mui-selected': {
                        backgroundColor: `${primaryColor} !important`,
                        color: 'white',
                    },
                    '&.Mui-selected:hover': {
                        backgroundColor: `${primaryColor} !important`,
                        color: 'white',
                    },
                },
            },
        },
        MuiAutocomplete: {
            styleOverrides: {
                paper: {
                    '& .MuiAutocomplete-noOptions': {
                        color: '#C9C9C9',
                    },
                },
                option: {
                    '&:hover': {
                        backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                    },
                    '&[aria-selected="true"]': {
                        backgroundColor: `${COLORS.PURPLE} !important`,
                        color: 'white',
                    },
                    '&[aria-selected="true"]:hover': {
                        backgroundColor: `${COLORS.PURPLE} !important`,
                        color: 'white',
                    },
                },
            },
        },
        MuiListItem: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: COLORS.LIGHT_GRAY_HOVER, // Change this to your preferred hover color
                    },
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: COLORS.LIGHT_GRAY,
                        },
                        '&:hover fieldset': { borderColor: COLORS.PURPLE },
                        '&.Mui-focused fieldset': { borderColor: COLORS.PURPLE },
                    },
                }
            },
            defaultProps: {
                slotProps: {
                    inputLabel: {
                        style: { color: 'inherit' },
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: COLORS.TRANSPARENT_DARK_GRAY,
                    backdropFilter: 'blur(6px)',
                },
            },
        },
        // Add styling for disabled buttons globally
        MuiButton: {
            styleOverrides: {
                root: {
                    '&.Mui-disabled': {
                        color: 'rgba(255, 255, 255, 0.5)',
                    }
                }
            }
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        '@media (hover: hover)': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)'
                        }
                    },
                    '&:active': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        transition: 'background-color 0.1s ease-out'
                    }
                }
            }
        },
        // Style check icons in StepLabel component
        MuiStepIcon: {
            styleOverrides: {
                root: {
                    '&.Mui-active': {
                        color: COLORS.PURPLE,
                    },
                    '&.Mui-completed': {
                        color: COLORS.PURPLE,
                    }
                },
                text: {
                    fill: '#ffffff', // White text for step icons
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                    },
                    '&.Mui-selected': {
                        backgroundColor: `${COLORS.PURPLE} !important`,
                        color: 'white',
                    },
                    '&.Mui-selected:hover': {
                        backgroundColor: `${COLORS.PURPLE} !important`,
                        color: 'white',
                    },
                },
            },
        }
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
