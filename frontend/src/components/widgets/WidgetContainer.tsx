import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Card, IconButton, Menu, MenuItem } from '@mui/material';
import React, { useState } from 'react';

import { COLORS } from '../../theme/styles';

type Props = {
    children: React.ReactNode;
    editMode: boolean;
    onEdit?: () => void
    onDelete?: () => void;
    appShortcut?: boolean;
    placeholder?: boolean;

};

export const WidgetContainer: React.FC<Props> = ({ children, editMode, onEdit, onDelete, appShortcut=false, placeholder=false }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

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
                width: appShortcut ? '7rem' : '90%',
                minHeight: appShortcut ? '6rem' : 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: placeholder ? 'transparent' : COLORS.TRANSPARENT_GRAY,
                borderRadius: 2,
                border: placeholder && editMode ? `2px solid ${COLORS.BORDER}` : !placeholder ? `1px solid ${COLORS.BORDER}` : 'none',
                padding: 2,
                cursor: editMode ? 'grab' : 'auto',
                boxShadow: placeholder ? 0 : 2,
                position: 'relative',
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
        </Card>
    );
};
