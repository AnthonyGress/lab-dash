import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import shortid from 'shortid';

import { ToastManager } from '../components/toast/ToastManager';
import { BACKEND_URL } from '../constants/constants';
import { realtime } from '../realtime/socket';
import { Config, DashboardItem, Icon, UploadImageResponse } from '../types';
import { type BulkIconResponse, type BulkWidgetResponse, type CacheClearResponse, type CacheStatsResponse } from '../types/bulk-loading';
import { GroupItem } from '../types/group';

interface SignupResponse {
  message: string;
  username: string;
}

interface LoginResponse {
  message: string;
  username: string;
  isAdmin: boolean;
}

export class DashApi {
    // Authentication methods
    public static async signup(username: string, password: string): Promise<SignupResponse> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/signup`, {
                username,
                password
            });

            return res.data;
        } catch (error: any) {
            if (error.response) {
                throw new Error(error.response.data.message || 'Signup failed');
            } else {
                throw new Error('Network error occurred during signup');
            }
        }
    }

    public static async login(username: string, password: string): Promise<LoginResponse> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/login`,
                {
                    username,
                    password
                },
                {
                    withCredentials: true // Keep credentials for login
                }
            );

            // Store username for display purposes
            if (res.data && res.data.username) {
                localStorage.setItem('username', res.data.username);
            }
            console.log('login successful');


            return res.data;
        } catch (error: any) {
            if (error.response) {
                throw new Error(error.response.data.message || 'Login failed');
            } else {
                throw new Error('Network error occurred during login');
            }
        }
    }

    public static async logout(): Promise<void> {
        try {
            console.log('Logging out user...');

            // Call the logout endpoint to clear cookies on the server
            await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });

            // Clear username from localStorage
            localStorage.removeItem('username');
            console.log('Logged out successfully');

            // Verify cookies are cleared
            await this.checkCookies();

            // Force page reload to ensure state is reset
            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
            // Even if the API call fails, clear local storage and cookies
            localStorage.removeItem('username');
            // Force page reload to ensure state is reset
            window.location.reload();
        }
    }

    // Create an axios instance interceptor
    public static setupAxiosInterceptors(): void {
        // Set withCredentials globally for all API requests
        axios.defaults.withCredentials = true;

        // Request interceptor
        axios.interceptors.request.use(
            async (config) => {
                // Ensure credentials are sent for all API requests
                config.withCredentials = true;
                // Lets the server tell this tab's own saves apart from changes made elsewhere
                if (config.url?.startsWith(`${BACKEND_URL}/api/`)) {
                    config.headers.set('X-Client-Id', realtime.clientId);
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor to handle 401 errors
        axios.interceptors.response.use(
            response => response,
            async (error) => {
                const originalRequest = error.config;

                // Only handle 401 errors for our own auth system, not external services
                // Check if this is a 401 from our backend API
                const isOurBackendApi = originalRequest.url?.includes(BACKEND_URL);

                // List of external service routes that proxy to other applications. These should NOT trigger a logout if they return 401/403
                const isExternalServiceRoute =
                    originalRequest.url?.includes('/api/radarr') ||
                    originalRequest.url?.includes('/api/sonarr') ||
                    originalRequest.url?.includes('/api/jellyfin') ||
                    originalRequest.url?.includes('/api/jellyseerr') ||
                    originalRequest.url?.includes('/api/notes');

                const isAuthRoute = originalRequest.url?.includes('api/auth/login') ||
                    originalRequest.url?.includes('api/auth/refresh');

                // Only attempt token refresh if:
                // 1. It's a 401 error
                // 2. We haven't already tried to retry this request
                // 3. It's from our backend API
                // 4. It's NOT from an external service route
                // 5. It's NOT from an auth route (to prevent infinite loops)
                if (error.response?.status === 401 &&
                    !originalRequest._retry &&
                    isOurBackendApi &&
                    !isExternalServiceRoute &&
                    !isAuthRoute) {

                    originalRequest._retry = true;

                    try {
                        // Try to refresh the token
                        const refreshResult = await this.refreshToken();

                        if (refreshResult.success) {
                            console.log('Token refreshed, retrying original request');
                            // If refresh was successful, retry the original request
                            return axios(originalRequest);
                        } else {
                            console.log('Token refresh failed, logging out user');
                            // The refreshToken method will handle the logout
                            return Promise.reject(error);
                        }
                    } catch (refreshError) {
                        console.error('Error during token refresh:', refreshError);
                        // The refreshToken method will handle the logout
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    // Helper method to redirect to login page
    private static redirectToLogin(): void {
        // Check if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
    }

    // Existing methods - without auth headers for public endpoints
    public static async getIconList(): Promise<Icon[]> {
        const res = await axios.get(`${BACKEND_URL}/icon-list`);
        return res.data?.icons;
    }

    public static async getCustomIcons(): Promise<Icon[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/app-shortcut/custom-icons`);
            return res.data?.icons || [];
        } catch (error) {
            console.error('Error fetching custom icons:', error);
            return [];
        }
    }

    public static async getIcon(iconPath: string): Promise<string> {
        const res = await axios.get(`${BACKEND_URL}/icons/${iconPath.replace('./assets/', '')}`);
        return res.data;
    }

    // Bulk load all icons used in the dashboard
    public static async getAllActiveIcons(items: DashboardItem[]): Promise<{ [key: string]: string }> {
        try {
            // Extract all icon paths from dashboard items
            const iconPaths = new Set<string>();

            const extractIconPaths = (dashboardItems: DashboardItem[]) => {
                dashboardItems.forEach(item => {
                    // Extract icon from the main item
                    if (item.icon?.path) {
                        iconPaths.add(item.icon.path);
                    }

                    // Handle group widget items (items inside groups)
                    if ((item.type === 'GROUP_WIDGET' || item.type === 'group-widget') && item.config?.items) {
                        item.config.items.forEach((groupItem: GroupItem) => {
                            if (groupItem.icon) {
                                iconPaths.add(groupItem.icon);
                            }
                        });
                    }

                    // Handle app shortcuts that might have icons in their config
                    if (item.type === 'APP_SHORTCUT' && item.config?.icon) {
                        iconPaths.add(item.config.icon);
                    }

                    // Handle any other widget types that might have icons in their config
                    if (item.config?.icon) {
                        iconPaths.add(item.config.icon);
                    }
                });
            };

            extractIconPaths(items);

            // Make bulk request for all icons using the new cached method
            const iconPathsArray = Array.from(iconPaths);
            if (iconPathsArray.length === 0) {
                return {};
            }

            const response = await this.bulkLoadIcons(iconPathsArray);

            return response.icons || {};
        } catch (error) {
            console.error('Error fetching icons in bulk:', error);
            return {};
        }
    }

    // Bulk load initial widget data for faster startup
    public static async getBulkWidgetData(items: DashboardItem[]): Promise<{ [key: string]: any }> {
        try {
            // Extract widget configurations that need initial data
            const widgetConfigs = items
                .filter(item =>
                    item.type &&
                    !['APP_SHORTCUT', 'BLANK_APP', 'BLANK_ROW'].includes(item.type)
                )
                .map(item => ({
                    id: item.id,
                    type: item.type,
                    config: item.config
                }));

            if (widgetConfigs.length === 0) {
                return {};
            }

            const res = await axios.post(`${BACKEND_URL}/api/widgets/bulk-data`, {
                widgets: widgetConfigs
            });

            return res.data?.widgetData || {};
        } catch (error) {
            console.error('Error fetching bulk widget data:', error);
            return {};
        }
    }

    // These endpoints require authentication
    public static async getConfig(): Promise<Config> {
        // Explicitly set withCredentials for this request
        const res = await axios.get(`${BACKEND_URL}/api/config`, {
            withCredentials: true
        });
        return res.data;
    }

    public static async exportConfig(): Promise<void> {
        try {
            // Use axios to get the file as a blob
            const response = await axios.get(`${BACKEND_URL}/api/config/export`, {
                responseType: 'blob',
                withCredentials: true
            });

            // Create a URL for the blob
            const url = window.URL.createObjectURL(new Blob([response.data]));

            // Get the filename from headers if available, or use default
            const contentDisposition = response.headers['content-disposition'];
            let filename = 'lab-dash-backup.json';

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename=(.+)/);
                if (filenameMatch && filenameMatch.length === 2) {
                    filename = filenameMatch[1];
                }
            }

            // Create a link element to trigger the download
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);

            // Trigger the download
            link.click();

            // Clean up
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export configuration:', error);
            throw error;
        }
    }

    public static async saveConfig(config: Partial<Config>): Promise<Config | null> {
        try {
            // Explicitly set withCredentials for this request
            // Clone and stringify-parse the config to ensure proper serialization of complex objects
            const preparedConfig = JSON.parse(JSON.stringify(config));
            const response = await axios.post(`${BACKEND_URL}/api/config`, preparedConfig, {
                withCredentials: true
            });

            // Return the updated config from the backend response
            return response.data.updatedConfig || null;
        } catch (error) {
            console.error('Failed to save layout:', error);
            // Saves used to fail silently, leaving the dashboard looking saved until the next reload
            ToastManager.error(
                axios.isAxiosError(error) && error.response?.status === StatusCodes.REQUEST_TOO_LONG
                    ? 'Dashboard is too large to save'
                    : 'Failed to save changes. Please try again.'
            );
            throw error; // Rethrow to allow handling in the UI
        }
    }

    public static async importConfig(configData: Config): Promise<boolean> {
        try {
            // Send the complete config object to the import endpoint
            const response = await axios.post(`${BACKEND_URL}/api/config/import`, configData, {
                withCredentials: true // Ensure credentials are sent for authentication
            });

            return true;
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw error; // Rethrow to allow handling in the UI
        }
    }

    public static async getSystemInformation(networkInterface?: string): Promise<any> {
        const res = await axios.get(`${BACKEND_URL}/api/system`, {
            params: networkInterface ? { networkInterface } : undefined
        });
        if (res.status === StatusCodes.OK) {
            return res.data;
        }
        return null;
    }

    // Sonarr API methods
    public static async getSonarrQueue(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/sonarr/queue`, {
                params: { itemId },
                timeout: 10000
            });
            return res.data.data || [];
        } catch (error) {
            console.error('Error fetching Sonarr queue:', error);
            throw error;
        }
    }

    public static async removeSonarrQueueItem(itemId: string, queueItemId: string, removeFromClient: boolean = true, blocklist: boolean = false): Promise<boolean> {
        try {
            await axios.delete(`${BACKEND_URL}/api/sonarr/queue/${queueItemId}`, {
                params: {
                    itemId,
                    removeFromClient: removeFromClient.toString(),
                    blocklist: blocklist.toString()
                },
                timeout: 10000
            });
            return true;
        } catch (error) {
            console.error('Error removing Sonarr queue item:', error);
            throw error;
        }
    }

    public static async getSonarrStatus(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/sonarr/status`, {
                params: { itemId },
                timeout: 10000
            });
            return res.data.data || {};
        } catch (error) {
            console.error('Error fetching Sonarr status:', error);
            throw error;
        }
    }

    public static async getSonarrSeries(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/sonarr/series`, {
                params: { itemId },
                timeout: 10000
            });
            return res.data.data || [];
        } catch (error) {
            console.error('Error fetching Sonarr series:', error);
            throw error;
        }
    }

    public static async refreshSonarrMonitoredDownloads(itemId: string): Promise<any> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/sonarr/refresh-monitored-downloads`, {}, {
                params: { itemId },
                timeout: 10000
            });
            return res.data;
        } catch (error) {
            console.error('Error refreshing Sonarr monitored downloads:', error);
            throw error;
        }
    }

    // Radarr API methods
    public static async getRadarrQueue(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/radarr/queue`, {
                params: { itemId },
                timeout: 10000
            });
            return res.data.data || [];
        } catch (error) {
            console.error('Error fetching Radarr queue:', error);
            throw error;
        }
    }

    public static async removeRadarrQueueItem(itemId: string, queueItemId: string, removeFromClient: boolean = true, blocklist: boolean = false): Promise<boolean> {
        try {
            await axios.delete(`${BACKEND_URL}/api/radarr/queue/${queueItemId}`, {
                params: {
                    itemId,
                    removeFromClient: removeFromClient.toString(),
                    blocklist: blocklist.toString()
                },
                timeout: 10000
            });
            return true;
        } catch (error) {
            console.error('Error removing Radarr queue item:', error);
            throw error;
        }
    }

    public static async getRadarrStatus(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/radarr/status`, {
                params: { itemId },
                timeout: 10000
            });
            return res.data.data || {};
        } catch (error) {
            console.error('Error fetching Radarr status:', error);
            throw error;
        }
    }

    public static async getRadarrMovies(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/radarr/movies`, {
                params: { itemId },
                timeout: 10000
            });
            return res.data.data || [];
        } catch (error) {
            console.error('Error fetching Radarr movies:', error);
            throw error;
        }
    }

    public static async refreshRadarrMonitoredDownloads(itemId: string): Promise<any> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/radarr/refresh-monitored-downloads`, {}, {
                params: { itemId },
                timeout: 10000
            });
            return res.data;
        } catch (error) {
            console.error('Error refreshing Radarr monitored downloads:', error);
            throw error;
        }
    }

    public static async getWeather(latitude: number, longitude: number, abortSignal?: AbortSignal): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/weather`, {
                params: {
                    latitude,
                    longitude
                },
                timeout: 8000, // 8 second timeout
                signal: abortSignal // Add abort signal support
            });
            return res.data;
        } catch (error: any) {
            // Don't log errors for cancelled requests
            if (abortSignal?.aborted || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                throw error;
            }

            // Log detailed error information
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error('Weather API error response:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            } else if (error.request) {
                // The request was made but no response was received
                console.error('Weather API no response:', error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Weather API request error:', error.message);
            }

            throw error;
        }
    }

    public static async getTimezone(latitude: number, longitude: number): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/timezone`, {
                params: {
                    latitude,
                    longitude
                },
                timeout: 5000 // 5 second timeout
            });
            // Ensure we return the expected format - axios already includes 'data'
            // Return the whole response object to allow error checking
            return {
                data: res.data,
                status: res.status
            };
        } catch (error: any) {
            // Log detailed error information
            if (error.response) {
                console.error('Timezone API error response:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            } else if (error.request) {
                console.error('Timezone API no response:', error.request);
            } else {
                console.error('Timezone API request error:', error.message);
            }

            throw error;
        }
    }

    public static async getIPAddresses(): Promise<{ wan: string | null; lan: string | null }> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/health/ip`, {
                withCredentials: false,
                timeout: 5000
            });
            return { wan: res.data.wan, lan: res.data.lan };
        } catch (error) {
            console.error('Failed to fetch IP addresses:', error);
            return { wan: null, lan: null };
        }
    }

    public static async uploadBackgroundImage(file: File): Promise<UploadImageResponse | null> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios({
                method: 'POST',
                url: `${BACKEND_URL}/api/system/upload`,
                data: formData,
                headers: {
                    'Content-Type': 'multipart/form-data'
                    // Headers will be added by interceptor
                }
            });

            return res.data;
        } catch (error) {
            console.error('Failed to upload image:', error);
            return null;
        }
    }

    public static async cleanBackgroundImages(): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/system/clean-background`);
            return true;
        } catch (error) {
            console.error('Failed to clean background images:', error);
            return false;
        }
    }

    public static async updateContainer(): Promise<{ success: boolean; message: string }> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/system/update-container`, {}, {
                withCredentials: true
            });
            return {
                success: true,
                message: res.data.message || 'Update initiated. Container will restart shortly.'
            };
        } catch (error: any) {
            console.error('Failed to update container:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to update container'
            };
        }
    }

    public static async uploadAppIcon(file: File): Promise<Icon | null> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios({
                method: 'POST',
                url: `${BACKEND_URL}/api/app-shortcut/upload`,
                data: formData,
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                withCredentials: true
            });

            return {
                name: res.data.name,
                path: res.data.filePath,
                source: 'custom'
            };
        } catch (error) {
            console.error('Failed to upload app icon:', error);
            return null;
        }
    }

    public static async uploadAppIconsBatch(files: File[]): Promise<Icon[]> {
        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
            });

            const res = await axios({
                method: 'POST',
                url: `${BACKEND_URL}/api/app-shortcut/upload-batch`,
                data: formData,
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                withCredentials: true
            });

            return res.data.icons.map((icon: any) => ({
                name: icon.name,
                path: icon.filePath,
                source: 'custom'
            }));
        } catch (error) {
            console.error('Failed to upload app icons:', error);
            return [];
        }
    }

    // Uploads management methods
    public static async getUploadedImages(): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/uploads/images`, {
                withCredentials: true
            });
            return res.data?.images || [];
        } catch (error) {
            console.error('Error fetching uploaded images:', error);
            return [];
        }
    }

    public static async deleteUploadedImage(imagePath: string): Promise<boolean> {
        try {
            const res = await axios.delete(`${BACKEND_URL}/api/uploads/images`, {
                data: { imagePath },
                withCredentials: true
            });
            return res.status === StatusCodes.OK;
        } catch (error) {
            console.error('Error deleting uploaded image:', error);
            return false;
        }
    }

    // Check if any users exist (for first-time setup)
    public static async checkIfUsersExist(): Promise<boolean> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/auth/check-users`);
            return res.data.hasUsers;
        } catch (error) {
            console.error('Error checking users:', error);
            // Assume users exist if there's an error to prevent unauthorized access
            return false;
        }
    }

    // Add this after the existing methods in the DashApi class
    public static async checkIsAdmin(): Promise<boolean> {
        try {
            // Make a dedicated API call to check admin status
            const res = await axios.get(`${BACKEND_URL}/api/auth/check-admin`, {
                withCredentials: true
            });
            return res.data.isAdmin;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    public static async refreshToken(): Promise<{ success: boolean; isAdmin?: boolean }> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/refresh`, {}, {
                withCredentials: true,
                // Add a timeout to prevent hanging requests
                timeout: 5000
            });

            // Only return success if we got a valid response
            if (res.status === 204) {
                // No content - no refresh token
                console.log('No refresh token to refresh');
                return { success: false };
            }

            console.log('Token refreshed successfully');
            return {
                success: true,
                isAdmin: res.data.isAdmin
            };
        } catch (error) {
            console.error('Error refreshing token:', error);
            // If refresh token fails, log out the user
            try {
                // Don't call logout here as it would cause an infinite loop
                // Just clear cookies and localStorage directly
                localStorage.removeItem('username');
                document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            } catch (e) {
                console.error('Error during logout cleanup:', e);
            }
            return { success: false };
        }
    }

    public static async checkCookies(): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/auth/check-cookies`, {
                withCredentials: true
            });
            return res.data;
        } catch (error) {
            // console.error('Error debugging cookies:', error);
            return null;
        }
    }

    // Wake-on-LAN method
    public static async sendWakeOnLan(data: { mac: string; ip?: string; port?: number }): Promise<any> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/system/wol`, data, {
                withCredentials: true
            });
            return res.data;
        } catch (error: any) {
            console.error('Error sending Wake-on-LAN packet:', error);
            if (error.response) {
                throw new Error(error.response.data.message || 'Failed to send Wake-on-LAN packet');
            } else {
                throw new Error('Network error occurred while sending Wake-on-LAN packet');
            }
        }
    }

    /**
     * Encrypts a secret (password, token, API key) on the server before it is stored
     * in the config. Already encrypted values come back unchanged.
     */
    private static async encryptValue(value: string): Promise<string> {
        const response = await axios.post(
            `${BACKEND_URL}/api/config/encrypt`,
            { value },
            { withCredentials: true }
        );

        return response.data.encrypted;
    }

    public static async encryptPassword(password: string): Promise<string> {
        if (!password) return '';

        try {
            return await this.encryptValue(password);
        } catch (error) {
            console.error('Failed to encrypt password:', error);
            return password; // Return the original password if encryption fails
        }
    }

    public static async encryptPiholeToken(apiToken: string): Promise<string> {
        try {
            return await this.encryptValue(apiToken);
        } catch (error) {
            console.error('Failed to encrypt Pi-hole token:', error);
            throw error;
        }
    }

    public static async encryptPiholePassword(password: string, itemId?: string): Promise<string> {
        try {
            return await this.encryptValue(password);
        } catch (error) {
            console.error('Failed to encrypt Pi-hole password:', error);
            throw error;
        }
    }

    public static async encryptAdGuardUsername(username: string): Promise<string> {
        try {
            return await this.encryptValue(username);
        } catch (error) {
            console.error('Failed to encrypt AdGuard Home username:', error);
            throw error;
        }
    }

    public static async encryptAdGuardPassword(password: string): Promise<string> {
        try {
            return await this.encryptValue(password);
        } catch (error) {
            console.error('Failed to encrypt AdGuard Home password:', error);
            throw error;
        }
    }

    public static async encryptSabnzbdPassword(password: string): Promise<string> {
        try {
            return await this.encryptValue(password);
        } catch (error: any) {
            throw new Error(error.response?.data?.message || 'Failed to encrypt password');
        }
    }

    public static async encryptNzbgetPassword(password: string): Promise<string> {
        try {
            return await this.encryptValue(password);
        } catch (error: any) {
            throw new Error(error.response?.data?.message || 'Failed to encrypt password');
        }
    }

    // Media server (Jellyfin) endpoints
    static async getJellyfinSessions(itemId: string) {
        try {
            const res = await axios.get(
                `${BACKEND_URL}/api/jellyfin/sessions`,
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return res.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Failed to fetch Jellyfin sessions');
        }
    }

    static async getJellyfinLibraryStats(itemId: string) {
        try {
            const res = await axios.get(
                `${BACKEND_URL}/api/jellyfin/library-stats`,
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return res.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Failed to fetch Jellyfin library stats');
        }
    }

    // Jellyseerr methods
    public static async jellyseerrSearch(itemId: string, query: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/jellyseerr/search`, {
                params: { itemId, query },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr search error:', error);
            throw error;
        }
    }

    public static async jellyseerrGetRequests(itemId: string, status: string = 'pending'): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/jellyseerr/requests`, {
                params: { itemId, status },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr requests error:', error);
            throw error;
        }
    }

    public static async jellyseerrCreateRequest(itemId: string, mediaType: string, mediaId: string, seasons?: number[]): Promise<any> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/jellyseerr/request`, {
                mediaType,
                mediaId,
                seasons
            }, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr create request error:', error);
            throw error;
        }
    }

    public static async jellyseerrGetTVDetails(itemId: string, tmdbId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/jellyseerr/tv/${tmdbId}`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr TV details error:', error);
            throw error;
        }
    }

    public static async jellyseerrApproveRequest(itemId: string, requestId: string): Promise<any> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/jellyseerr/request/${requestId}/approve`, {}, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr approve request error:', error);
            throw error;
        }
    }

    public static async jellyseerrDeclineRequest(itemId: string, requestId: string): Promise<any> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/jellyseerr/request/${requestId}/decline`, {}, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr decline request error:', error);
            throw error;
        }
    }

    public static async jellyseerrGetStatus(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/jellyseerr/status`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Jellyseerr status error:', error);
            throw error;
        }
    }



    // Notes methods
    public static async getNotes(): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/notes`);
            return res.data;
        } catch (error) {
            console.error('Error fetching notes:', error);
            throw error;
        }
    }

    public static async createNote(note: { title: string; content: string; fontSize?: string }): Promise<any> {
        try {
            const noteWithId = {
                ...note,
                id: shortid.generate()
            };

            const res = await axios.post(`${BACKEND_URL}/api/notes`, noteWithId);
            return res.data;
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }

    public static async updateNote(noteId: string, note: { title: string; content: string; fontSize?: string }): Promise<any> {
        try {
            const res = await axios.put(`${BACKEND_URL}/api/notes/${noteId}`, note);
            return res.data;
        } catch (error) {
            console.error('Error updating note:', error);
            throw error;
        }
    }

    public static async deleteNote(noteId: string): Promise<void> {
        try {
            await axios.delete(`${BACKEND_URL}/api/notes/${noteId}`);
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }

    public static async updateAllNotesFontSize(fontSize: string): Promise<{ message: string; updatedCount: number }> {
        try {
            const res = await axios.put(`${BACKEND_URL}/api/notes/update-all-font-sizes`, { fontSize });
            return res.data;
        } catch (error) {
            console.error('Error updating font size for all notes:', error);
            throw error;
        }
    }

    // Bulk loading methods for performance optimization
    public static async bulkLoadIcons(iconPaths: string[]): Promise<BulkIconResponse> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/icons/bulk`, {
                iconPaths
            });
            return res.data;
        } catch (error) {
            console.error('Error bulk loading icons:', error);
            throw error;
        }
    }

    public static async bulkLoadWidgetData(widgetRequests: Array<{ id: string; type: string; config?: Record<string, unknown> }>): Promise<BulkWidgetResponse> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/widgets/bulk-data`, {
                widgets: widgetRequests
            });
            return res.data;
        } catch (error) {
            console.error('Error bulk loading widget data:', error);
            throw error;
        }
    }

    // Cache management methods
    public static async getIconCacheStats(): Promise<CacheStatsResponse> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/icons/cache/stats`);
            return res.data;
        } catch (error) {
            console.error('Error getting icon cache stats:', error);
            throw error;
        }
    }

    public static async clearIconCache(): Promise<CacheClearResponse> {
        try {
            const res = await axios.delete(`${BACKEND_URL}/api/icons/cache`);
            return res.data;
        } catch (error) {
            console.error('Error clearing icon cache:', error);
            throw error;
        }
    }
}
