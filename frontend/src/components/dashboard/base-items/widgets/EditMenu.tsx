import MoreVertIcon from '@mui/icons-material/MoreVert';
import { IconButton, Menu, MenuItem } from '@mui/material';
import React, { useState } from 'react';

type EditMenuProps = {
    editMode: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
};

export const EditMenu: React.FC<EditMenuProps> = ({ editMode, onEdit, onDelete, onDuplicate }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation(); // Stop drag from triggering
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    if (!editMode) return null;

    return (
        <div
            onPointerDownCapture={(e) => e.stopPropagation()} // Stop drag from interfering
            onClick={(e) => e.stopPropagation()} // Prevent drag from triggering on click
        >
            <IconButton
                sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    zIndex: 99
                }}
                onClick={handleMenuOpen}
            >
                <MoreVertIcon sx={{ color: 'text.primary' }}/>
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                sx={{
                    '& .MuiPaper-root': {
                        bgcolor: '#2A2A2A',
                        color: 'white',
                        borderRadius: 1,
                        boxShadow: 4
                    }
                }}
            >
                <MenuItem
                    onClick={() => { handleMenuClose(); onEdit?.(); }}
                    sx={{
                        py: 1,
                    }}
                >
                    Edit
                </MenuItem>
                {onDuplicate && (
                    <MenuItem
                        onClick={() => { handleMenuClose(); onDuplicate(); }}
                        sx={{
                            py: 1,
                        }}
                    >
                        Duplicate
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => { handleMenuClose(); onDelete?.(); }}
                    sx={{
                        py: 1,
                    }}
                >
                    Delete
                </MenuItem>
            </Menu>
        </div>
    );
};
