import MoreVertIcon from '@mui/icons-material/MoreVert';
import { IconButton, Menu, MenuItem } from '@mui/material';
import React, { useState } from 'react';
import { FaArrowRight, FaCopy, FaFile, FaHouse, FaPenToSquare, FaTrashCan } from 'react-icons/fa6';

import { useAppContext } from '../../../../context/useAppContext';

type EditMenuProps = {
    editMode: boolean;
    itemId?: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
};

export const EditMenu: React.FC<EditMenuProps> = ({ editMode, itemId, onEdit, onDelete, onDuplicate }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const moveMenuOpen = Boolean(moveMenuAnchor);

    const { pages, currentPageId, moveItemToPage } = useAppContext();

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation(); // Stop drag from triggering
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleMoveMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMoveMenuAnchor(event.currentTarget);
    };

    const handleMoveMenuClose = () => {
        setMoveMenuAnchor(null);
    };

    const handleMoveToPage = async (targetPageId: string | null) => {
        if (itemId) {
            await moveItemToPage(itemId, targetPageId);
            handleMoveMenuClose();
            handleMenuClose();
        }
    };

    // Check if there are other pages to move to
    const hasOtherPages = pages.length > 0 || currentPageId !== null;

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
                disableScrollLock={false}
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                >
                    <FaPenToSquare size={14} />
                    Edit
                </MenuItem>
                {onDuplicate && (
                    <MenuItem
                        onClick={() => { handleMenuClose(); onDuplicate(); }}
                        sx={{
                            py: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <FaCopy size={14} />
                        Duplicate
                    </MenuItem>
                )}
                {hasOtherPages && (
                    <MenuItem
                        onClick={handleMoveMenuOpen}
                        sx={{
                            py: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <FaArrowRight size={14} />
                        Move to page
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => { handleMenuClose(); onDelete?.(); }}
                    sx={{
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                >
                    <FaTrashCan size={14} />
                    Delete
                </MenuItem>
            </Menu>

            {/* Move to submenu */}
            <Menu
                anchorEl={moveMenuAnchor}
                open={moveMenuOpen}
                onClose={handleMoveMenuClose}
                disableScrollLock={false}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                sx={{
                    '& .MuiPaper-root': {
                        bgcolor: '#2A2A2A',
                        color: 'white',
                        borderRadius: 1,
                        boxShadow: 4
                    }
                }}
            >
                {/* Home option (only show if not already on home) */}
                {currentPageId !== null && (
                    <MenuItem
                        onClick={() => handleMoveToPage(null)}
                        sx={{
                            py: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <FaHouse size={14} />
                        Home
                    </MenuItem>
                )}

                {/* Page options (only show pages that are not the current page) */}
                {pages
                    .filter(page => page.id !== currentPageId)
                    .map((page) => (
                        <MenuItem
                            key={page.id}
                            onClick={() => handleMoveToPage(page.id)}
                            sx={{
                                py: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}
                        >
                            <FaFile size={14} />
                            {page.name}
                        </MenuItem>
                    ))
                }
            </Menu>
        </div>
    );
};
