import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Box, Modal, Toolbar, Tooltip, Typography } from '@mui/material';
import { ReactNode } from 'react';

import { useWindowDimensions } from '../../hooks/useWindowDimensions';

type Props = {
    open: boolean;
    handleClose: () => void;
    title?: string;
    children: ReactNode;
}

export const CenteredModal = ({ open, handleClose, children, title }: Props) => {
    const windowDimensions = useWindowDimensions();
    const setWidth = () => {
        if (windowDimensions.width <= 800) {
            return '90vw';
        }

        return '75vw';
    };

    const style = {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: setWidth(),
        bgcolor: 'background.paper',
        border: '0px solid #000',
        borderRadius: '8px',
        boxShadow: 24
    };

    const closeBtnStyle = {
        display: 'flex',
        justifyContent: 'flex-end',
        width: '98%',
    };

    return (
        <Modal
            open={open}
            aria-labelledby='modal'
        >
            <Box sx={style}>
                <AppBar position='static' sx={{ height: 50, borderRadius: '4px 4px 0 0' }} elevation={0}>
                    <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', marginTop: -.9 }}>
                        <Box sx={{ width: '100%' }}>
                            <Typography>{title}</Typography>
                        </Box>
                        <Box sx={closeBtnStyle}>
                            <Tooltip title='Close' placement='top'>
                                <CloseIcon sx={{ fontSize: 28, cursor: 'pointer' }} onClick={handleClose} />
                            </Tooltip>
                        </Box>
                    </Toolbar>
                </AppBar>
                <Box sx={{ height: '80vh', overflow: 'scroll' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', mt: 4 }}>{children}</Box>
                </Box>
            </Box>
        </Modal>

    );
};
