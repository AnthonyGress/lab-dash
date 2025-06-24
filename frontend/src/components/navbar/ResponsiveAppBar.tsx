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
import React, { useState } from 'react';
import { FaEdit, FaHeart, FaInfoCircle, FaSync } from 'react-icons/fa';
import { FaArrowRightFromBracket, FaGear, FaHouse, FaTrashCan, FaUser } from 'react-icons/fa6';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { ITEM_TYPE } from '../../types';
import { getAppVersion } from '../../utils/version';
import { AddEditForm } from '../forms/AddEditForm';
import { Logo } from '../Logo';
import { CenteredModal } from '../modals/CenteredModal';
import { UpdateModal } from '../modals/UpdateModal';
import { VersionModal } from '../modals/VersionModal';
import { GlobalSearch } from '../search/GlobalSearch';
import { ToastManager } from '../toast/ToastManager';

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
    const [openEditPageModal, setOpenEditPageModal] = useState(false);
    const [selectedPageForEdit, setSelectedPageForEdit] = useState<any>(null);
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
        updateConfig,
        isLoggedIn,
        username,
        setIsLoggedIn,
        setUsername,
        isAdmin,
        setIsAdmin,
        updateAvailable,
        latestVersion,
        recentlyUpdated,
        handleVersionViewed,
        pages,
        currentPageId,
        switchToPage,
        deletePage
    } = useAppContext();

    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const handleClose = () => setOpenAddModal(false);
    const handleCloseEditPage = () => {
        setOpenEditPageModal(false);
        setSelectedPageForEdit(null);
    };
    const handleOpenEditPage = (page: any) => {
        setSelectedPageForEdit(page);
        setOpenEditPageModal(true);
        handleCloseDrawer();
    };
    const handleCloseUpdateModal = () => setOpenUpdateModal(false);
    const handleCloseVersionModal = async () => {
        setOpenVersionModal(false);
        if (isAdmin && recentlyUpdated) {
            await handleVersionViewed();
        }
    };

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
        navigate('/login', { state: { from: location.pathname } });
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
            ToastManager.success('Logged out');
        } catch (error) {
            console.error('Logout error:', error);
            ToastManager.error('Logout error');
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

    const handlePageUpdate = async (updatedItem: any) => {
        if (!selectedPageForEdit || !config) return;

        try {
            // Get the new page name and adminOnly from the form data
            const newPageName = updatedItem.label;
            const newAdminOnly = updatedItem.adminOnly;

            // Update the page in the config
            const updatedPages = pages.map(page =>
                page.id === selectedPageForEdit.id
                    ? { ...page, name: newPageName, adminOnly: newAdminOnly }
                    : page
            );

            // Update the config with the new pages array
            await updateConfig({ pages: updatedPages });

            // Refresh the dashboard to reflect changes
            await refreshDashboard();

            handleCloseEditPage();
            ToastManager.success('Page updated successfully');
        } catch (error) {
            console.error('Error updating page:', error);
            ToastManager.error('Failed to update page');
        }
    };

    // Helper function to convert page name to URL slug
    const pageNameToSlug = (pageName: string): string => {
        return pageName.toLowerCase().replace(/\s+/g, '-');
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
                            <Box sx={{
                                width: { xs: 'auto', md: '300px', lg: '350px' },
                                flex: { xs: '0 1 auto', md: 'none' },
                                ...styles.center,
                                overflow: 'hidden',
                                minWidth: 0
                            }}>
                                <Logo sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                                <Typography
                                    variant='h5'
                                    noWrap
                                    sx={{
                                        flexGrow: 1,
                                        display: { xs: 'none', md: 'block' },
                                        fontFamily: 'Earth Orbiter',
                                        letterSpacing: '.1rem',
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        minWidth: '120px',
                                        textAlign: 'left',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                    key={`app-title-${config?.title}-${nanoid()}`}
                                >
                                    {config?.title || 'Lab Dash'}
                                </Typography>
                                {/* Mobile */}
                                <Logo sx={{ display: { xs: 'flex', md: 'none' }, ml: 2, mr: 2 }} />
                                <Typography
                                    variant='h5'
                                    sx={{
                                        mr: 2,
                                        flexGrow: 0,
                                        flexShrink: 1,
                                        display: { xs: 'block', md: 'none' },
                                        fontFamily: 'Earth Orbiter',
                                        letterSpacing: '.1rem',
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: 'calc(100vw - 200px)',
                                        minWidth: 0
                                    }}
                                    key={`app-title-mobile-${config?.title}-${nanoid()}`}
                                >
                                    {config?.title || 'Lab Dash'}
                                </Typography>
                            </Box>
                        </Link>
                        { !currentPath.includes('/settings') && config?.search &&
                            <Box sx={{ width: '100%', display: { xs: 'none', md: 'flex' }, justifyContent: 'center', flexGrow: 1 }}>
                                <GlobalSearch />
                            </Box>
                        }

                        <Box sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', width: { md: '300px', lg: '350px' }, flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
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
                                    sx={{
                                        ml: 1,
                                        mr: 2,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderRadius: '50%'
                                    }}
                                >
                                    {updateAvailable ? (
                                        // Only update available badge (red) - given priority
                                        <Badge
                                            color='error'
                                            variant='dot'
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    top: 0,
                                                    right: -5
                                                }
                                            }}
                                        >
                                            <MenuIcon sx={{ color: 'white', fontSize: '2rem' }}/>
                                        </Badge>
                                    ) : recentlyUpdated ? (
                                        // Only recently updated badge (blue)
                                        <Badge
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    backgroundColor: '#2196f3', // Blue color
                                                    top: 0,
                                                    right: -5
                                                }
                                            }}
                                            variant='dot'
                                        >
                                            <MenuIcon sx={{ color: 'white', fontSize: '2rem' }}/>
                                        </Badge>
                                    ) : (
                                        // No badges
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
                                        <ListItem disablePadding>
                                            <ListItemButton
                                                onClick={() => {
                                                    navigate('/');
                                                    handleCloseDrawer();
                                                }}
                                                sx={{
                                                    backgroundColor: (currentPageId === null || currentPageId === '') ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                                                }}
                                            >
                                                <ListItemIcon>
                                                    {<FaHouse style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                </ListItemIcon>
                                                <ListItemText primary={'Home'} />
                                            </ListItemButton>
                                        </ListItem>

                                        {isLoggedIn && isAdmin && (
                                            <ListItem disablePadding>
                                                <ListItemButton onClick={() => {
                                                    setEditMode(true);
                                                    handleCloseDrawer();
                                                }}>
                                                    <ListItemIcon>
                                                        {<FaEdit style={{ color: theme.palette.text.primary, fontSize: 22 }}/> }
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Edit Dashboard'} />
                                                </ListItemButton>
                                            </ListItem>
                                        )}
                                        {/* Pages Section */}
                                        {pages.length > 0 && (
                                            <>
                                                <Divider sx={{ my: 1 }} />
                                                {pages.map((page) => (
                                                    <ListItem key={page.id} disablePadding>
                                                        <ListItemButton
                                                            onClick={() => {
                                                                const slug = pageNameToSlug(page.name);
                                                                navigate(`/${slug}`);
                                                                handleCloseDrawer();
                                                            }}
                                                            sx={{
                                                                backgroundColor: currentPageId === page.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                                                            }}
                                                        >
                                                            <ListItemText primary={page.name} />
                                                            {isLoggedIn && isAdmin && editMode && (
                                                                <>
                                                                    <IconButton
                                                                        size='small'
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenEditPage(page);
                                                                        }}
                                                                        sx={{ ml: 1 }}
                                                                    >
                                                                        <FaEdit style={{ fontSize: 18, color: 'white' }} />
                                                                    </IconButton>
                                                                    <IconButton
                                                                        size='small'
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deletePage(page.id);
                                                                        }}
                                                                        sx={{ ml: 1 }}
                                                                    >
                                                                        <FaTrashCan style={{ fontSize: 18, color: 'white' }} />
                                                                    </IconButton>
                                                                </>
                                                            )}
                                                        </ListItemButton>
                                                    </ListItem>
                                                ))}
                                            </>
                                        )}
                                    </List>

                                    {/* Spacer to push account info to bottom */}
                                    <Box sx={{ flexGrow: 1 }} />

                                    {/* Bottom */}
                                    <List sx={{ mt: 'auto', mb: 1 }}>
                                        <Divider />

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

                                        {/* Donate Option */}
                                        <ListItem disablePadding>
                                            <ListItemButton
                                                onClick={() => {
                                                    handleCloseDrawer();
                                                    window.open('https://buymeacoffee.com/anthonygress', '_blank', 'noopener,noreferrer');
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <FaHeart style={{ color: 'red', fontSize: 22 }} />
                                                </ListItemIcon>
                                                <ListItemText primary={'Donate'} secondary={'Support this project'} slotProps={{
                                                    secondary: {
                                                        color: 'text.primary'
                                                    }
                                                }}/>
                                            </ListItemButton>
                                        </ListItem>

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
                                                    {recentlyUpdated ? (
                                                        <Badge
                                                            sx={{
                                                                '& .MuiBadge-badge': {
                                                                    backgroundColor: '#2196f3', // Blue color
                                                                    top: -2,
                                                                    right: -3
                                                                }
                                                            }}
                                                            variant='dot'
                                                            overlap='circular'
                                                        >
                                                            <FaInfoCircle style={{ color: theme.palette.text.primary, fontSize: 22 }} />
                                                        </Badge>
                                                    ) : (
                                                        <FaInfoCircle style={{ color: theme.palette.text.primary, fontSize: 22 }} />
                                                    )}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Typography>
                                                            {recentlyUpdated ? 'Recently Updated' : 'Version'}
                                                        </Typography>
                                                    }
                                                    secondary={`v${getAppVersion()}`}
                                                    slotProps={{
                                                        secondary: {
                                                            color: 'text.primary'
                                                        }
                                                    }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                        {/* Conditional Account Info */}
                                        {isLoggedIn ? (
                                            <>
                                                {/* User Info */}
                                                <ListItem
                                                    disablePadding
                                                >
                                                    <ListItemButton onClick={handleProfile}>
                                                        <ListItemIcon>
                                                            <Avatar
                                                                sx={{
                                                                    width: 26,
                                                                    height: 26,
                                                                    bgcolor: 'primary.main',
                                                                    fontSize: 18,
                                                                    ml: '-1px'
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
                                            <ListItem disablePadding>
                                                <ListItemButton onClick={() => {handleCloseDrawer(); setEditMode(false); handleLogin();}}>
                                                    <ListItemIcon>
                                                        <FaUser style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                                    </ListItemIcon>
                                                    <ListItemText primary={'Login'} />
                                                </ListItemButton>
                                            </ListItem>
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
                <CenteredModal open={openEditPageModal} handleClose={handleCloseEditPage} title='Edit Page'>
                    <AddEditForm
                        handleClose={handleCloseEditPage}
                        existingItem={selectedPageForEdit ? {
                            id: selectedPageForEdit.id,
                            type: ITEM_TYPE.PAGE,
                            label: selectedPageForEdit.name,
                            url: '',
                            icon: undefined,
                            config: {},
                            adminOnly: selectedPageForEdit.adminOnly || false
                        } : null}
                        onSubmit={handlePageUpdate}
                    />
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
                    handleClose={handleCloseVersionModal}
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
                        ? <Box position='absolute' sx={{ top: { xs: '66px', sm: '77px', md: '70px' }, zIndex: 99, display: 'flex', justifyContent: 'flex-end', width: '100%', px: 3, gap: 2 }}>
                            {/* <Button variant='contained' onClick={handleEditCancel} sx={{ backgroundColor: COLORS.LIGHT_GRAY_TRANSPARENT, color: 'black', borderRadius: '999px', height: '1.7rem', width: '4.5rem' }}>Cancel</Button> */}
                            <Button variant='contained' onClick={handleSave}  sx={{ backgroundColor: COLORS.LIGHT_GRAY_TRANSPARENT, color: 'black', borderRadius: '999px', height: '1.7rem', width: '4.5rem' }}>Done</Button>
                        </Box>
                        :
                        !currentPath.includes('/settings') && config?.search && <Box position='absolute' sx={{ top: { xs: '49px', sm: '58px' }, zIndex: 99, display: { xs: 'flex', md: 'none' }, justifyContent: 'center', width: '100%' }} mt={.5}>
                            <GlobalSearch />
                        </Box>
                }

                <Box sx={{ pb: 1, height: '100%', display: { xs: 'none', sm: 'block', md: 'none' } }} />
                {children}
            </Box>
        </>
    );
};
