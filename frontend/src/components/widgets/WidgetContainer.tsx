import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, Card, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { useServiceStatus } from '../../hooks/useServiceStatus';
import { COLORS } from '../../theme/styles';

type Props = {
    children: React.ReactNode;
    editMode: boolean;
    onEdit?: () => void
    onDelete?: () => void;
    appShortcut?: boolean;
    placeholder?: boolean;
    url?: string

};

export const WidgetContainer: React.FC<Props> = ({ children, editMode, onEdit, onDelete, appShortcut=false, placeholder=false, url }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const isOnline = useServiceStatus(url);

    let dotColor = 'gray';
    let tooltipText = 'Unknown';

    if (isOnline === true) {
        dotColor = 'green';
        tooltipText = 'Online';
    } else if (isOnline === false) {
        dotColor = 'red';
        tooltipText = 'Offline';
    }

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation(); // Stop drag from triggering
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    return (
        <Card
            sx={{
                width: '100%',
                maxWidth: '100%',
                flexGrow: 1,
                minHeight: appShortcut ? '6rem' : '14rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: placeholder ? 'transparent' : COLORS.TRANSPARENT_GRAY,
                borderRadius: 2,
                border: placeholder && editMode ? `0px solid ${COLORS.BORDER}` : !placeholder ? `1px solid ${COLORS.BORDER}` : 'none',
                padding: 2,
                cursor: editMode ? 'grab' : 'auto',
                boxShadow: placeholder ? 0 : 2,
                position: 'relative',
                overflow: 'hidden', // Prevents content from spilling out
                boxSizing: 'border-box', // Ensures padding doesn’t increase size
            }}
        >
            {/* Show menu only in edit mode */}
            {editMode && (
                <div
                    onPointerDownCapture={(e) => e.stopPropagation()} // Stop drag from interfering
                    onClick={(e) => e.stopPropagation()} // Prevent drag from triggering on click
                >
                    <IconButton
                        sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                        }}
                        onClick={handleMenuOpen}
                    >
                        <MoreVertIcon sx={{ color: 'text.primary' }}/>
                    </IconButton>
                    <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
                        <MenuItem onClick={() => { handleMenuClose(); onEdit?.(); }}>Edit</MenuItem>
                        <MenuItem onClick={() => { handleMenuClose(); onDelete?.(); }}>Delete</MenuItem>
                    </Menu>
                </div>
            )}
            {children}
            {url && (
                <Tooltip title={tooltipText} arrow placement='top' slotProps={{
                    tooltip: {
                        sx: {
                            fontSize: 14,
                        },
                    },
                }}>
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 5,
                            right: 5,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: dotColor,
                            cursor: 'pointer'
                        }}
                    />
                </Tooltip>
            )}
        </Card>
    );
};
