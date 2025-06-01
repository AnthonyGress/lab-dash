import { Alert, AlertColor, Button, Slide, SlideProps, Snackbar, useMediaQuery } from '@mui/material';
import React, { createContext, ReactNode, useContext, useState } from 'react';

import { theme } from '../../theme/theme';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: string;
    message: string;
    type: AlertColor;
    duration?: number;
    action?: ToastAction;
}

interface ToastContextType {
    showToast: (message: string, type: AlertColor, duration?: number, action?: ToastAction) => void;
    success: (message: string, duration?: number, action?: ToastAction) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
    return <Slide {...props} direction='down' />;
}

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const showToast = (message: string, type: AlertColor, duration: number = 3000, action?: ToastAction) => {
        const id = Date.now().toString();
        const newToast: Toast = { id, message, type, duration, action };

        setToasts(prev => [...prev, newToast]);

        // Auto remove toast after duration
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, duration);
    };

    const success = (message: string, duration?: number, action?: ToastAction) => {
        showToast(message, 'success', duration, action);
    };

    const error = (message: string, duration?: number) => {
        showToast(message, 'error', duration);
    };

    const info = (message: string, duration?: number) => {
        showToast(message, 'info', duration);
    };

    const handleClose = (toastId: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== toastId));
    };

    const contextValue: ToastContextType = {
        showToast,
        success,
        error,
        info
    };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            {toasts.map((toast, index) => (
                <Snackbar
                    key={toast.id}
                    open={true}
                    autoHideDuration={toast.duration}
                    onClose={() => handleClose(toast.id)}
                    TransitionComponent={SlideTransition}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    sx={{
                        top: `${68 + (index * 60)}px !important`, // Stack toasts vertically with moderate spacing
                        zIndex: theme.zIndex.snackbar + 1000, // Ensure it's above everything
                        width: isMobile ? '90vw' : '600px',
                        maxWidth: isMobile ? '90vw' : '600px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        '& .MuiSnackbarContent-root': {
                            width: '100%',
                            maxWidth: '100%'
                        }
                    }}
                >
                    <Alert
                        onClose={() => handleClose(toast.id)}
                        severity={toast.type}
                        variant='filled'
                        action={toast.action ? (
                            <Button
                                color='inherit'
                                size='small'
                                onClick={() => {
                                    toast.action!.onClick();
                                    handleClose(toast.id);
                                }}
                                sx={{
                                    color: 'white',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    fontSize: '0.85rem',
                                    padding: '6px 12px',
                                    minWidth: 'auto',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                        borderColor: 'rgba(255, 255, 255, 0.5)'
                                    }
                                }}
                            >
                                {toast.action.label}
                            </Button>
                        ) : undefined}
                        sx={{
                            width: '100%',
                            maxWidth: '100%',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            boxShadow: theme.shadows[6],
                            opacity: 1,
                            alignItems: 'center',
                            '& .MuiAlert-icon': {
                                fontSize: '1.2rem',
                                alignItems: 'center',
                                display: 'flex'
                            },
                            '& .MuiAlert-action': {
                                paddingTop: 0,
                                alignItems: 'center',
                                '& .MuiIconButton-root': {
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }
                            },
                            // Custom muted colors
                            '&.MuiAlert-filledSuccess': {
                                backgroundColor: 'rgba(62, 139, 64, 1)', // Muted green
                                color: '#ffffff'
                            },
                            '&.MuiAlert-filledError': {
                                backgroundColor: 'rgba(213, 57, 45, 1)', // Muted red
                                color: '#ffffff'
                            },
                            '&.MuiAlert-filledInfo': {
                                backgroundColor: 'rgba(32, 137, 222, 1)', // Muted blue
                                color: '#ffffff'
                            }
                        }}
                    >
                        {toast.message}
                    </Alert>
                </Snackbar>
            ))}
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Static class for global access (similar to PopupManager)
export class ToastManager {
    private static instance: ToastContextType | null = null;

    public static setInstance(instance: ToastContextType) {
        ToastManager.instance = instance;
    }

    public static success(message: string, duration?: number, action?: ToastAction): void {
        if (ToastManager.instance) {
            ToastManager.instance.success(message, duration, action);
        } else {
            console.warn('ToastManager not initialized. Make sure ToastProvider is wrapped around your app.');
        }
    }

    public static error(message: string, duration?: number): void {
        if (ToastManager.instance) {
            ToastManager.instance.error(message, duration);
        } else {
            console.warn('ToastManager not initialized. Make sure ToastProvider is wrapped around your app.');
        }
    }

    public static info(message: string, duration?: number): void {
        if (ToastManager.instance) {
            ToastManager.instance.info(message, duration);
        } else {
            console.warn('ToastManager not initialized. Make sure ToastProvider is wrapped around your app.');
        }
    }
}
