import { Add } from '@mui/icons-material';
import MenuIcon from '@mui/icons-material/Menu';
import { Button } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { MouseEvent, useState } from 'react';
import React from 'react';

import { Logo } from './Logo';
import { useAppContext } from '../context/useAppContext';
import { COLORS, styles } from '../theme/styles';
import { AddEditForm } from './forms/AddEditForm';
import { CenteredModal } from './modals/CenteredModal';

const pages: string[] = [];
// const settings = ['Edit', 'Account', 'Dashboard', 'Logout'];

type Props = {
    customTitle?: string;
    editMode: boolean;
    setEditMode: React.Dispatch<React.SetStateAction<boolean>>
    // setOpenAddModal: React.Dispatch<React.SetStateAction<boolean>>
}

export const ResponsiveAppBar = ({ editMode, setEditMode, customTitle }: Props) => {
    const [title, setTitle] = useState(customTitle || 'Lab Dash');
    const [anchorElMenu, setAnchorElMenu] = useState<null | HTMLElement>(null);
    const [openAddModal, setOpenAddModal] = useState(false);

    const { dashboardLayout, saveLayout, refreshDashboard } = useAppContext();
    const handleClose = () => setOpenAddModal(false);

    const handleEdit = () => {
        handleCloseMenu();
        setEditMode(true);
    };

    const handleEditCancel = () => {
        handleCloseMenu();
        setEditMode(false);
        refreshDashboard();
    };

    const handleSave = async () => {
        handleCloseMenu();
        setEditMode(false);
        setOpenAddModal(false);
        saveLayout(dashboardLayout);
    };

    const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
        setAnchorElMenu(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorElMenu(null);
    };

    return (
        <AppBar position='static' sx={{ backgroundColor: COLORS.TRANSPARENT_GRAY }}>
            <Container sx={{ margin: 0, padding: 0, minWidth: '100%' }}>
                <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
                    {/* Desktop */}
                    <Box sx={styles.center}>
                        <Logo sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                        <Typography
                            variant='h5'
                            noWrap
                            sx={{
                                mr: 2,
                                display: { xs: 'none', md: 'flex' },
                                fontFamily: 'Earth Orbiter',
                                letterSpacing: '.1rem',
                                color: 'inherit',
                                textDecoration: 'none',
                            }}
                        >
                            {title}
                        </Typography>
                    </Box>

                    {/* Mobile */}
                    <Logo sx={{ display: { xs: 'flex', md: 'none' }, ml: 2, mr: 2 }} />
                    <Typography
                        variant='h5'
                        noWrap
                        sx={{
                            mr: 2,
                            flexGrow: 1,
                            display: { xs: 'flex', md: 'none' },
                            fontFamily: 'Earth Orbiter',
                            letterSpacing: '.1rem',
                            color: 'inherit',
                            textDecoration: 'none',
                        }}
                    >{title}
                    </Typography>

                    <Box sx={{ flexGrow: 0, display: 'flex' }}>
                        <Box>
                            {editMode &&
                            <>
                                <Button onClick={handleEditCancel} variant='outlined' sx={{ mr: 2 }}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} variant='contained'>
                                    Save Edits
                                </Button>
                            </>
                            }
                            {editMode && <Tooltip title='Add New'>
                                <IconButton onClick={() => setOpenAddModal(true)}>
                                    <Add sx={{ color: 'white', fontSize: '2rem' }}/>
                                </IconButton>
                            </Tooltip>}
                        </Box>
                        <Tooltip title='Open settings'>
                            <IconButton onClick={handleOpenMenu}>
                                <MenuIcon sx={{ color: 'white', fontSize: '2rem' }}/>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            sx={{ mt: '45px' }}
                            id='menu-appbar'
                            anchorEl={anchorElMenu}
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorElMenu)}
                            onClose={handleCloseMenu}
                        >

                            <MenuItem onClick={handleEdit}>
                                <Typography sx={{ textAlign: 'center' }}>Edit</Typography>
                            </MenuItem>

                        </Menu>
                    </Box>
                </Toolbar>
            </Container>
            <CenteredModal open={openAddModal} handleClose={handleClose} title='Add Item'>
                <AddEditForm handleClose={handleClose}/>
            </CenteredModal>
        </AppBar>
    );
};
