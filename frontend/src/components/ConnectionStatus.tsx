import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, Snackbar, Stack } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';

import { useAppContext } from '../context/useAppContext';
import { COLORS } from '../theme/styles';

export const ConnectionStatus: React.FC = () => {
    const { connectionHealthy, reconnectToBackend } = useAppContext();
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const prevConnectionState = useRef(connectionHealthy);

    // Show success toast when connection changes from unhealthy to healthy
    useEffect(() => {
        // If connection was previously unhealthy and is now healthy, show success toast
        if (!prevConnectionState.current && connectionHealthy) {
            setShowSuccess(true);
            // Auto-hide the success toast after 3 seconds
            setTimeout(() => setShowSuccess(false), 3000);
        }

        // Update previous connection state
        prevConnectionState.current = connectionHealthy;
    }, [connectionHealthy]);

    const handleReconnect = async () => {
        setIsReconnecting(true);
        try {
            await reconnectToBackend();
            // No need to set showSuccess here as the useEffect will catch the connectionHealthy change
        } finally {
            setIsReconnecting(false);
        }
    };

    return (
        <>
            {/* Connection lost snackbar with reconnect button */}
            <Snackbar
                open={!connectionHealthy}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                sx={{
                    mt: 1,
                    '& .MuiSnackbarContent-root': {
                        backgroundColor: COLORS.TRANSPARENT_GRAY,
                        minWidth: 'auto'
                    },
                    '& .MuiSnackbarContent-message': {
                        color: 'text.primary'
                    }
                }}
                message={
                    <Stack direction='row' spacing={1} alignItems='center'>
                        <ErrorOutlineIcon fontSize='small' sx={{ color: 'text.primary' }} />
                        <span>Connection to server lost</span>
                    </Stack>
                }
                action={
                    <Button
                        size='small'
                        color='inherit'
                        startIcon={<RefreshIcon sx={{ color: 'text.primary' }} />}
                        onClick={handleReconnect}
                        disabled={isReconnecting}
                        sx={{ ml: 2, color: 'text.primary' }}
                    >
                        {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
                    </Button>
                }
            />

            {/* Success toast notification */}
            <Snackbar
                open={showSuccess}
                autoHideDuration={3000}
                onClose={() => setShowSuccess(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                sx={{
                    mt: !connectionHealthy ? 8 : 1,  // Position below the error snackbar if it's visible
                    '& .MuiSnackbarContent-root': {
                        backgroundColor: COLORS.TRANSPARENT_GRAY,
                        minWidth: 'auto'
                    },
                    '& .MuiSnackbarContent-message': {
                        color: 'text.primary'
                    }
                }}
                message={
                    <Stack direction='row' spacing={1} alignItems='center'>
                        <CheckCircleOutlineIcon fontSize='small' sx={{ color: 'text.primary' }} />
                        <span>Connection restored</span>
                    </Stack>
                }
            />
        </>
    );
};
