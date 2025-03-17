import { Add } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import { Avatar, Button, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, styled, useMediaQuery } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { FaGear, FaHouse, FaRightFromBracket, FaUser, FaWrench } from 'react-icons/fa6';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { DashApi } from '../../api/dash-api';
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
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const { dashboardLayout, saveLayout, refreshDashboard, editMode, setEditMode, config } = useAppContext();

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const menuOpen = Boolean(anchorEl);

    useEffect(() => {
        // Check if user is logged in by attempting to access a protected endpoint
        const checkLoginStatus = async () => {
            try {
                // We could check cookies or make a lightweight auth check API call
                // For now, we'll simulate with a simple check
                const cookie = document.cookie;
                const hasAccessToken = cookie.includes('access_token');
                setIsLoggedIn(hasAccessToken);

                // If there's user info stored somewhere, set the username
                // This is placeholder logic - implement based on your auth approach
                if (hasAccessToken) {
                    // This would be retrieved from your auth state management
                    const storedUsername = localStorage.getItem('username');
                    setUsername(storedUsername);
                }
            } catch (error) {
                console.error('Error checking login status:', error);
                setIsLoggedIn(false);
            }
        };

        checkLoginStatus();
    }, [location.pathname]); // Re-check when route changes

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

    const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
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
            await DashApi.logout();
            setIsLoggedIn(false);
            setUsername(null);
            localStorage.removeItem('username');
            handleMenuClose();

            // Optionally redirect to home page
            navigate('/');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleProfile = () => {
        handleMenuClose();
        // Navigate to user profile page if you have one
        // navigate('/profile');
    };


    return (
        <>
            <AppBar position='fixed' sx={{ backgroundColor: COLORS.TRANSPARENT_GRAY, backdropFilter: 'blur(6px)',width: '100vw', maxWidth: '100%', overflowX: 'hidden'
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
                                        display: { xs: 'none', md: 'flex' },
                                        fontFamily: 'Earth Orbiter',
                                        letterSpacing: '.1rem',
                                        color: 'inherit',
                                        textDecoration: 'none',
                                    }}
                                >
                                    {config?.title || 'Lab Dash'}
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
                                    }}
                                >
                                    {(!editMode && isMobile) && config?.title || 'Lab Dash'}
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

                                {/* Avatar Menu */}
                                <Tooltip title={isLoggedIn ? username || 'Account' : 'Login'}>
                                    <IconButton
                                        onClick={handleAvatarClick}
                                        size='small'
                                        aria-controls={menuOpen ? 'account-menu' : undefined}
                                        aria-haspopup='true'
                                        aria-expanded={menuOpen ? 'true' : undefined}
                                        sx={{ mr: 2 }}
                                    >
                                        <Avatar
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                bgcolor: isLoggedIn ? 'primary.main' : 'grey.500'
                                            }}
                                        >
                                            {isLoggedIn && username ? username.charAt(0).toUpperCase() : <FaUser />}
                                        </Avatar>
                                    </IconButton>
                                </Tooltip>
                                <Menu
                                    id='account-menu'
                                    anchorEl={anchorEl}
                                    open={menuOpen}
                                    onClose={handleMenuClose}
                                    PaperProps={{
                                        elevation: 0,
                                        sx: {
                                            overflow: 'visible',
                                            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                            mt: 1.5,
                                            '& .MuiAvatar-root': {
                                                width: 32,
                                                height: 32,
                                                ml: -0.5,
                                                mr: 1,
                                            },
                                        },
                                    }}
                                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                                >
                                    {isLoggedIn ? (
                                        <>
                                            <MenuItem onClick={handleProfile}>
                                                <ListItemIcon>
                                                    <FaUser style={{ fontSize: 16, color: theme.palette.text.primary }} />
                                                </ListItemIcon>
                                                {username || 'User'}
                                            </MenuItem>
                                            <Divider />
                                            <MenuItem onClick={handleLogout}>
                                                <ListItemIcon>
                                                    <FaRightFromBracket style={{ fontSize: 16, color: theme.palette.text.primary }} />
                                                </ListItemIcon>
                                                Logout
                                            </MenuItem>
                                        </>
                                    ) : (
                                        <MenuItem onClick={handleLogin}>
                                            <ListItemIcon>
                                                <FaUser style={{ fontSize: 16 , color: theme.palette.text.primary }} />
                                            </ListItemIcon>
                                            Login
                                        </MenuItem>
                                    )}
                                </Menu>

                                <IconButton onClick={handleOpenDrawer}>
                                    <MenuIcon sx={{ color: 'white', fontSize: '2rem', marginRight: '1rem' }}/>
                                </IconButton>
                            </Box>

                            <Drawer open={openDrawer} onClose={handleCloseDrawer} anchor='right'>
                                <Box sx={{ width: 225 }} role='presentation' onClick={handleCloseDrawer}>
                                    <DrawerHeader>
                                        <IconButton onClick={handleCloseDrawer}>
                                            <CloseIcon sx={{ fontSize: 34, color: 'text.primary' }} />
                                        </IconButton>
                                    </DrawerHeader>
                                    <Divider />
                                    {/* Routes */}
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
                                            <ListItemButton onClick={() => {
                                                setEditMode(true);
                                                if (currentPath !== '/') navigate('/');
                                            }}>
                                                <ListItemIcon>
                                                    {<FaWrench style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                </ListItemIcon>
                                                <ListItemText primary={'Edit Dashboard'} />
                                            </ListItemButton>
                                        </ListItem>
                                        <NavLink to='/settings' style={{ width: '100%', color: 'white' }} onClick={() => setEditMode(false)}>
                                            <ListItem disablePadding>
                                                <ListItemButton>
                                                    <ListItemIcon>
                                                        {<FaGear style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Settings'} />
                                                </ListItemButton>
                                            </ListItem>
                                        </NavLink>
                                        {!isLoggedIn && (
                                            <NavLink to='/login' style={{ width: '100%', color: 'white' }} onClick={() => setEditMode(false)}>
                                                <ListItem disablePadding>
                                                    <ListItemButton>
                                                        <ListItemIcon>
                                                            {<FaUser style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
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
