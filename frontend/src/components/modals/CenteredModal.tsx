import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Backdrop, Box, Modal, styled, Toolbar, Tooltip, Typography, useMediaQuery } from '@mui/material';
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

        if (windowDimensions.width <= 1200) {
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
        maxHeight: '90vh', // Limit the maximum height to 90% of viewport height
        display: 'flex',
        flexDirection: 'column'
    };

    return (
        <Modal
            open={open}
            aria-labelledby='modal'
            disableEnforceFocus
            disableAutoFocus
            // keepMounted
            disableScrollLock={false}
        >
            <Box sx={style}>
                {/* AppBar with Title and Close Button */}
                <AppBar position='static' sx={{
                    height: '3rem',
                    borderRadius: '8px 8px 0 0',
                    flexShrink: 0 // Prevent AppBar from shrinking
                }} elevation={0}>
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
                        flex: 1, // Take remaining space
                        overflowY: 'auto', // Enable scrolling
                        overflowX: 'hidden', // Prevent horizontal scrolling
                        py: 4,
                        px: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        '&::-webkit-scrollbar': {
                            width: '8px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                        }
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Modal>
    );
};
