import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import shortid from 'shortid';

import { BACKEND_URL } from '../constants/constants';
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
                const isExternalServiceRoute = originalRequest.url?.includes('/api/pihole') ||
                    originalRequest.url?.includes('/api/qbittorrent') ||
                    originalRequest.url?.includes('/api/deluge') ||
                    originalRequest.url?.includes('/api/sabnzbd') ||
                    originalRequest.url?.includes('/api/nzbget') ||
                    originalRequest.url?.includes('/api/radarr') ||
                    originalRequest.url?.includes('/api/sonarr') ||
                    originalRequest.url?.includes('/api/adguard') ||
                    originalRequest.url?.includes('/api/jellyfin') ||
                    originalRequest.url?.includes('/api/jellyseerr') ||
                    originalRequest.url?.includes('/api/transmission') ||
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

    public static async checkServiceHealth(url: string, healthCheckType: 'http' | 'ping' = 'http'): Promise<'online' | 'offline'> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/health`, {
                params: { url, type: healthCheckType },
                // Don't send credentials for health checks to avoid auth issues
                withCredentials: false,
                // Add timeout to prevent long-running requests
                timeout: 5000
            });
            return res.data.status;
        } catch (error) {
            console.error('Failed to check service health:', error);
            return 'offline';
        }
    }

    public static async checkInternetConnectivity(): Promise<'online' | 'offline'> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/health`, {
                params: { url: '8.8.8.8', type: 'ping' },
                // Don't send credentials for health checks to avoid auth issues
                withCredentials: false,
                // Add timeout to prevent long-running requests
                timeout: 10000
            });
            return res.data.status;
        } catch (error) {
            console.error('Failed to check internet connectivity:', error);
            return 'offline';
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

    // qBittorrent methods
    public static async qbittorrentLogin(itemId: string): Promise<boolean> {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/login`,
                {},
                {
                    params: { itemId },
                    withCredentials: false
                }
            );
            return response.data.success;
        } catch (error) {
            console.error('Failed to login to qBittorrent:', error);
            return false;
        }
    }

    /**
     * Encrypts a password using the backend encryption
     * @param password The password to encrypt
     * @returns The encrypted password or the original if encryption fails
     */
    public static async encryptPassword(password: string): Promise<string> {
        if (!password) return '';

        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/encrypt-password`,
                { password },
                { withCredentials: true }
            );

            return response.data.encryptedPassword;
        } catch (error) {
            console.error('Failed to encrypt password:', error);
            return password; // Return the original password if encryption fails
        }
    }

    public static async qbittorrentGetStats(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/qbittorrent/stats`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('qBittorrent stats error:', error);
            throw error;
        }
    }

    public static async qbittorrentGetTorrents(itemId: string): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/qbittorrent/torrents`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('qBittorrent torrents error:', error);
            return [];
        }
    }

    public static async qbittorrentLogout(itemId: string): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/qbittorrent/logout`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return true;
        } catch (error) {
            console.error('qBittorrent logout error:', error);
            return false;
        }
    }

    public static async qbittorrentStartTorrent(hash: string, itemId: string): Promise<boolean> {
        try {
            // Create a URLSearchParams object for form data
            const formData = new URLSearchParams();
            formData.append('hashes', hash);

            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/torrents/start`,
                formData.toString(),
                {
                    params: { itemId },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );

            return true;
        } catch (error) {
            console.error('qBittorrent start error:', error);
            return false;
        }
    }

    public static async qbittorrentStopTorrent(hash: string, itemId: string): Promise<boolean> {
        try {
            // Create a URLSearchParams object for form data
            const formData = new URLSearchParams();
            formData.append('hashes', hash);

            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/torrents/stop`,
                formData.toString(),
                {
                    params: { itemId },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );

            return true;
        } catch (error) {
            console.error('qBittorrent stop error:', error);
            return false;
        }
    }

    public static async qbittorrentDeleteTorrent(hash: string, deleteFiles: boolean = false, itemId: string): Promise<boolean> {
        try {
            // Create a URLSearchParams object for form data
            const formData = new URLSearchParams();
            formData.append('hashes', hash);
            formData.append('deleteFiles', deleteFiles ? 'true' : 'false');

            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/torrents/delete`,
                formData.toString(),
                {
                    params: { itemId },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );

            return true;
        } catch (error) {
            console.error('qBittorrent delete error:', error);
            return false;
        }
    }

    // Deluge methods
    public static async delugeLogin(itemId: string): Promise<boolean> {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/deluge/login`,
                {},
                {
                    params: { itemId },
                    withCredentials: false
                }
            );
            return response.data.success;
        } catch (error) {
            console.error('Failed to login to Deluge:', error);
            return false;
        }
    }

    public static async delugeGetStats(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/deluge/stats`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Deluge stats error:', error);
            throw error;
        }
    }

    public static async delugeGetTorrents(itemId: string): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/deluge/torrents`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Deluge torrents error:', error);
            return [];
        }
    }

    public static async delugeLogout(itemId: string): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/logout`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return true;
        } catch (error) {
            console.error('Deluge logout error:', error);
            return false;
        }
    }

    public static async delugeResumeTorrent(hash: string, itemId: string): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/torrents/resume`,
                { hash },
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Deluge resume error:', error);
            return false;
        }
    }

    public static async delugePauseTorrent(hash: string, itemId: string): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/torrents/pause`,
                { hash },
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Deluge pause error:', error);
            return false;
        }
    }

    public static async delugeDeleteTorrent(hash: string, deleteFiles: boolean = false, itemId: string): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/torrents/delete`,
                {
                    hash,
                    deleteFiles
                },
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Deluge delete error:', error);
            return false;
        }
    }

    // Transmission methods
    public static async transmissionLogin(itemId: string): Promise<boolean> {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/transmission/login`,
                {},
                {
                    params: { itemId },
                    withCredentials: false
                }
            );
            return response.data.success;
        } catch (error) {
            console.error('Failed to login to Transmission:', error);
            return false;
        }
    }

    public static async transmissionGetStats(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/transmission/stats`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Transmission stats error:', error);
            throw error;
        }
    }

    public static async transmissionGetTorrents(itemId: string): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/transmission/torrents`, {
                params: { itemId },
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Transmission torrents error:', error);
            return [];
        }
    }

    public static async transmissionLogout(itemId: string): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/transmission/logout`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return true;
        } catch (error) {
            console.error('Transmission logout error:', error);
            return false;
        }
    }

    public static async transmissionStartTorrent(id: string, itemId: string): Promise<boolean> {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/transmission/torrents/start`,
                { ids: [id] },
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Transmission start error:', error);
            return false;
        }
    }

    public static async transmissionStopTorrent(id: string, itemId: string): Promise<boolean> {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/transmission/torrents/stop`,
                { ids: [id] },
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Transmission stop error:', error);
            return false;
        }
    }

    public static async transmissionDeleteTorrent(id: string, deleteFiles: boolean = false, itemId: string): Promise<boolean> {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/transmission/torrents/delete`,
                { ids: [id], deleteFiles },
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Transmission delete error:', error);
            return false;
        }
    }

    // Helper method to determine route from config without fetching
    public static getPiholeRouteFromConfig(itemId: string, config: any): { route: string; isV6: boolean } {

        // Helper function to search for item in a layout array
        const searchInLayout = (items: any[]): any => {
            for (const item of items) {
                // Direct match
                if (item.id === itemId) {
                    return item;
                }

                // Check if this is a dual widget and the itemId is for a position-specific widget
                if (item.type === 'dual-widget' && itemId.startsWith(item.id + '-')) {
                    const position = itemId.endsWith('-top') ? 'top' : 'bottom';
                    const positionWidget = position === 'top' ? item.config?.topWidget : item.config?.bottomWidget;

                    if (positionWidget?.type === 'pihole-widget') {
                        // Return a synthetic item with the position-specific config
                        return {
                            id: itemId,
                            type: 'pihole-widget',
                            config: positionWidget.config
                        };
                    }
                }

                // Check group widgets
                if (item.type === 'group-widget' && item.config?.items) {
                    const groupItem = searchInLayout(item.config.items);
                    if (groupItem) return groupItem;
                }
            }
            return null;
        };

        // Search in main desktop layout
        let foundItem = searchInLayout(config.layout?.desktop || []);
        if (foundItem) {
            return this.determineRouteFromItem(foundItem);
        }

        // Search in main mobile layout
        foundItem = searchInLayout(config.layout?.mobile || []);
        if (foundItem) {
            return this.determineRouteFromItem(foundItem);
        }

        // Search in pages if they exist
        if (config.pages) {
            for (const page of config.pages) {
                // Search in page desktop layout
                foundItem = searchInLayout(page.layout?.desktop || []);
                if (foundItem) {
                    return this.determineRouteFromItem(foundItem);
                }

                // Search in page mobile layout
                foundItem = searchInLayout(page.layout?.mobile || []);
                if (foundItem) {
                    return this.determineRouteFromItem(foundItem);
                }
            }
        }

        throw new Error('Item not found in configuration');
    }

    // Helper method to determine which Pi-hole route to use based on config
    private static async getPiholeRouteInfo(itemId: string): Promise<{ route: string; isV6: boolean }> {
        try {

            // Get the config to determine authentication method
            const configRes = await axios.get(`${BACKEND_URL}/api/config`, {
                withCredentials: true
            });

            const config = configRes.data;

            // Helper function to search for item in a layout array
            const searchInLayout = (items: any[]): any => {
                for (const item of items) {
                    // Direct match
                    if (item.id === itemId) {
                        return item;
                    }

                    // Check if this is a dual widget and the itemId is for a position-specific widget
                    if (item.type === 'dual-widget' && itemId.startsWith(item.id + '-')) {
                        const position = itemId.endsWith('-top') ? 'top' : 'bottom';
                        const positionWidget = position === 'top' ? item.config?.topWidget : item.config?.bottomWidget;

                        if (positionWidget?.type === 'pihole-widget') {
                            // Return a synthetic item with the position-specific config
                            return {
                                id: itemId,
                                type: 'pihole-widget',
                                config: positionWidget.config
                            };
                        }
                    }

                    // Check group widgets
                    if (item.type === 'group-widget' && item.config?.items) {
                        const groupItem = searchInLayout(item.config.items);
                        if (groupItem) return groupItem;
                    }
                }
                return null;
            };

            // Search in main desktop layout
            let foundItem = searchInLayout(config.layout?.desktop || []);
            if (foundItem) {
                return this.determineRouteFromItem(foundItem);
            }

            // Search in main mobile layout
            foundItem = searchInLayout(config.layout?.mobile || []);
            if (foundItem) {
                return this.determineRouteFromItem(foundItem);
            }

            // Search in pages if they exist
            if (config.pages) {
                for (const page of config.pages) {
                    // Search in page desktop layout
                    foundItem = searchInLayout(page.layout?.desktop || []);
                    if (foundItem) {
                        return this.determineRouteFromItem(foundItem);
                    }

                    // Search in page mobile layout
                    foundItem = searchInLayout(page.layout?.mobile || []);
                    if (foundItem) {
                        return this.determineRouteFromItem(foundItem);
                    }
                }
            }

            throw new Error('Item not found in configuration');
        } catch (error) {
            console.error('Error determining Pi-hole route:', error);
            throw new Error('Failed to determine Pi-hole version from configuration');
        }
    }

    // Helper method to determine route from item config
    private static determineRouteFromItem(item: any): { route: string; isV6: boolean } {
        const itemConfig = item.config || {};

        // Determine route based on security flags (since actual credentials are not sent to frontend)
        // If password flag exists (with or without apiToken flag), use v6
        // If only apiToken flag exists, use v5
        const hasPassword = !!itemConfig._hasPassword;
        const hasApiToken = !!itemConfig._hasApiToken;

        if (hasPassword) {
            return { route: 'pihole/v6', isV6: true };
        } else if (hasApiToken) {
            return { route: 'pihole', isV6: false };
        } else {
            throw new Error('No valid authentication method found (password for v6 or apiToken for v5)');
        }
    }

    // Pi-hole methods with config from context (preferred method)
    public static async getPiholeStatsWithConfig(itemId: string, config: any): Promise<any> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole stats');
            }

            const { route } = this.getPiholeRouteFromConfig(itemId, config);

            const res = await axios.get(`${BACKEND_URL}/api/${route}/stats`, {
                params: { itemId },
                withCredentials: true
            });

            if (res.data.success) {
                return res.data.data;
            } else {
                if (res.data.decryptionError) {
                    throw new Error('Failed to decrypt Pi-hole authentication credentials');
                }
                throw new Error(res.data.error || 'Failed to get Pi-hole statistics');
            }
        } catch (error: any) {
            // Check for custom error codes from our backend
            if (error.response?.data?.code === 'PIHOLE_AUTH_ERROR') {
                // Authentication error with Pi-hole - create a custom error
                const piError = new Error(error.response.data.error || 'Pi-hole authentication failed');
                // Attach the response to the error for the component to use
                (piError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: true
                };
                throw piError;
            }

            if (error.response?.data?.code === 'PIHOLE_API_ERROR') {
                // API error with Pi-hole - create a custom error
                const piError = new Error(error.response.data.error || 'Pi-hole API error');
                (piError as any).response = {
                    status: 400,
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw piError;
            }

            // If we get an explicit 401 from the server, throw with an authentication message
            if (error.response?.status === 401) {
                console.error('Pi-hole authentication failed:', error.response.data);
                const errorMsg = error.response.data?.error || 'Authentication failed';
                const err = new Error(errorMsg);
                // Add response property so the component can check status code
                (err as any).response = error.response;
                throw err;
            }

            // Provide detailed error information for debugging
            console.error('Pi-hole stats error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            // Add more specific error messages for common issues
            if (error.message?.includes('ECONNREFUSED')) {
                throw new Error('Connection refused. Please check if Pi-hole is running at the specified host and port.');
            } else if (error.message?.includes('timeout')) {
                throw new Error('Connection timed out. Please check your network connection and Pi-hole configuration.');
            } else if (error.message?.includes('Network Error')) {
                throw new Error('Network error. Please check your network connection and Pi-hole configuration.');
            }

            throw error;
        }
    }

    // Pi-hole methods (fallback - fetches config)
    public static async getPiholeStats(itemId: string): Promise<any> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole stats');
            }

            const { route } = await this.getPiholeRouteInfo(itemId);

            const res = await axios.get(`${BACKEND_URL}/api/${route}/stats`, {
                params: { itemId },
                withCredentials: true
            });

            if (res.data.success) {
                return res.data.data;
            } else {
                if (res.data.decryptionError) {
                    throw new Error('Failed to decrypt Pi-hole authentication credentials');
                }
                throw new Error(res.data.error || 'Failed to get Pi-hole statistics');
            }
        } catch (error: any) {
            // Check for custom error codes from our backend
            if (error.response?.data?.code === 'PIHOLE_AUTH_ERROR') {
                // Authentication error with Pi-hole - create a custom error
                const piError = new Error(error.response.data.error || 'Pi-hole authentication failed');
                // Attach the response to the error for the component to use
                (piError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: true
                };
                throw piError;
            }

            if (error.response?.data?.code === 'PIHOLE_API_ERROR') {
                // API error with Pi-hole - create a custom error
                const piError = new Error(error.response.data.error || 'Pi-hole API error');
                (piError as any).response = {
                    status: 400,
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw piError;
            }

            // If we get an explicit 401 from the server, throw with an authentication message
            if (error.response?.status === 401) {
                console.error('Pi-hole authentication failed:', error.response.data);
                const errorMsg = error.response.data?.error || 'Authentication failed';
                const err = new Error(errorMsg);
                // Add response property so the component can check status code
                (err as any).response = error.response;
                throw err;
            }

            // Provide detailed error information for debugging
            console.error('Pi-hole stats error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            // Add more specific error messages for common issues
            if (error.message?.includes('ECONNREFUSED')) {
                throw new Error('Connection refused. Please check if Pi-hole is running at the specified host and port.');
            } else if (error.message?.includes('timeout')) {
                throw new Error('Connection timed out. Please check your network connection and Pi-hole configuration.');
            } else if (error.message?.includes('Network Error')) {
                throw new Error('Network error. Please check your network connection and Pi-hole configuration.');
            }

            throw error;
        }
    }

    public static async encryptPiholeToken(apiToken: string): Promise<string> {
        try {
            // API tokens are only used for v5, so always use the v5 route
            const res = await axios.post(`${BACKEND_URL}/api/pihole/encrypt-token`,
                { apiToken },
                { withCredentials: true }
            );
            return res.data.encryptedToken;
        } catch (error) {
            console.error('Failed to encrypt Pi-hole token:', error);
            throw error;
        }
    }

    public static async encryptPiholePassword(password: string, itemId?: string): Promise<string> {
        try {
            let route = 'pihole'; // Default to v5

            // If itemId is provided, determine the correct route
            if (itemId) {
                try {
                    const routeInfo = await this.getPiholeRouteInfo(itemId);
                    route = routeInfo.route;
                } catch (error) {
                    // If we can't determine the route, default to v5 for backward compatibility
                    console.warn('Could not determine Pi-hole route, defaulting to v5:', error);
                }
            }

            const res = await axios.post(`${BACKEND_URL}/api/${route}/encrypt-password`,
                { password },
                { withCredentials: true }
            );
            return res.data.encryptedPassword;
        } catch (error) {
            console.error('Failed to encrypt Pi-hole password:', error);
            throw error;
        }
    }

    public static async disablePiholeWithConfig(itemId: string, config: any, seconds?: number): Promise<boolean> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole disable');
            }

            const { route } = this.getPiholeRouteFromConfig(itemId, config);

            const params: any = { itemId };

            if (seconds !== undefined && seconds !== null) {
                params.seconds = seconds;
            }

            const res = await axios.post(`${BACKEND_URL}/api/${route}/disable`, {}, {
                params,
                withCredentials: true
            });

            return res.data.success === true;
        } catch (error: any) {
            // Handle custom error codes from our backend
            if (error.response?.data?.code) {
                console.error(`Pi-hole disable error (${error.response.data.code}):`, error.response.data);

                // Create a custom error that won't trigger global auth interceptors
                const piError = new Error(error.response.data.error || 'Failed to disable Pi-hole');
                (piError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw piError;
            }

            console.error('Failed to disable Pi-hole:', error);
            throw error;
        }
    }

    public static async disablePihole(itemId: string, seconds?: number): Promise<boolean> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole disable');
            }

            const { route } = await this.getPiholeRouteInfo(itemId);

            const params: any = { itemId };

            if (seconds !== undefined && seconds !== null) {
                params.seconds = seconds;
            }

            const res = await axios.post(`${BACKEND_URL}/api/${route}/disable`, {}, {
                params,
                withCredentials: true
            });

            return res.data.success === true;
        } catch (error: any) {
            // Handle custom error codes from our backend
            if (error.response?.data?.code) {
                console.error(`Pi-hole disable error (${error.response.data.code}):`, error.response.data);

                // Create a custom error that won't trigger global auth interceptors
                const piError = new Error(error.response.data.error || 'Failed to disable Pi-hole');
                (piError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw piError;
            }

            console.error('Failed to disable Pi-hole:', error);
            throw error;
        }
    }

    public static async enablePiholeWithConfig(itemId: string, config: any): Promise<boolean> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole enable');
            }

            const { route } = this.getPiholeRouteFromConfig(itemId, config);

            const res = await axios.post(`${BACKEND_URL}/api/${route}/enable`, {}, {
                params: { itemId },
                withCredentials: true
            });

            return res.data.success === true;
        } catch (error: any) {
            // Handle custom error codes from our backend
            if (error.response?.data?.code) {
                console.error(`Pi-hole enable error (${error.response.data.code}):`, error.response.data);

                // Create a custom error that won't trigger global auth interceptors
                const piError = new Error(error.response.data.error || 'Failed to enable Pi-hole');
                (piError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw piError;
            }

            console.error('Failed to enable Pi-hole:', error);
            throw error;
        }
    }

    public static async enablePihole(itemId: string): Promise<boolean> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole enable');
            }

            const { route } = await this.getPiholeRouteInfo(itemId);

            const res = await axios.post(`${BACKEND_URL}/api/${route}/enable`, {}, {
                params: { itemId },
                withCredentials: true
            });

            return res.data.success === true;
        } catch (error: any) {
            // Handle custom error codes from our backend
            if (error.response?.data?.code) {
                console.error(`Pi-hole enable error (${error.response.data.code}):`, error.response.data);

                // Create a custom error that won't trigger global auth interceptors
                const piError = new Error(error.response.data.error || 'Failed to enable Pi-hole');
                (piError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (piError as any).pihole = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw piError;
            }

            console.error('Failed to enable Pi-hole:', error);
            throw error;
        }
    }

    public static async getPiholeBlockingStatusWithConfig(itemId: string, config: any): Promise<any> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole blocking status');
            }

            const { route } = this.getPiholeRouteFromConfig(itemId, config);

            const res = await axios.get(`${BACKEND_URL}/api/${route}/blocking-status`, {
                params: { itemId },
                withCredentials: true
            });

            if (res.data.success) {
                return res.data.data;
            } else {
                throw new Error(res.data.error || 'Failed to get Pi-hole blocking status');
            }
        } catch (error: any) {
            console.error('Pi-hole blocking status error:', error);
            throw error;
        }
    }

    public static async getPiholeBlockingStatus(itemId: string): Promise<any> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for Pi-hole blocking status');
            }

            const { route } = await this.getPiholeRouteInfo(itemId);

            const res = await axios.get(`${BACKEND_URL}/api/${route}/blocking-status`, {
                params: { itemId },
                withCredentials: true
            });

            if (res.data.success) {
                return res.data.data;
            } else {
                throw new Error(res.data.error || 'Failed to get Pi-hole blocking status');
            }
        } catch (error: any) {
            console.error('Pi-hole blocking status error:', error);
            throw error;
        }
    }

    // AdGuard Home API methods
    public static async getAdGuardStats(itemId: string): Promise<any> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for AdGuard Home stats');
            }

            const res = await axios.get(`${BACKEND_URL}/api/adguard/stats`, {
                params: { itemId },
                withCredentials: true
            });

            if (res.data.success) {
                return res.data.data;
            } else {
                if (res.data.decryptionError) {
                    throw new Error('Failed to decrypt AdGuard Home authentication credentials');
                }
                throw new Error(res.data.error || 'Failed to get AdGuard Home statistics');
            }
        } catch (error: any) {
            // Check for custom error codes from our backend
            if (error.response?.data?.code === 'ADGUARD_AUTH_ERROR') {
                // Authentication error with AdGuard Home - create a custom error
                const adError = new Error(error.response.data.error || 'AdGuard Home authentication failed');
                (adError as any).response = {
                    status: 400,  // Use 400 instead of 401 to avoid global auth interceptor
                    data: error.response.data
                };
                (adError as any).adguard = {
                    requiresReauth: true
                };
                throw adError;
            }

            if (error.response?.data?.code === 'ADGUARD_API_ERROR') {
                // API error with AdGuard Home - create a custom error
                const adError = new Error(error.response.data.error || 'AdGuard Home API error');
                (adError as any).response = {
                    status: 400,
                    data: error.response.data
                };
                (adError as any).adguard = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw adError;
            }

            // If we get an explicit 401 from the server, throw with an authentication message
            if (error.response?.status === 401) {
                console.error('AdGuard authentication failed:', error.response.data);
                const errorMsg = error.response.data?.error || 'Authentication failed';
                const err = new Error(errorMsg);
                (err as any).response = error.response;
                throw err;
            }

            console.error('AdGuard Home stats error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });

            if (error.message?.includes('ECONNREFUSED')) {
                throw new Error('Connection refused. Please check if AdGuard Home is running at the specified host and port.');
            } else if (error.message?.includes('timeout')) {
                throw new Error('Connection timed out. Please check your network connection and AdGuard Home configuration.');
            } else if (error.message?.includes('Network Error')) {
                throw new Error('Network error. Please check your network connection and AdGuard Home configuration.');
            }

            throw error;
        }
    }

    public static async encryptAdGuardUsername(username: string): Promise<string> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/adguard/encrypt-username`,
                { username },
                { withCredentials: true }
            );
            return res.data.encryptedUsername;
        } catch (error) {
            console.error('Failed to encrypt AdGuard username:', error);
            throw error;
        }
    }

    public static async encryptAdGuardPassword(password: string): Promise<string> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/adguard/encrypt-password`,
                { password },
                { withCredentials: true }
            );
            return res.data.encryptedPassword;
        } catch (error) {
            console.error('Failed to encrypt AdGuard password:', error);
            throw error;
        }
    }

    public static async disableAdGuard(itemId: string, seconds?: number): Promise<boolean> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for AdGuard Home disable');
            }

            const params: any = { itemId };

            if (seconds !== undefined && seconds !== null) {
                params.seconds = seconds;
            }

            const res = await axios.post(`${BACKEND_URL}/api/adguard/disable`, {}, {
                params,
                withCredentials: true
            });

            return res.data.success === true;
        } catch (error: any) {
            // Handle custom error codes from our backend
            if (error.response?.data?.code) {
                console.error(`AdGuard disable error (${error.response.data.code}):`, error.response.data);

                const adError = new Error(error.response.data.error || 'Failed to disable AdGuard Home');
                (adError as any).response = {
                    status: 400,
                    data: error.response.data
                };
                (adError as any).adguard = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw adError;
            }

            console.error('Failed to disable AdGuard Home:', error);
            throw error;
        }
    }

    public static async enableAdGuard(itemId: string): Promise<boolean> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for AdGuard Home enable');
            }

            const res = await axios.post(`${BACKEND_URL}/api/adguard/enable`, {}, {
                params: { itemId },
                withCredentials: true
            });

            return res.data.success === true;
        } catch (error: any) {
            // Handle custom error codes from our backend
            if (error.response?.data?.code) {
                console.error(`AdGuard enable error (${error.response.data.code}):`, error.response.data);

                const adError = new Error(error.response.data.error || 'Failed to enable AdGuard Home');
                (adError as any).response = {
                    status: 400,
                    data: error.response.data
                };
                (adError as any).adguard = {
                    requiresReauth: error.response.data.requiresReauth || false
                };
                throw adError;
            }

            console.error('Failed to enable AdGuard Home:', error);
            throw error;
        }
    }

    public static async getAdGuardProtectionStatus(itemId: string): Promise<any> {
        try {
            if (!itemId) {
                throw new Error('Item ID is required for AdGuard Home protection status');
            }

            const res = await axios.get(`${BACKEND_URL}/api/adguard/protection-status`, {
                params: { itemId },
                withCredentials: true
            });

            if (res.data.success) {
                return res.data.data;
            } else {
                throw new Error(res.data.error || 'Failed to get AdGuard Home protection status');
            }
        } catch (error: any) {
            console.error('AdGuard Home protection status error:', error);
            throw error;
        }
    }

    // SABnzbd API methods
    public static async sabnzbdLogin(itemId: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/sabnzbd/login`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('SABnzbd login error:', error);
            if (error.response?.status === 401) {
                throw new Error('Invalid API key');
            }
            return false;
        }
    }

    public static async sabnzbdGetStats(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/sabnzbd/stats`, {
                params: { itemId },
                withCredentials: true
            });
            return res.data;
        } catch (error: any) {
            console.error('Error getting SABnzbd stats:', error);
            throw error;
        }
    }

    public static async sabnzbdGetDownloads(itemId: string): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/sabnzbd/downloads`, {
                params: { itemId },
                withCredentials: true
            });
            return res.data;
        } catch (error: any) {
            console.error('Error getting SABnzbd downloads:', error);
            throw error;
        }
    }

    public static async sabnzbdLogout(itemId: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/sabnzbd/logout`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('SABnzbd logout error:', error);
            return false;
        }
    }

    public static async sabnzbdResumeDownload(itemId: string, nzoId: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/sabnzbd/resume/${nzoId}`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('SABnzbd resume download error:', error);
            return false;
        }
    }

    public static async sabnzbdPauseDownload(itemId: string, nzoId: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/sabnzbd/pause/${nzoId}`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('SABnzbd pause download error:', error);
            return false;
        }
    }

    public static async sabnzbdDeleteDownload(itemId: string, nzoId: string, deleteFiles: boolean = false): Promise<boolean> {
        try {
            const res = await axios.delete(`${BACKEND_URL}/api/sabnzbd/delete/${nzoId}`, {
                params: { itemId, deleteFiles: deleteFiles.toString() },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('SABnzbd delete download error:', error);
            return false;
        }
    }

    public static async encryptSabnzbdPassword(password: string): Promise<string> {
        try {
            const res = await axios.post(
                `${BACKEND_URL}/api/sabnzbd/encrypt-password`,
                { password },
                { withCredentials: true }
            );
            return res.data.encryptedPassword;
        } catch (error: any) {
            throw new Error(error.response?.data?.message || 'Failed to encrypt password');
        }
    }

    // NZBGet API methods
    public static async nzbgetLogin(itemId: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/nzbget/login`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('NZBGet login error:', error);
            if (error.response?.status === 401) {
                throw new Error('Invalid credentials');
            }
            return false;
        }
    }

    public static async nzbgetGetStats(itemId: string): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/nzbget/stats`, {
                params: { itemId },
                withCredentials: true
            });
            return res.data;
        } catch (error: any) {
            console.error('Error getting NZBGet stats:', error);
            throw error;
        }
    }

    public static async nzbgetGetDownloads(itemId: string): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/nzbget/downloads`, {
                params: { itemId },
                withCredentials: true
            });
            return res.data;
        } catch (error: any) {
            console.error('Error getting NZBGet downloads:', error);
            throw error;
        }
    }

    public static async nzbgetLogout(itemId: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/nzbget/logout`, {}, {
                params: { itemId },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('NZBGet logout error:', error);
            return false;
        }
    }

    public static async nzbgetResumeDownload(itemId: string, nzbId?: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/nzbget/resume`, 
                { nzbId }, // Send nzbId in request body
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return res.data.success;
        } catch (error: any) {
            console.error('NZBGet resume download error:', error);
            return false;
        }
    }

    public static async nzbgetPauseDownload(itemId: string, nzbId?: string): Promise<boolean> {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/nzbget/pause`, 
                { nzbId }, // Send nzbId in request body
                {
                    params: { itemId },
                    withCredentials: true
                }
            );
            return res.data.success;
        } catch (error: any) {
            console.error('NZBGet pause download error:', error);
            return false;
        }
    }

    public static async nzbgetDeleteDownload(itemId: string, nzbId: string, deleteFiles: boolean = false): Promise<boolean> {
        try {
            const res = await axios.delete(`${BACKEND_URL}/api/nzbget/delete/${nzbId}`, {
                params: { itemId, deleteFiles: deleteFiles.toString() },
                withCredentials: true
            });
            return res.data.success;
        } catch (error: any) {
            console.error('NZBGet delete download error:', error);
            return false;
        }
    }

    public static async encryptNzbgetPassword(password: string): Promise<string> {
        try {
            const res = await axios.post(
                `${BACKEND_URL}/api/nzbget/encrypt-password`,
                { password },
                { withCredentials: true }
            );
            return res.data.encryptedPassword;
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
