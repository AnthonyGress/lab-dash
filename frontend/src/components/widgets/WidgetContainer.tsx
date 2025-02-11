import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Card, IconButton, Menu, MenuItem } from '@mui/material';
import React, { useState } from 'react';

import { COLORS } from '../../theme/styles';

type Props = {
    children: React.ReactNode;
    editMode: boolean;
    onEdit?: () => void
    onDelete?: () => void;
};

export const WidgetContainer: React.FC<Props> = ({ children, editMode, onEdit, onDelete }) => {
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
                width: '90%',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.TRANSPARENT_GRAY,
                border: 'none',
                cursor: editMode ? 'grab' : 'auto',
                boxShadow: 2,
                borderRadius: 2,
                padding: 2,
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
                            top: 8,
                            right: 8,
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
