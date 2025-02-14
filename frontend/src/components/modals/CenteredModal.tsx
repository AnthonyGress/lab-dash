import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Box, Modal, Toolbar, Tooltip, Typography } from '@mui/material';
import zIndex from '@mui/material/styles/zIndex';
import { ReactNode } from 'react';

import { useWindowDimensions } from '../../hooks/useWindowDimensions';

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

    const setWidth = () => {
        if (width) {
            return width;
        }

        if (windowDimensions.width <= 800) {
            return '90vw';
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

    return (
        <Modal open={open} aria-labelledby='modal'>
            <Box sx={style}>
                {/* AppBar with Title and Close Button */}
                <AppBar position='static' sx={{ height: 50, borderRadius: '8px 8px 0 0' }} elevation={0}>
                    <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', marginTop: -0.9 }}>
                        <Typography>{title}</Typography>
                        <div
                            onPointerDownCapture={(e) => e.stopPropagation()} // Stop drag from interfering
                            onClick={(e) => e.stopPropagation()} // Prevent drag from triggering on click
                        >
                            <Tooltip title='Close' placement='top'>
                                <CloseIcon sx={{ fontSize: 28, cursor: 'pointer' }} onClick={handleClose} />
                            </Tooltip>
                        </div>
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
