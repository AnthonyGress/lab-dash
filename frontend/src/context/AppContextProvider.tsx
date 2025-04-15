import { useMediaQuery } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
import shortid from 'shortid';

import { AppContext } from './AppContext';
import { DashApi } from '../api/dash-api';
import { initialItems } from '../constants/constants';
import { theme } from '../theme/theme';
import { Config, DashboardItem, DashboardLayout, NewItem } from '../types';
import { checkForUpdates } from '../utils/updateChecker';

type Props = {
    children: ReactNode
};

export const AppContextProvider = ({ children }: Props) => {
    const [config, setConfig] = useState<Config>();
    const [dashboardLayout, setDashboardLayout] = useState<DashboardItem[]>(initialItems);
    const [editMode, setEditMode] = useState(false);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

    // Initialize authentication state and check if first time setup
    useEffect(() => {
        const initializeAuth = async () => {
            await checkIfUsersExist();
            await checkLoginStatus();
        };

        initializeAuth();
        // Setup API interceptors
        DashApi.setupAxiosInterceptors();
    }, []);

    // Reset dashboard state when logged out to prevent stale data
    useEffect(() => {
        if (!isLoggedIn) {
            // Reset to initial items when logged out
            console.log('User logged out, resetting dashboard layout');

            // Ensure admin status is reset
            setIsAdmin(false);

            // Reset dashboard to initial state
            setDashboardLayout(initialItems);

            // Force a delayed refresh to ensure state changes are applied
            const timer = setTimeout(() => {
                console.log('Post-logout delayed refresh');
                getLayout().catch(err => console.error('Error refreshing layout after logout:', err));
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isLoggedIn]);

    // Check for updates on initial load and every 6 hours
    useEffect(() => {
        const checkUpdatesPeriodically = async () => {
            await checkForAppUpdates();

            // Set interval to check every 6 hours (6 * 60 * 60 * 1000 ms)
            const intervalId = setInterval(checkForAppUpdates, 60 * 60 * 1000);

            // Clear interval on component unmount
            return () => clearInterval(intervalId);
        };

        checkUpdatesPeriodically();
    }, []);

    // Function to check for updates
    const checkForAppUpdates = async () => {
        try {
            const { updateAvailable: hasUpdate, latestVersion: version, releaseUrl: url } = await checkForUpdates();

            setUpdateAvailable(hasUpdate);
            setLatestVersion(version);
            setReleaseUrl(url);

            console.log(`Update check: ${hasUpdate ? 'Update available' : 'No updates available'}`);
        } catch (error) {
            console.error('Error checking for updates:', error);
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
        console.log('Check login status');

        try {
            // HTTP-only cookies won't show in document.cookie
            // Use the backend endpoint to check cookies
            const cookies = await DashApi.checkCookies();
            console.log('Cookie debug:', cookies);

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
                    console.log('Authenticated with existing token');
                } catch (error) {
                    console.error('Access token validation failed:', error);
                    // Try to refresh the token
                    await refreshTokenAndValidate();
                }
            } else {
                // No access token, but we might have a refresh token
                console.log('No access token found');
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
                console.log('Successfully refreshed token, admin status:', refreshResult.isAdmin);
            } else {
                // If refresh failed, user is not logged in
                setIsLoggedIn(false);
                setUsername(null);
                setIsAdmin(false);
                // Turn off edit mode if it was active
                if (editMode) {
                    setEditMode(false);
                }
                console.log('Token refresh failed');
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

    const getLayout = async () => {
        console.log('Fetching saved layout');

        const res = await DashApi.getConfig(); // Retrieves { desktop: [], mobile: [] }

        if (res) {
            setConfig(res);
            console.log('config', res);

            const selectedLayout = isMobile ? res.layout.mobile : res.layout.desktop;
            if (selectedLayout.length > 0) {
                setDashboardLayout(selectedLayout);
            }
            return selectedLayout;
        }
        return [];
    };

    const saveLayout = async (items: DashboardItem[]) => {

        const existingLayout = await DashApi.getConfig();
        console.log('saving layout', );

        let updatedLayout: DashboardLayout;

        if (existingLayout.layout.mobile.length > 3) {
            console.log('saving mobile layout', items);

            // has no prev mobile layout, duplicate desktop
            updatedLayout = isMobile
                ? { layout: { ...existingLayout.layout, mobile: items } }
                : { layout: { ...existingLayout.layout, desktop: items } };
        } else {
            console.log('desktop + mobile', items);
            updatedLayout = { layout: { desktop: items, mobile: items } };
        }

        console.log('Saving updated layout:', updatedLayout);
        await DashApi.saveConfig(updatedLayout);
    };

    const refreshDashboard = async () => {
        try {
            console.log('updating dashboard');
            const savedLayout = await getLayout();
            console.log('Updated dashboard:', savedLayout);
            setConfig(await DashApi.getConfig());
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    };

    const addItem = async (itemToAdd: NewItem) => {
        console.log('adding item to both desktop and mobile layouts');

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
            // Get the current configuration
            const currentConfig = await DashApi.getConfig();

            // Add the new item to both desktop and mobile layouts
            const updatedLayout = {
                layout: {
                    desktop: [...currentConfig.layout.desktop, newItem],
                    mobile: [...currentConfig.layout.mobile, newItem]
                }
            };

            // Save the updated layout to the backend
            await DashApi.saveConfig(updatedLayout);
            console.log('Item added to both desktop and mobile layouts');
        } catch (error) {
            console.error('Failed to add item to both layouts:', error);
        }
    };

    const updateItem = (id: string, updatedData: Partial<NewItem>) => {
        console.log('Updating item with ID:', id, 'Data:', updatedData);

        try {
            // Get current config first to ensure we have both layouts
            DashApi.getConfig().then(currentConfig => {
                // Find and update the item in desktop layout
                const desktopLayout = currentConfig.layout.desktop.map(item =>
                    item.id === id ? { ...item, ...updatedData } : item
                );

                // Also find and update the same item in mobile layout
                // This ensures changes propagate to both layouts
                const mobileLayout = currentConfig.layout.mobile.map(item =>
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

                DashApi.saveConfig(updatedConfig)
                    .then(() => console.log('Item updated in both desktop and mobile layouts'))
                    .catch(error => console.error('Error saving updated layouts:', error));
            }).catch(error => {
                console.error('Error fetching config for item update:', error);
            });
        } catch (error) {
            console.error('Failed to update item:', error);
        }
    };

    // Helper function to save layout changes to the server
    const saveLayoutToServer = async (items: DashboardItem[]) => {
        try {
            // Get the current configuration
            const currentConfig = await DashApi.getConfig();

            // For layout rearrangements, only update the current device's layout
            const updatedLayout = {
                layout: {
                    desktop: isMobile ? currentConfig.layout.desktop : items,
                    mobile: isMobile ? items : currentConfig.layout.mobile
                }
            };

            // Save the updated layout to the backend
            await DashApi.saveConfig(updatedLayout);
            console.log('Layout saved to server after layout rearrangement');
        } catch (error) {
            console.error('Failed to save layout to server:', error);
        }
    };

    const updateConfig = async (partialConfig: Partial<Config>) => {
        try {
            console.log('updateConfig called with:', partialConfig);

            const updatedConfig: Partial<Config> = { ...partialConfig };

            // Ensure backgroundImage is a File before uploading
            if (partialConfig.backgroundImage && typeof partialConfig.backgroundImage === 'object' && 'name' in partialConfig.backgroundImage) {
                const res = await DashApi.uploadBackgroundImage(partialConfig.backgroundImage);

                console.log('Uploaded background image:', res);

                if (res?.filePath) {
                    updatedConfig.backgroundImage = res.filePath;
                } else {
                    console.error('Failed to upload background image');
                    return;
                }
            }

            // Save updated config to API
            await DashApi.saveConfig(updatedConfig);
            console.log('Config saved to API:', updatedConfig);

            // Update state with only the provided values, ensuring layout is always defined
            setConfig((prev) => {
                if (!prev) {
                    const newConfig = { ...updatedConfig, layout: { desktop: [], mobile: [] } };
                    console.log('Creating new config:', newConfig);
                    return newConfig;
                }

                const mergedConfig = {
                    ...prev,
                    ...updatedConfig,
                    layout: prev.layout ?? { desktop: [], mobile: [] } // Ensures layout is always defined
                };

                console.log('Updating existing config. New state:', mergedConfig);
                return mergedConfig;
            });

        } catch (error) {
            console.error('Error updating config:', error);
        }
    };


    const { Provider } = AppContext;

    return (
        <Provider value={{
            dashboardLayout,
            refreshDashboard,
            saveLayout,
            addItem,
            setDashboardLayout,
            updateItem,
            editMode,
            setEditMode,
            config,
            updateConfig,
            isLoggedIn,
            setIsLoggedIn,
            username,
            setUsername,
            isFirstTimeSetup,
            setIsFirstTimeSetup,
            setupComplete,
            setSetupComplete,
            checkIfUsersExist,
            isAdmin,
            setIsAdmin,
            checkLoginStatus,
            updateAvailable,
            latestVersion,
            releaseUrl,
            checkForAppUpdates
        }}>
            {children}
        </Provider>
    );
};
