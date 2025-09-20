import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Box, IconButton, Modal, Toolbar, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { ReactNode } from 'react';

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
    fullWidthContent?: boolean
}

export const CenteredModal = ({ open, handleClose, children, width, height, title, fullWidthContent = false }: Props) => {
    const windowDimensions = useWindowDimensions();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const setWidth = () => {
        if (width) {
            return width;
        }

        if (windowDimensions.width <= 1200) {
            return '92vw';
        }

        return '50vw';
    };

    const style = {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: setWidth(),
        height: height || 'auto',
        bgcolor: 'background.paper',
        borderRadius: '8px',
        boxShadow: 24,
        maxHeight: height ? height : '90vh',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none', // Remove focus outline
        border: 'none'   // Ensure no border
    };

    return (
        <Modal
            open={open}
            onClose={(event, reason) => {
                if (reason === 'escapeKeyDown') {
                    handleClose();
                }
            }}
            aria-labelledby='modal-title'
            aria-describedby='modal-description'
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
                        <Typography id='modal-title' sx={{ flexGrow: 1 }}>{title}</Typography>
                        <Box
                            onPointerDownCapture={(e) => e.stopPropagation()} // Stop drag from interfering
                            onClick={(e) => e.stopPropagation()} // Prevent drag from triggering on click
                            sx={styles.vcenter}
                        >
                            <Tooltip title='Close' placement='top'>
                                <IconButton
                                    onClick={handleClose}
                                    aria-label='Close modal'
                                >
                                    <Box height={'100%'} sx={styles.vcenter}>
                                        <CloseIcon sx={{ fontSize: 28, color: 'white' }} />
                                    </Box>
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Toolbar>
                </AppBar>

                {/* Modal Content (Fix for Scroll Issues) */}
                <Box
                    id='modal-description'
                    sx={{
                        flex: 1, // Take remaining space
                        overflowY: 'auto', // Enable scrolling
                        overflowX: 'hidden', // Prevent horizontal scrolling
                        py: 3,
                        px: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: fullWidthContent ? 'stretch' : 'center',
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
