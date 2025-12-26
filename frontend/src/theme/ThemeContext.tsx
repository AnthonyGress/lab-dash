import { createTheme, ThemeProvider } from '@mui/material/styles';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { COLORS } from './styles';

interface ThemeContextType {
    themeColor: string;
    setThemeColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

// Function to create theme with a specific primary color
const createAppTheme = (primaryColor: string) => {
    return createTheme({
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
                color: COLORS.LIGHT_GRAY,
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
                disabledBackground: 'rgba(255, 255, 255, 0.12)',
                disabled: 'rgba(255, 255, 255, 0.5)'
            }
        },
        components: {
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        '&:hover': {
                            backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
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
                            backgroundColor: `${primaryColor} !important`,
                            color: 'white',
                        },
                        '&[aria-selected="true"]:hover': {
                            backgroundColor: `${primaryColor} !important`,
                            color: 'white',
                        },
                    },
                },
            },
            MuiListItem: {
                styleOverrides: {
                    root: {
                        '&:hover': {
                            backgroundColor: COLORS.LIGHT_GRAY_HOVER,
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
                            '&:hover fieldset': { borderColor: primaryColor },
                            '&.Mui-focused fieldset': { borderColor: primaryColor },
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
            MuiStepIcon: {
                styleOverrides: {
                    root: {
                        '&.Mui-active': {
                            color: primaryColor,
                        },
                        '&.Mui-completed': {
                            color: primaryColor,
                        }
                    },
                    text: {
                        fill: '#ffffff',
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
                            backgroundColor: `${primaryColor} !important`,
                            color: 'white',
                        },
                        '&.Mui-selected:hover': {
                            backgroundColor: `${primaryColor} !important`,
                            color: 'white',
                        },
                    },
                },
            }
        },
    });
};

export const ThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themeColor, setThemeColorState] = useState<string>(getThemeColor());

    const theme = useMemo(() => createAppTheme(themeColor), [themeColor]);

    const setThemeColor = (color: string) => {
        setThemeColorState(color);
        // Update localStorage immediately so the color persists
        try {
            localStorage.setItem('dashConfig', JSON.stringify({ themeColor: color }));
        } catch (error) {
            console.error('Error saving theme color to localStorage:', error);
        }
    };

    return (
        <ThemeContext.Provider value={{ themeColor, setThemeColor }}>
            <ThemeProvider theme={theme}>
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    );
};

export const useThemeColor = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeColor must be used within ThemeContextProvider');
    }
    return context;
};
