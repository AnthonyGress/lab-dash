import { Add } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import { Button, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, styled, useMediaQuery } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { title } from 'process';
import { useEffect, useState } from 'react';
import React from 'react';
import { FaGear, FaHouse, FaWrench } from 'react-icons/fa6';
import { Link, NavLink } from 'react-router-dom';

import { useAppContext } from '../../context/useAppContext';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { AddEditForm } from '../forms/AddEditForm';
import { Logo } from '../Logo';
import { CenteredModal } from '../modals/CenteredModal';
import { GlobalSearch } from '../search/GlobalSearch';

const DrawerHeader = styled('div')(() => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 2),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

type Props = {
    children: React.ReactNode;
}

export const ResponsiveAppBar = ({ children }: Props) => {
    const [openDrawer, setOpenDrawer] = useState(false);
    const [openAddModal, setOpenAddModal] = useState(false);
    const { dashboardLayout, saveLayout, refreshDashboard, editMode, setEditMode, config } = useAppContext();

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const handleClose = () => setOpenAddModal(false);

    const handleEditCancel = () => {
        handleCloseDrawer();
        setEditMode(false);
        refreshDashboard();
    };

    const handleSave = async () => {
        handleCloseDrawer();
        setEditMode(false);
        setOpenAddModal(false);
        saveLayout(dashboardLayout);
    };

    const handleOpenDrawer = () => {
        setOpenDrawer(true);
    };

    const handleCloseDrawer = () => {
        setOpenDrawer(false);
    };


    return (
        <>
            <AppBar position='fixed' sx={{ backgroundColor: COLORS.TRANSPARENT_GRAY, backdropFilter: 'blur(6px)',width: '100vw', maxWidth: '100%', overflowX: 'hidden'
            }}>
                <Container sx={{ margin: 0, padding: 0, minWidth: '100%' }}>
                    <Toolbar disableGutters sx={{ justifyContent: 'space-between', width: '100%' }}>
                        {/* Desktop */}
                        <Link to='/'>
                            <Box sx={styles.center}>
                                <Logo sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                                <Typography
                                    variant='h5'
                                    noWrap
                                    sx={{
                                        mr: 2,
                                        flexGrow: 1,
                                        display: { xs: 'none', md: 'flex' },
                                        fontFamily: 'Earth Orbiter',
                                        letterSpacing: '.1rem',
                                        color: 'inherit',
                                        textDecoration: 'none',
                                    }}
                                >
                                    {config?.title || 'Lab Dash'}
                                </Typography>
                            </Box>
                        </Link>

                        {/* Mobile */}
                        <Logo sx={{ display: { xs: 'flex', md: 'none' }, ml: 2, mr: 2 }} />
                        {<Typography
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
                        >
                            {(!editMode && isMobile) && config?.title || 'Lab Dash'}
                        </Typography>}

                        <Box sx={{ flexGrow: 0, display: 'flex' }}>
                            <Box>
                                {editMode &&
                            <Box sx={{ display: 'flex', width: '100%' }}>
                                <Tooltip title='Add Item' placement='left'>
                                    <IconButton onClick={() => setOpenAddModal(true)}>
                                        <Add sx={{ color: 'white', fontSize: '2rem' }}/>
                                    </IconButton>
                                </Tooltip>
                            </Box>
                                }
                            </Box>
                            <IconButton onClick={handleOpenDrawer}>
                                <MenuIcon sx={{ color: 'white', fontSize: '2rem', marginRight: '1rem' }}/>
                            </IconButton>

                            <Drawer open={openDrawer} onClose={handleCloseDrawer} anchor='right'>
                                <Box sx={{ width: 225 }} role='presentation' onClick={handleCloseDrawer}>
                                    <DrawerHeader>
                                        <IconButton onClick={handleCloseDrawer}>
                                            <CloseIcon sx={{ fontSize: 34, color: 'text.primary' }} />
                                        </IconButton>
                                    </DrawerHeader>
                                    <Divider />
                                    <List>
                                        <NavLink to='/' style={{ width: '100%', color: 'white' }}>
                                            <ListItem disablePadding>
                                                <ListItemButton>
                                                    <ListItemIcon>
                                                        {<FaHouse style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Home'} />
                                                </ListItemButton>
                                            </ListItem>
                                        </NavLink>
                                        <ListItem disablePadding>
                                            <ListItemButton onClick={() => setEditMode(true)}>
                                                <ListItemIcon>
                                                    {<FaWrench style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                </ListItemIcon>
                                                <ListItemText primary={'Edit Dashboard'} />
                                            </ListItemButton>
                                        </ListItem>
                                        <NavLink to='/settings' style={{ width: '100%', color: 'white' }}>
                                            <ListItem disablePadding>
                                                <ListItemButton>
                                                    <ListItemIcon>
                                                        {<FaGear style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Settings'} />
                                                </ListItemButton>
                                            </ListItem>
                                        </NavLink>
                                    </List>
                                </Box>
                            </Drawer>
                        </Box>
                    </Toolbar>
                </Container>
                <CenteredModal open={openAddModal} handleClose={handleClose} title='Add Item'>
                    <AddEditForm handleClose={handleClose}/>
                </CenteredModal>
            </AppBar>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column'
            }}
            >
                <Box component='main' sx={{
                    flexGrow: 1,
                    mt: '64px',
                    paddingTop: '3rem',
                }}>
                </Box>
                {editMode
                    ? <Box position='absolute' sx={{ top: { xs: '66px', md: '70px' }, zIndex: 99, display: 'flex', justifyContent: 'flex-end', width: '100%', px: 3, gap: 2 }}>
                        <Button variant='contained' onClick={handleEditCancel} sx={{ backgroundColor: COLORS.LIGHT_GRAY_TRANSPARENT, color: 'black', borderRadius: '999px', height: '1.7rem', width: '4.5rem' }}>Cancel</Button>
                        <Button variant='contained' onClick={handleSave}  sx={{ backgroundColor: COLORS.LIGHT_GRAY_TRANSPARENT, color: 'black', borderRadius: '999px', height: '1.7rem', width: '4.5rem' }}>Done</Button>
                    </Box>
                    : <Box position='absolute' sx={{ top: { xs: '49px', md: '55px' }, zIndex: 99, display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <GlobalSearch />
                    </Box>
                }
                {children}
            </Box>
        </>

    );
};
