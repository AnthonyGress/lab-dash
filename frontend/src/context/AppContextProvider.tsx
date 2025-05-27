import { useMediaQuery } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import shortid from 'shortid';

import { AppContext } from './AppContext';
import { DashApi } from '../api/dash-api';
import { initialItems } from '../constants/constants';
import { theme } from '../theme/theme';
import { Config, DashboardItem, DashboardLayout, NewItem, Page } from '../types';
import { checkForUpdates } from '../utils/updateChecker';
import { getAppVersion } from '../utils/version';

type Props = {
    children: ReactNode
};

export const AppContextProvider = ({ children }: Props) => {
    const [config, setConfig] = useState<Config>();
    const [dashboardLayout, setDashboardLayout] = useState<DashboardItem[]>(initialItems);
    const [editMode, setEditMode] = useState(false);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const location = useLocation();

    // Page management state
    const [currentPageId, setCurrentPageId] = useState<string | null>(null);
    const [pages, setPages] = useState<Page[]>([]);

    // Track if we're in the middle of a move operation to prevent race conditions
    const [isMoveInProgress, setIsMoveInProgress] = useState<boolean>(false);

    // Authentication & setup states
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [username, setUsername] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [isFirstTimeSetup, setIsFirstTimeSetup] = useState<boolean | null>(null);
    const [setupComplete, setSetupComplete] = useState<boolean>(false);

    // Update checker states
    const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

    // Recently updated states
    const [recentlyUpdated, setRecentlyUpdated] = useState<boolean>(false);

    // Initialize authentication state and check if first time setup
    useEffect(() => {
        const initializeAuth = async () => {
            await checkIfUsersExist();
            await checkLoginStatus();
            // Don't load layout here - let URL-based initialization handle it
        };

        initializeAuth();
        // Setup API interceptors
        DashApi.setupAxiosInterceptors();
    }, []);

    // Handle URL-based page initialization on app load/refresh
    useEffect(() => {
        const initializePageFromURL = async () => {
            const pathname = location.pathname;

            // Always load config first to get pages
            const freshConfig = await DashApi.getConfig();
            if (freshConfig) {
                setConfig(freshConfig);
                if (freshConfig.pages) {
                    setPages(freshConfig.pages);
                }

                // Determine the target page ID based on URL
                let targetPageId: string | null = null;
                let selectedLayout: DashboardItem[] = [];

                if (pathname === '/') {
                    // Home page
                    targetPageId = null;
                    selectedLayout = isMobile ? freshConfig.layout.mobile : freshConfig.layout.desktop;
                } else if (pathname.startsWith('/') && !pathname.includes('/settings') && !pathname.includes('/login')) {
                    // Page route
                    const pageName = pathname.slice(1); // Remove leading slash

                    // Find the page by slug
                    const page = freshConfig.pages?.find(p =>
                        p.name.toLowerCase().replace(/\s+/g, '-') === pageName.toLowerCase()
                    );

                    if (page) {
                        targetPageId = page.id;
                        selectedLayout = isMobile ? page.layout.mobile : page.layout.desktop;
                    } else {
                        // Page doesn't exist, redirect to home
                        navigate('/', { replace: true });
                        targetPageId = null;
                        selectedLayout = isMobile ? freshConfig.layout.mobile : freshConfig.layout.desktop;
                    }
                }

                // Set the page ID and layout
                setCurrentPageId(targetPageId);
                setDashboardLayout(selectedLayout || []);
            }
        };

        // Only run this after initial auth setup and if we haven't initialized yet
        if (isFirstTimeSetup !== null && config === undefined) {
            initializePageFromURL();
        }
    }, [isFirstTimeSetup, config, navigate, isMobile]);

    // Handle URL changes after initial setup (for navigation between pages)
    useEffect(() => {
        const handleURLChange = () => {
            // Only handle URL changes after config is loaded
            if (!config || !pages.length || isFirstTimeSetup === null) return;

            // Don't override layout if we're in the middle of a move operation
            if (isMoveInProgress) return;

            const pathname = location.pathname;

            if (pathname === '/') {
                // Home page
                if (currentPageId !== null) {
                    setCurrentPageId(null);
                    const selectedLayout = isMobile ? config.layout.mobile : config.layout.desktop;
                    setDashboardLayout(selectedLayout || []);
                }
            } else if (pathname.startsWith('/') && !pathname.includes('/settings') && !pathname.includes('/login')) {
                // Page route
                const pageName = pathname.slice(1); // Remove leading slash

                // Find the page by slug
                const page = pages.find(p =>
                    p.name.toLowerCase().replace(/\s+/g, '-') === pageName.toLowerCase()
                );

                if (page && currentPageId !== page.id) {
                    setCurrentPageId(page.id);
                    const selectedLayout = isMobile ? page.layout.mobile : page.layout.desktop;
                    setDashboardLayout(selectedLayout || []);
                } else if (!page) {
                    // Page doesn't exist, redirect to home
                    navigate('/', { replace: true });
                }
            }
        };

        handleURLChange();
    }, [location.pathname, config, pages, currentPageId, isFirstTimeSetup, isMobile, navigate, isMoveInProgress]);

    // Handle dashboard state based on login status
    useEffect(() => {
        // Don't override layout if we're in the middle of a move operation
        if (isMoveInProgress) return;

        if (!isLoggedIn) {
            // Ensure admin status is reset
            setIsAdmin(false);

            // Load config items but filter out admin-only items when logged out
            if (config !== undefined) {
                const loadLayoutForCurrentPage = () => {
                    if (currentPageId && config.pages) {
                        const currentPage = config.pages.find(page => page.id === currentPageId);
                        if (currentPage) {
                            const selectedLayout = isMobile ? currentPage.layout.mobile : currentPage.layout.desktop;
                            setDashboardLayout(selectedLayout || []);
                            return;
                        }
                    }
                    // Load main dashboard layout
                    const selectedLayout = isMobile ? config.layout.mobile : config.layout.desktop;
                    setDashboardLayout(selectedLayout || []);
                };

                loadLayoutForCurrentPage();
            } else {
                // If no config is loaded yet, show initial items as fallback
                setDashboardLayout(initialItems);
            }
        } else if (config !== undefined && isLoggedIn) {
            // When user logs in, load the dashboard for the current page
            // Only if config has been loaded to avoid race conditions
            const loadLayoutForCurrentPage = () => {
                if (currentPageId && config.pages) {
                    const currentPage = config.pages.find(page => page.id === currentPageId);
                    if (currentPage) {
                        const selectedLayout = isMobile ? currentPage.layout.mobile : currentPage.layout.desktop;
                        setDashboardLayout(selectedLayout || []);
                        return;
                    }
                }
                // Load main dashboard layout
                const selectedLayout = isMobile ? config.layout.mobile : config.layout.desktop;
                setDashboardLayout(selectedLayout || []);
            };

            loadLayoutForCurrentPage();
        }
    }, [isLoggedIn, currentPageId, config, isMobile, isMoveInProgress]);

    // Check for updates on initial load and every 6 hours
    useEffect(() => {
        const checkUpdatesPeriodically = async () => {
            await checkForAppUpdates();

            // Set interval to check every 6 hours (6 * 60 * 60 * 1000 ms)
            const intervalId = setInterval(checkForAppUpdates, 6 * 60 * 60 * 1000);

            // Clear interval on component unmount
            return () => clearInterval(intervalId);
        };

        checkUpdatesPeriodically();
    }, []);

    // Check if the app was recently updated
    useEffect(() => {
        const checkForRecentUpdate = async () => {
            // Only proceed if we have the config
            if (!config) return;

            const currentVersion = getAppVersion();

            // Get the last seen version from config, may be undefined
            const lastSeenVersion = config.lastSeenVersion;

            // If no stored version, or versions differ, the app was updated
            if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
                console.log('App was updated from', lastSeenVersion, 'to', currentVersion);
                setRecentlyUpdated(true);
            } else {
                setRecentlyUpdated(false);
            }
        };

        checkForRecentUpdate();
    }, [config]);

    // Function to check for updates
    const checkForAppUpdates = async () => {
        try {
            const { updateAvailable: hasUpdate, latestVersion: version, releaseUrl: url } = await checkForUpdates();

            setUpdateAvailable(hasUpdate);
            setLatestVersion(version);
            setReleaseUrl(url);

        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    };

    // Function to mark the current version as viewed
    const handleVersionViewed = async (): Promise<void> => {
        if (!isAdmin) return; // Only admins can update config

        try {
            const currentVersion = getAppVersion();

            // Update config with the current version as last seen
            await updateConfig({ lastSeenVersion: currentVersion });

            // Update local state
            setRecentlyUpdated(false);
        } catch (error) {
            console.error('Error updating last seen version:', error);
        }
    };

    // Check if users exist in the system
    const checkIfUsersExist = async () => {
        try {
            const hasUsers = await DashApi.checkIfUsersExist();
            setIsFirstTimeSetup(!hasUsers);
        } catch (error) {
            console.error('Error checking for existing users:', error);
            // If there's an error, assume it's not first time setup
            setIsFirstTimeSetup(false);
        }
    };

    // Check if user is logged in based on cookies
    const checkLoginStatus = async () => {

        try {
            // HTTP-only cookies won't show in document.cookie
            // Use the backend endpoint to check cookies
            const cookies = await DashApi.checkCookies();

            // Check if access_token cookie exists from the server response
            const hasAccessToken = cookies && cookies.hasAccessToken;

            if (hasAccessToken) {
                // If we have an access token, try to use it
                try {
                    // Check if user is admin to verify token is still valid
                    const isAdminRes = await DashApi.checkIsAdmin();
                    const storedUsername = localStorage.getItem('username');
                    setUsername(storedUsername);
                    setIsAdmin(isAdminRes);
                    setIsLoggedIn(true);
                } catch (error) {
                    console.error('Access token validation failed:', error);
                    // Try to refresh the token
                    await refreshTokenAndValidate();
                }
            } else {
                // No access token, but we might have a refresh token
                // Server-side token refresh attempt
                await refreshTokenAndValidate();
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            setIsLoggedIn(false);
            setUsername(null);
            setIsAdmin(false);
        }
    };

    // Helper function to refresh token and validate login
    const refreshTokenAndValidate = async () => {
        try {
            // Try to refresh the token
            const refreshResult = await DashApi.refreshToken();

            if (refreshResult.success) {
                // If token refreshed successfully, get the stored username
                const storedUsername = localStorage.getItem('username');

                // Update state based on new token, using isAdmin from refresh response
                setUsername(storedUsername);
                setIsAdmin(refreshResult.isAdmin || false);
                setIsLoggedIn(true);
            } else {
                // If refresh failed, user is not logged in
                setIsLoggedIn(false);
                setUsername(null);
                setIsAdmin(false);
                // Turn off edit mode if it was active
                if (editMode) {
                    setEditMode(false);
                }
            }
        } catch (error) {
            console.error('Error during token refresh:', error);
            setIsLoggedIn(false);
            setUsername(null);
            setIsAdmin(false);
            // Turn off edit mode if it was active
            if (editMode) {
                setEditMode(false);
            }
        }
    };

    const getLayout = async (pageId?: string | null) => {
        const res = await DashApi.getConfig(); // Retrieves { desktop: [], mobile: [] }

        if (res) {
            setConfig(res);

            // Set pages from config
            if (res.pages) {
                setPages(res.pages);
            }

            // Don't update layout if we're in the middle of a move operation
            if (isMoveInProgress) {
                return [];
            }

            // Use provided pageId or fall back to currentPageId
            const targetPageId = pageId !== undefined ? pageId : currentPageId;

            // If we're on a specific page, load that page's layout
            if (targetPageId) {
                const currentPage = res.pages?.find(page => page.id === targetPageId);
                if (currentPage) {
                    const selectedLayout = isMobile ? currentPage.layout.mobile : currentPage.layout.desktop;
                    setDashboardLayout(selectedLayout);
                    return selectedLayout;
                }
            }

            // Otherwise load the main dashboard layout
            const selectedLayout = isMobile ? res.layout.mobile : res.layout.desktop;
            setDashboardLayout(selectedLayout || []);
            return selectedLayout || [];
        }
        return [];
    };

    const saveLayout = async (items: DashboardItem[]) => {
        // Use existing config state instead of fetching again
        if (!config) {
            console.error('No config available for saving layout');
            return;
        }

        // If we're on a specific page, save to that page
        if (currentPageId) {
            const updatedPages = config.pages?.map(page => {
                if (page.id === currentPageId) {
                    return {
                        ...page,
                        layout: isMobile
                            ? { ...page.layout, mobile: items }
                            : { ...page.layout, desktop: items }
                    };
                }
                return page;
            }) || [];

            await DashApi.saveConfig({ pages: updatedPages });
            return;
        }

        // Otherwise save to main dashboard
        let updatedLayout: DashboardLayout;

        if (config.layout.mobile.length > 3) {
            // has no prev mobile layout, duplicate desktop
            updatedLayout = isMobile
                ? { layout: { ...config.layout, mobile: items } }
                : { layout: { ...config.layout, desktop: items } };
        } else {
            updatedLayout = { layout: { desktop: items, mobile: items } };
        }

        await DashApi.saveConfig(updatedLayout);
    };

    const refreshDashboard = async () => {
        try {
            // getLayout() already calls getConfig() and setConfig(), so we don't need to call it again
            await getLayout();
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    };

    const addItem = async (itemToAdd: NewItem) => {

        const newItem: DashboardItem = {
            id: `item-${shortid.generate()}`,
            label: itemToAdd.label,
            icon: itemToAdd.icon,
            url: itemToAdd.url,
            type: itemToAdd.type,
            showLabel: itemToAdd.showLabel,
            adminOnly: itemToAdd.adminOnly,
            config: itemToAdd.config
        };

        // Add to current view's layout (affects UI immediately)
        setDashboardLayout((prevItems) => [...prevItems, newItem]);

        try {
            // Use existing config state instead of fetching again
            if (!config) {
                console.error('No config available for adding item');
                return;
            }

            // If we're on a specific page, add to that page
            if (currentPageId) {
                const updatedPages = config.pages?.map(page => {
                    if (page.id === currentPageId) {
                        return {
                            ...page,
                            layout: {
                                desktop: [...page.layout.desktop, newItem],
                                mobile: [...page.layout.mobile, newItem]
                            }
                        };
                    }
                    return page;
                }) || [];

                await DashApi.saveConfig({ pages: updatedPages });
                return;
            }

            // Otherwise add to main dashboard
            const updatedLayout = {
                layout: {
                    desktop: [...config.layout.desktop, newItem],
                    mobile: [...config.layout.mobile, newItem]
                }
            };

            // Save the updated layout to the backend
            await DashApi.saveConfig(updatedLayout);
        } catch (error) {
            console.error('Failed to add item to both layouts:', error);
        }
    };

    const updateItem = async (id: string, updatedData: Partial<NewItem>) => {

        try {
            // Use existing config state instead of fetching again
            if (!config) {
                console.error('No config available for updating item');
                return;
            }

            // If we're on a specific page, update that page
            if (currentPageId) {
                const updatedPages = config.pages?.map(page => {
                    if (page.id === currentPageId) {
                        const desktopLayout = page.layout.desktop.map(item =>
                            item.id === id ? { ...item, ...updatedData } : item
                        );
                        const mobileLayout = page.layout.mobile.map(item =>
                            item.id === id ? { ...item, ...updatedData } : item
                        );

                        // Update local dashboard layout for immediate UI update
                        setDashboardLayout(isMobile ? mobileLayout : desktopLayout);

                        return {
                            ...page,
                            layout: {
                                desktop: desktopLayout,
                                mobile: mobileLayout
                            }
                        };
                    }
                    return page;
                }) || [];

                await DashApi.saveConfig({ pages: updatedPages });
                return;
            }

            // Otherwise update main dashboard
            const desktopLayout = config.layout.desktop.map(item =>
                item.id === id ? { ...item, ...updatedData } : item
            );

            const mobileLayout = config.layout.mobile.map(item =>
                item.id === id ? { ...item, ...updatedData } : item
            );

            // Update local dashboard layout for immediate UI update
            setDashboardLayout(isMobile ? mobileLayout : desktopLayout);

            // Save both updated layouts to the server
            const updatedConfig = {
                layout: {
                    desktop: desktopLayout,
                    mobile: mobileLayout
                }
            };

            await DashApi.saveConfig(updatedConfig);
        } catch (error) {
            console.error('Failed to update item:', error);
        }
    };

    // Helper function to save layout changes to the server
    const saveLayoutToServer = async (items: DashboardItem[]) => {
        try {
            // Use existing config state instead of fetching again
            if (!config) {
                console.error('No config available for saving layout to server');
                return;
            }

            // For layout rearrangements, only update the current device's layout
            const updatedLayout = {
                layout: {
                    desktop: isMobile ? config.layout.desktop : items,
                    mobile: isMobile ? items : config.layout.mobile
                }
            };

            // Save the updated layout to the backend
            await DashApi.saveConfig(updatedLayout);
        } catch (error) {
            console.error('Failed to save layout to server:', error);
        }
    };

    const updateConfig = async (partialConfig: Partial<Config>) => {
        try {

            const updatedConfig: Partial<Config> = { ...partialConfig };

            // Ensure backgroundImage is a File before uploading
            if (partialConfig.backgroundImage && typeof partialConfig.backgroundImage === 'object' && 'name' in partialConfig.backgroundImage) {
                const res = await DashApi.uploadBackgroundImage(partialConfig.backgroundImage);


                if (res?.filePath) {
                    updatedConfig.backgroundImage = res.filePath;
                } else {
                    console.error('Failed to upload background image');
                    return;
                }
            }

            // Save updated config to API
            await DashApi.saveConfig(updatedConfig);

            // Update state with only the provided values, ensuring layout is always defined
            setConfig((prev) => {
                if (!prev) {
                    const newConfig = { ...updatedConfig, layout: { desktop: [], mobile: [] } };
                    return newConfig;
                }

                const mergedConfig = {
                    ...prev,
                    ...updatedConfig,
                    layout: prev.layout ?? { desktop: [], mobile: [] } // Ensures layout is always defined
                };

                return mergedConfig;
            });

        } catch (error) {
            console.error('Error updating config:', error);
        }
    };

    // Page management functions
    const addPage = async (name: string) => {
        const newPage: Page = {
            id: `page-${shortid.generate()}`,
            name,
            layout: {
                desktop: [],
                mobile: []
            }
        };

        try {
            // Use existing config state instead of fetching again
            if (!config) {
                console.error('No config available for adding page');
                return;
            }

            const updatedPages = [...(config.pages || []), newPage];

            await DashApi.saveConfig({ pages: updatedPages });
            setPages(updatedPages);
        } catch (error) {
            console.error('Failed to add page:', error);
        }
    };

    const deletePage = async (pageId: string) => {
        // Find the page to get its name for the confirmation dialog
        const pageToDelete = pages.find(page => page.id === pageId);
        const pageName = pageToDelete?.name || 'this page';

        const { PopupManager } = await import('../components/modals/PopupManager');

        PopupManager.deleteConfirmation({
            title: `Delete "${pageName}"?`,
            text: 'This action cannot be undone. All items on this page will be permanently deleted.',
            confirmAction: async () => {
                try {
                    // Use existing config state instead of fetching again
                    if (!config) {
                        console.error('No config available for deleting page');
                        PopupManager.failure('Failed to delete page. Please try again.');
                        return;
                    }

                    const updatedPages = (config.pages || []).filter(page => page.id !== pageId);

                    await DashApi.saveConfig({ pages: updatedPages });
                    setPages(updatedPages);

                    // If we're currently on the deleted page, switch to main dashboard
                    if (currentPageId === pageId) {
                        setCurrentPageId(null);
                        navigate('/', { replace: true });
                        await refreshDashboard();
                    }

                    PopupManager.success(`Page "${pageName}" deleted successfully`);
                } catch (error) {
                    console.error('Failed to delete page:', error);
                    PopupManager.failure('Failed to delete page. Please try again.');
                }
            }
        });
    };

    // Helper function to convert page name to URL slug
    const pageNameToSlug = (pageName: string): string => {
        return pageName.toLowerCase().replace(/\s+/g, '-');
    };

    // Function to move an item from one page to another
    const moveItemToPage = async (itemId: string, targetPageId: string | null) => {
        try {
            console.log(`Moving item ${itemId} from page ${currentPageId} to page ${targetPageId}`);

            // Set move in progress flag to prevent race conditions with URL changes
            setIsMoveInProgress(true);

            // Get fresh config from server
            const serverConfig = await DashApi.getConfig();
            console.log('Server config:', serverConfig);

            // Find the item in the current layout
            let itemToMove: DashboardItem | null = null;

            // Check if item is in main dashboard
            if (currentPageId === null) {
                itemToMove = serverConfig.layout.desktop.find(item => item.id === itemId) ||
                           serverConfig.layout.mobile.find(item => item.id === itemId) || null;
                console.log('Found item in main dashboard:', itemToMove);
            } else {
                // Check if item is in current page
                const currentPage = serverConfig.pages?.find(page => page.id === currentPageId);
                if (currentPage) {
                    itemToMove = currentPage.layout.desktop.find(item => item.id === itemId) ||
                               currentPage.layout.mobile.find(item => item.id === itemId) || null;
                    console.log('Found item in current page:', itemToMove);
                }
            }

            if (!itemToMove) {
                console.error('Item not found');
                const { PopupManager } = await import('../components/modals/PopupManager');
                PopupManager.failure('Item not found');
                return;
            }

            // Create a deep copy of the item to move
            const itemCopy = JSON.parse(JSON.stringify(itemToMove));
            console.log('Item copy created:', itemCopy);

            // Prepare the update payload
            let updatePayload: any = {};

            // Remove item from source and add to target
            if (currentPageId === null) {
                // Moving from main dashboard
                const updatedDesktop = serverConfig.layout.desktop.filter((item: any) => item.id !== itemId);
                const updatedMobile = serverConfig.layout.mobile.filter((item: any) => item.id !== itemId);

                if (targetPageId === null) {
                    // Moving within main dashboard (shouldn't happen, but handle it)
                    updatePayload.layout = {
                        desktop: [...updatedDesktop, itemCopy],
                        mobile: [...updatedMobile, itemCopy]
                    };
                } else {
                    // Moving from main dashboard to a page
                    const updatedPages = (serverConfig.pages || []).map((page: any) => {
                        if (page.id === targetPageId) {
                            return {
                                ...page,
                                layout: {
                                    desktop: [...page.layout.desktop, itemCopy],
                                    mobile: [...page.layout.mobile, itemCopy]
                                }
                            };
                        }
                        return page;
                    });

                    updatePayload = {
                        layout: {
                            desktop: updatedDesktop,
                            mobile: updatedMobile
                        },
                        pages: updatedPages
                    };
                }
            } else {
                // Moving from a page
                if (targetPageId === null) {
                    // Moving from page to main dashboard
                    const updatedPages = (serverConfig.pages || []).map((page: any) => {
                        if (page.id === currentPageId) {
                            return {
                                ...page,
                                layout: {
                                    desktop: page.layout.desktop.filter((item: any) => item.id !== itemId),
                                    mobile: page.layout.mobile.filter((item: any) => item.id !== itemId)
                                }
                            };
                        }
                        return page;
                    });

                    updatePayload = {
                        layout: {
                            desktop: [...serverConfig.layout.desktop, itemCopy],
                            mobile: [...serverConfig.layout.mobile, itemCopy]
                        },
                        pages: updatedPages
                    };
                } else {
                    // Moving from one page to another page
                    const updatedPages = (serverConfig.pages || []).map((page: any) => {
                        if (page.id === currentPageId) {
                            // Remove from source page
                            return {
                                ...page,
                                layout: {
                                    desktop: page.layout.desktop.filter((item: any) => item.id !== itemId),
                                    mobile: page.layout.mobile.filter((item: any) => item.id !== itemId)
                                }
                            };
                        } else if (page.id === targetPageId) {
                            // Add to target page
                            return {
                                ...page,
                                layout: {
                                    desktop: [...page.layout.desktop, itemCopy],
                                    mobile: [...page.layout.mobile, itemCopy]
                                }
                            };
                        }
                        return page;
                    });

                    updatePayload = {
                        pages: updatedPages
                    };
                }
            }

            console.log('Update payload:', updatePayload);

            // Save the updated config
            await DashApi.saveConfig(updatePayload);
            console.log('Config saved successfully');

            // Update local state immediately - remove from current view
            setDashboardLayout(prevLayout => {
                const filtered = prevLayout.filter(item => item.id !== itemId);
                console.log('Updated local dashboard layout:', filtered);
                return filtered;
            });

            // Use getLayout() which already fetches config and updates state
            await getLayout();

            const { ToastManager } = await import('../components/toast/ToastManager');
            const targetName = targetPageId === null ? 'Home' : pages.find(p => p.id === targetPageId)?.name || 'Unknown Page';
            const itemName = itemToMove?.label || itemToMove?.type || 'Item';

            // Create navigation action for the toast
            const navigationAction = {
                label: targetPageId === null ? 'Go to Home' : `Go to ${targetName}`,
                onClick: () => {
                    if (targetPageId === null) {
                        // Navigate to home
                        navigate('/');
                    } else {
                        // Find the page and navigate to its URL
                        const targetPage = pages.find(p => p.id === targetPageId);
                        if (targetPage) {
                            const slug = pageNameToSlug(targetPage.name);
                            navigate(`/${slug}`);
                        }
                    }
                }
            };

            ToastManager.success(`${itemName} moved to page - ${targetName}`, 5000, navigationAction);

        } catch (error) {
            console.error('Failed to move item:', error);
            const { ToastManager } = await import('../components/toast/ToastManager');
            ToastManager.error('Failed to move item. Please try again.');
        } finally {
            // Clear move in progress flag
            setIsMoveInProgress(false);
        }
    };

    const switchToPage = async (pageId: string) => {
        const targetPageId = pageId === '' ? null : pageId;

        // Update URL based on page
        if (targetPageId === null) {
            // Navigate to home
            if (location.pathname !== '/') {
                navigate('/', { replace: true });
            }
        } else {
            // Find the page and navigate to its URL
            const page = pages.find(p => p.id === targetPageId);
            if (page) {
                const slug = pageNameToSlug(page.name);
                if (location.pathname !== `/${slug}`) {
                    navigate(`/${slug}`, { replace: true });
                }
            }
        }

        // Update the current page ID
        setCurrentPageId(targetPageId);

        // Load the layout for the target page using the updated getLayout function
        await getLayout(targetPageId);
    };

    const { Provider } = AppContext;

    return (
        <Provider value={{
            dashboardLayout,
            setDashboardLayout,
            refreshDashboard,
            saveLayout,
            addItem,
            updateItem,
            editMode,
            setEditMode,
            config,
            updateConfig,
            // Page management
            currentPageId,
            setCurrentPageId,
            pages,
            addPage,
            deletePage,
            switchToPage,
            pageNameToSlug,
            moveItemToPage,
            // Authentication states
            isLoggedIn,
            setIsLoggedIn,
            username,
            setUsername,
            isAdmin,
            setIsAdmin,
            isFirstTimeSetup,
            setIsFirstTimeSetup,
            setupComplete,
            setSetupComplete,
            checkIfUsersExist,
            checkLoginStatus,
            // Update states
            updateAvailable,
            latestVersion,
            releaseUrl,
            checkForAppUpdates,
            // Recently updated states
            recentlyUpdated,
            handleVersionViewed
        }}>
            {children}
        </Provider>
    );
};
