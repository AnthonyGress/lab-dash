import { Alert, AlertColor, Slide, SlideProps, Snackbar } from '@mui/material';
import React, { createContext, ReactNode, useContext, useState } from 'react';

import { theme } from '../../theme/theme';

interface Toast {
    id: string;
    message: string;
    type: AlertColor;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type: AlertColor, duration?: number) => void;
    success: (message: string, duration?: number) => void;
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

    const showToast = (message: string, type: AlertColor, duration: number = 3000) => {
        const id = Date.now().toString();
        const newToast: Toast = { id, message, type, duration };

        setToasts(prev => [...prev, newToast]);

        // Auto remove toast after duration
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, duration);
    };

    const success = (message: string, duration?: number) => {
        showToast(message, 'success', duration);
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
                        top: `${80 + (index * 60)}px !important`, // Stack toasts vertically with moderate spacing
                        zIndex: theme.zIndex.snackbar + 1000, // Ensure it's above everything
                    }}
                >
                    <Alert
                        onClose={() => handleClose(toast.id)}
                        severity={toast.type}
                        variant='filled'
                        sx={{
                            minWidth: '300px',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            boxShadow: theme.shadows[6],
                            opacity: 0.9,
                            '& .MuiAlert-icon': {
                                fontSize: '1.2rem'
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
                                backgroundColor: 'rgba(62, 139, 64, 0.8)', // Muted green
                                color: '#ffffff'
                            },
                            '&.MuiAlert-filledError': {
                                backgroundColor: 'rgba(213, 57, 45, 0.8)', // Muted red
                                color: '#ffffff'
                            },
                            '&.MuiAlert-filledInfo': {
                                backgroundColor: 'rgba(32, 137, 222, 0.8)', // Muted blue
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

    public static success(message: string, duration?: number): void {
        if (ToastManager.instance) {
            ToastManager.instance.success(message, duration);
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
