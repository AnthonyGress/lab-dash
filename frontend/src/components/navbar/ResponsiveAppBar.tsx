import { Add } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import { Avatar, Badge, Button, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, styled } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { nanoid } from 'nanoid';
import React, { useEffect, useState } from 'react';
import { FaEdit, FaInfoCircle, FaSync } from 'react-icons/fa';
import { FaArrowRightFromBracket, FaGear, FaHouse, FaUser } from 'react-icons/fa6';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { getAppVersion } from '../../utils/version';
import { AddEditForm } from '../forms/AddEditForm';
import { Logo } from '../Logo';
import { CenteredModal } from '../modals/CenteredModal';
import { PopupManager } from '../modals/PopupManager';
import { UpdateModal } from '../modals/UpdateModal';
import { VersionModal } from '../modals/VersionModal';
import { GlobalSearch } from '../search/GlobalSearch';

const DrawerHeader = styled('div')(() => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 4),
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

type Props = {
    children: React.ReactNode;
}

export const ResponsiveAppBar = ({ children }: Props) => {
    const [openDrawer, setOpenDrawer] = useState(false);
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openUpdateModal, setOpenUpdateModal] = useState(false);
    const [openVersionModal, setOpenVersionModal] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const {
        dashboardLayout,
        saveLayout,
        refreshDashboard,
        editMode,
        setEditMode,
        config,
        isLoggedIn,
        username,
        setIsLoggedIn,
        setUsername,
        isAdmin,
        setIsAdmin,
        updateAvailable,
        latestVersion
    } = useAppContext();

    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const handleClose = () => setOpenAddModal(false);
    const handleCloseUpdateModal = () => setOpenUpdateModal(false);

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

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogin = () => {
        handleMenuClose();
        navigate('/login');
    };

    const handleLogout = async () => {
        try {
            // Turn off edit mode if it's active
            if (editMode) {
                setEditMode(false);
            }

            await DashApi.logout();

            // Reset all auth-related state variables in the correct order
            setIsAdmin(false);
            setUsername(null);
            setIsLoggedIn(false);

            localStorage.removeItem('username');
            handleMenuClose();

            // Force refresh dashboard
            refreshDashboard();

            // Navigate to home page
            navigate('/');
            handleCloseDrawer();
            PopupManager.success('Logged out');
        } catch (error) {
            console.error('Logout error:', error);
            PopupManager.failure('Logout error');
        }
    };

    const handleProfile = () => {
        handleMenuClose();
        // Navigate to user profile page if you have one
        // navigate('/profile');
    };

    const handleOpenUpdateModal = () => {
        setOpenUpdateModal(true);
        handleCloseDrawer();
    };

    const handleOpenVersionModal = () => {
        setOpenVersionModal(true);
        handleCloseDrawer();
    };

    return (
        <>
            <AppBar position='fixed' sx={{
                backgroundColor: COLORS.TRANSPARENT_GRAY,
                backdropFilter: 'blur(6px)',
                width: '100%',
                maxWidth: '100%',
                overflowX: 'hidden'
            }}>
                <Container sx={{ margin: 0, padding: 0, minWidth: '100%' }}>
                    <Toolbar disableGutters sx={{ justifyContent: 'space-between', width: '100%' }}>
                        <Link to='/'>
                            {/* Desktop */}
                            <Box sx={{ width: { xs: '100%', md: '200px' }, ...styles.center }}>
                                <Logo sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                                <Typography
                                    variant='h5'
                                    noWrap
                                    sx={{
                                        mr: 2,
                                        flexGrow: 1,
                                        display: { xs: 'none', md: 'block' },
                                        fontFamily: 'Earth Orbiter',
                                        letterSpacing: '.1rem',
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        minWidth: '120px',
                                        textAlign: 'left',
                                        whiteSpace: 'nowrap',
                                        overflow: 'visible'
                                    }}
                                    key={`app-title-${config?.title}-${nanoid()}`}
                                >
                                    <div style={{ display: 'block' }}>{config?.title || 'Lab Dash'}</div>
                                </Typography>
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
                                        whiteSpace: 'nowrap',
                                        overflow: 'visible'
                                    }}
                                    key={`app-title-mobile-${config?.title}-${nanoid()}`}
                                >
                                    {config?.title || 'Lab Dash'}
                                </Typography>
                            </Box>
                        </Link>
                        { currentPath === '/' && config?.search &&
                            <Box sx={{ width: '100%', display: { xs: 'none', md: 'block' } }}>
                                <GlobalSearch />
                            </Box>
                        }

                        <Box sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', width: { md: '200px' }, flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {editMode &&
                                <Tooltip title='Add Item' placement='left'>
                                    <IconButton onClick={() => setOpenAddModal(true)}>
                                        <Add sx={{ color: 'white', fontSize: '2rem' }}/>
                                    </IconButton>
                                </Tooltip>
                                }

                                {/* Hamburger Menu Button */}
                                <IconButton
                                    onClick={handleOpenDrawer}
                                    sx={{ ml: 1, mr: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                >
                                    {updateAvailable ? (
                                        <Badge
                                            color='error'
                                            variant='dot'
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    top: 0,
                                                    right: 5
                                                }
                                            }}
                                        >
                                            <MenuIcon sx={{ color: 'white', fontSize: '2rem' }}/>
                                        </Badge>
                                    ) : (
                                        <MenuIcon sx={{ color: 'white', fontSize: '2rem' }}/>
                                    )}
                                </IconButton>
                            </Box>

                            <Drawer
                                open={openDrawer}
                                onClose={handleCloseDrawer}
                                anchor='right'
                            >
                                <Box
                                    sx={{
                                        width: 225,
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                    role='presentation'
                                >
                                    <DrawerHeader>
                                        <IconButton onClick={handleCloseDrawer}>
                                            <CloseIcon sx={{ fontSize: 34, color: 'text.primary' }} />
                                        </IconButton>
                                    </DrawerHeader>
                                    <Divider />

                                    {/* Main Navigation */}
                                    <List>
                                        <NavLink to='/' style={{ width: '100%', color: 'white' }} onClick={handleCloseDrawer}>
                                            <ListItem disablePadding>
                                                <ListItemButton>
                                                    <ListItemIcon>
                                                        {<FaHouse style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Home'} />
                                                </ListItemButton>
                                            </ListItem>
                                        </NavLink>
                                        {isLoggedIn && isAdmin && (
                                            <ListItem disablePadding>
                                                <ListItemButton onClick={() => {
                                                    setEditMode(true);
                                                    if (currentPath !== '/') navigate('/');
                                                    handleCloseDrawer();
                                                }}>
                                                    <ListItemIcon>
                                                        {<FaEdit style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Edit Dashboard'} />
                                                </ListItemButton>
                                            </ListItem>
                                        )}
                                        {isLoggedIn && isAdmin && (
                                            <NavLink to='/settings' style={{ width: '100%', color: 'white' }} onClick={() => {handleCloseDrawer(); setEditMode(false);}}>
                                                <ListItem disablePadding>
                                                    <ListItemButton>
                                                        <ListItemIcon>
                                                            {<FaGear style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                        </ListItemIcon>
                                                        <ListItemText primary={'Settings'} />
                                                    </ListItemButton>
                                                </ListItem>
                                            </NavLink>
                                        )}
                                    </List>

                                    {/* Spacer to push account info to bottom */}
                                    <Box sx={{ flexGrow: 1 }} />

                                    {/* Account Info at Bottom */}
                                    <List sx={{ mt: 'auto', mb: 1 }}>
                                        <Divider />

                                        {/* Update Available Item */}
                                        {updateAvailable && (
                                            <ListItem disablePadding>
                                                <ListItemButton onClick={isLoggedIn ? handleOpenUpdateModal : () => {}}>
                                                    <ListItemIcon>
                                                        <FaSync style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={'Update Available'}
                                                        secondary={`Version ${latestVersion}`}
                                                        slotProps={{
                                                            secondary: {
                                                                color: 'text.primary'
                                                            }
                                                        }}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        )}
                                        {/* Version Info */}
                                        <ListItem disablePadding>
                                            <ListItemButton onClick={handleOpenVersionModal}>
                                                <ListItemIcon>
                                                    <FaInfoCircle style={{ color: theme.palette.text.primary, fontSize: 22, marginLeft: '-4px' }} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Typography>
                                                            v{getAppVersion()}
                                                        </Typography>
                                                    }
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                        {/* Conditional Account Info */}
                                        {isLoggedIn ? (
                                            <>
                                                {/* User Info */}
                                                <ListItem
                                                    disablePadding
                                                    sx={{
                                                        mt: 1
                                                    }}
                                                >
                                                    <ListItemButton onClick={handleProfile}>
                                                        <ListItemIcon>
                                                            <Avatar
                                                                sx={{
                                                                    width: 26,
                                                                    height: 26,
                                                                    bgcolor: 'primary.main',
                                                                    fontSize: 18,
                                                                    ml: '-4px'
                                                                }}
                                                            >
                                                                {username ? username.charAt(0).toUpperCase() : <FaUser style={{ fontSize: 16 }} />}
                                                            </Avatar>
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={username || 'User'}
                                                            secondary={isAdmin ? 'Administrator' : 'User'}
                                                            slotProps={{
                                                                secondary: {
                                                                    color: 'text.primary'
                                                                }
                                                            }}
                                                        />
                                                    </ListItemButton>
                                                </ListItem>

                                                {/* Logout Button */}
                                                <ListItem disablePadding>
                                                    <ListItemButton onClick={() => {handleCloseDrawer(); handleLogout();}}>
                                                        <ListItemIcon>
                                                            <FaArrowRightFromBracket style={{ color: theme.palette.text.primary, fontSize: 22 }} />
                                                        </ListItemIcon>
                                                        <ListItemText primary='Logout' />
                                                    </ListItemButton>
                                                </ListItem>
                                            </>
                                        ) : (
                                            // Login Button for Non-Logged in Users
                                            <NavLink to='/login' style={{ width: '100%', color: 'white' }} onClick={() => {handleCloseDrawer(); setEditMode(false);}}>
                                                <ListItem disablePadding>
                                                    <ListItemButton>
                                                        <ListItemIcon>
                                                            <FaUser style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                                        </ListItemIcon>
                                                        <ListItemText primary={'Login'} />
                                                    </ListItemButton>
                                                </ListItem>
                                            </NavLink>
                                        )}
                                    </List>
                                </Box>
                            </Drawer>
                        </Box>
                    </Toolbar>
                </Container>
                <CenteredModal open={openAddModal} handleClose={handleClose} title='Add Item'>
                    <AddEditForm handleClose={handleClose}/>
                </CenteredModal>
                {/* Update Modal - Replaced with component */}
                <UpdateModal
                    open={openUpdateModal}
                    handleClose={handleCloseUpdateModal}
                    latestVersion={latestVersion}
                    isAdmin={isAdmin}
                />
                {/* Version Modal */}
                <VersionModal
                    open={openVersionModal}
                    handleClose={() => setOpenVersionModal(false)}
                />
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
                {
                    editMode
                        ? <Box position='absolute' sx={{ top: { xs: '66px', md: '70px' }, zIndex: 99, display: 'flex', justifyContent: 'flex-end', width: '100%', px: 3, gap: 2 }}>
                            <Button variant='contained' onClick={handleEditCancel} sx={{ backgroundColor: COLORS.LIGHT_GRAY_TRANSPARENT, color: 'black', borderRadius: '999px', height: '1.7rem', width: '4.5rem' }}>Cancel</Button>
                            <Button variant='contained' onClick={handleSave}  sx={{ backgroundColor: COLORS.LIGHT_GRAY_TRANSPARENT, color: 'black', borderRadius: '999px', height: '1.7rem', width: '4.5rem' }}>Done</Button>
                        </Box>
                        :
                        currentPath === '/' && config?.search && <Box position='absolute' sx={{ top: { xs: '49px', sm: '55px' }, zIndex: 99, display: { xs: 'flex', md: 'none' }, justifyContent: 'center', width: '100%' }} mt={.5}>
                            <GlobalSearch />
                        </Box>
                }
                {children}
            </Box>
        </>
    );
};
