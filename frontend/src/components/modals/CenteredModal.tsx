import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Box, Modal, Toolbar, Tooltip, Typography, useMediaQuery } from '@mui/material';
import zIndex from '@mui/material/styles/zIndex';
import console from 'console';
import { ReactNode, useEffect } from 'react';

import { useWindowDimensions } from '../../hooks/useWindowDimensions';
import { styles } from '../../theme/styles';
import { theme } from '../../theme/theme';

type Props = {
    open: boolean;
    handleClose: () => void;
    title?: string;
    children: ReactNode;
    width?: string
    height?: string
}

export const CenteredModal = ({ open, handleClose, children, width, height, title }: Props) => {
    const windowDimensions = useWindowDimensions();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));


    const setWidth = () => {
        if (width) {
            return width;
        }

        if (windowDimensions.width <= 800) {
            return '92vw';
        }

        return '40vw';
    };

    const style = {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: setWidth(),
        bgcolor: 'background.paper',
        borderRadius: '8px',
        boxShadow: 24,
        overflow: 'hidden'
    };

    useEffect(() => {
        const preventScroll = (e: TouchEvent) => e.preventDefault();

        if (open) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';

            // Disable touch scroll for mobile
            document.addEventListener('touchmove', preventScroll, { passive: false });
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';

            document.removeEventListener('touchmove', preventScroll);
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';

            document.removeEventListener('touchmove', preventScroll);
        };
    }, [open]);

    return (
        <Modal open={open} aria-labelledby='modal' disableEnforceFocus disableAutoFocus>
            <Box sx={style}>
                {/* AppBar with Title and Close Button */}
                <AppBar position='static' sx={{ height: '3rem', borderRadius: '8px 8px 0 0' }} elevation={0}>
                    <Toolbar  sx={{
                        display: 'flex',
                        justifyContent: 'space-between', // Ensures space between title & close button
                        alignItems: 'center', // Vertically aligns everything
                        height: '100%',
                        px: 2, // Add padding for spacing
                        mt: isMobile ? '-.2rem' : '-.5rem'
                    }}>
                        <Typography sx={{ flexGrow: 1 }}>{title}</Typography>
                        <Box
                            onPointerDownCapture={(e) => e.stopPropagation()} // Stop drag from interfering
                            onClick={(e) => e.stopPropagation()} // Prevent drag from triggering on click
                            sx={styles.vcenter}
                        >
                            <Tooltip title='Close' placement='top'>
                                <Box height={'100%'} sx={styles.vcenter}>
                                    <CloseIcon sx={{ fontSize: 28, cursor: 'pointer' }} onClick={handleClose} />
                                </Box>
                            </Tooltip>
                        </Box>
                    </Toolbar>
                </AppBar>

                {/* Modal Content (Fix for Scroll Issues) */}
                <Box
                    sx={{
                        maxHeight: height ? height : '80vh',
                        overflow: 'auto',
                        py: 4,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Modal>
    );
};
