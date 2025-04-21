import axios from 'axios';
import { StatusCodes } from 'http-status-codes';

import { BACKEND_URL } from '../constants/constants';
import { Config, Icon, UploadImageResponse } from '../types';

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

            console.log('login successful', res.data);

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
            // This is the only reliable way to clear HTTP-only cookies
            await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });

            // Clear username from localStorage
            localStorage.removeItem('username');

            console.log('Logged out successfully');

            // Verify cookies are cleared
            const cookieStatus = await this.checkCookies();
        } catch (error) {
            console.error('Logout error:', error);
            // Even if the API call fails, clear local storage
            localStorage.removeItem('username');
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

                // Only handle 401 errors for authenticated routes
                if (error.response?.status === 401 &&
                    !originalRequest._retry &&
                    !originalRequest.url?.includes('api/auth/login') &&
                    !originalRequest.url?.includes('api/auth/refresh')) {

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
            console.log('Redirecting to login page...');
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

    public static async saveConfig(config: Partial<Config>): Promise<void> {
        try {
            // Explicitly set withCredentials for this request
            await axios.post(`${BACKEND_URL}/api/config`, config, {
                withCredentials: true
            });
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

            console.log('Config import response:', response.data);
            return true;
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw error; // Rethrow to allow handling in the UI
        }
    }

    public static async getSystemInformation(): Promise<any> {
        const res = await axios.get(`${BACKEND_URL}/api/system`);
        if (res.status === StatusCodes.OK) {
            return res.data;
        }
        return null;
    }

    public static async getWeather(latitude?: number, longitude?: number): Promise<any> {
        const res = await axios.get(`${BACKEND_URL}/api/weather`, {
            params: {
                latitude,
                longitude
            }
        });

        if (res.status === StatusCodes.OK) {
            return res.data;
        }

        throw new Error(`Weather API request failed: ${res.statusText}`);
    }

    public static async checkServiceHealth(url: string): Promise<'online' | 'offline'> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/health`, {
                params: { url }
            });
            return res.data.status;
        } catch (error) {
            console.error('Failed to check service health:', error);
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
                withCredentials: true
            });
            console.log('Token refreshed successfully');
            return {
                success: true,
                isAdmin: res.data.isAdmin
            };
        } catch (error) {
            console.error('Error refreshing token:', error);
            // If refresh token fails, log out the user
            await this.logout();
            return { success: false };
        }
    }

    public static async checkCookies(): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/auth/check-cookies`, {
                withCredentials: true
            });
            // console.log('Cookie debug response:', res.data);
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
    public static async qbittorrentLogin(credentials: {
        username: string;
        password: string;
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            const { host, port, ssl, username, password } = credentials;
            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/login`,
                { username, password },
                {
                    params: { host, port, ssl },
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

    public static async qbittorrentGetStats(connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
        username?: string;
        password?: string;
    }): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/qbittorrent/stats`, {
                params: connectionInfo,
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('qBittorrent stats error:', error);
            throw error;
        }
    }

    public static async qbittorrentGetTorrents(connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
        username?: string;
        password?: string;
    }): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/qbittorrent/torrents`, {
                params: connectionInfo,
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('qBittorrent torrents error:', error);
            return [];
        }
    }

    public static async qbittorrentLogout(connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/qbittorrent/logout`, {}, {
                params: connectionInfo,
                withCredentials: true
            });
            return true;
        } catch (error) {
            console.error('qBittorrent logout error:', error);
            return false;
        }
    }

    public static async qbittorrentStartTorrent(hash: string, connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            console.log('Starting torrent with hash:', hash);

            // Create a URLSearchParams object for form data
            const formData = new URLSearchParams();
            formData.append('hashes', hash);

            console.log('Sending form data:', formData.toString());

            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/torrents/start`,
                formData.toString(),
                {
                    params: connectionInfo,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );

            console.log('Start torrent response:', response.status, response.data);
            return true;
        } catch (error) {
            console.error('qBittorrent start error:', error);
            return false;
        }
    }

    public static async qbittorrentStopTorrent(hash: string, connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            console.log('Stopping torrent with hash:', hash);

            // Create a URLSearchParams object for form data
            const formData = new URLSearchParams();
            formData.append('hashes', hash);

            console.log('Sending form data:', formData.toString());

            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/torrents/stop`,
                formData.toString(),
                {
                    params: connectionInfo,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );

            console.log('Stop torrent response:', response.status, response.data);
            return true;
        } catch (error) {
            console.error('qBittorrent stop error:', error);
            return false;
        }
    }

    public static async qbittorrentDeleteTorrent(hash: string, deleteFiles: boolean = false, connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            console.log('Deleting torrent with hash:', hash, 'deleteFiles:', deleteFiles);

            // Create a URLSearchParams object for form data
            const formData = new URLSearchParams();
            formData.append('hashes', hash);
            formData.append('deleteFiles', deleteFiles ? 'true' : 'false');

            console.log('Sending form data:', formData.toString());

            const response = await axios.post(
                `${BACKEND_URL}/api/qbittorrent/torrents/delete`,
                formData.toString(),
                {
                    params: connectionInfo,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );

            console.log('Delete torrent response:', response.status, response.data);
            return true;
        } catch (error) {
            console.error('qBittorrent delete error:', error);
            return false;
        }
    }

    // Deluge methods
    public static async delugeLogin(credentials: {
        username: string;
        password: string;
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            const { host, port, ssl, username, password } = credentials;
            const response = await axios.post(
                `${BACKEND_URL}/api/deluge/login`,
                { username, password },
                {
                    params: { host, port, ssl },
                    withCredentials: false
                }
            );
            return response.data.success;
        } catch (error) {
            console.error('Failed to login to Deluge:', error);
            return false;
        }
    }

    public static async delugeGetStats(connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/deluge/stats`, {
                params: connectionInfo,
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Deluge stats error:', error);
            throw error;
        }
    }

    public static async delugeGetTorrents(connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<any[]> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/deluge/torrents`, {
                params: connectionInfo,
                withCredentials: false
            });
            return res.data;
        } catch (error) {
            console.error('Deluge torrents error:', error);
            return [];
        }
    }

    public static async delugeLogout(connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/logout`, {}, {
                params: connectionInfo,
                withCredentials: true
            });
            return true;
        } catch (error) {
            console.error('Deluge logout error:', error);
            return false;
        }
    }

    public static async delugeResumeTorrent(hash: string, connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/torrents/resume`,
                { hash },
                {
                    params: connectionInfo,
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Deluge resume error:', error);
            return false;
        }
    }

    public static async delugePauseTorrent(hash: string, connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/torrents/pause`,
                { hash },
                {
                    params: connectionInfo,
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Deluge pause error:', error);
            return false;
        }
    }

    public static async delugeDeleteTorrent(hash: string, deleteFiles: boolean = false, connectionInfo?: {
        host?: string;
        port?: string;
        ssl?: boolean;
    }): Promise<boolean> {
        try {
            await axios.post(`${BACKEND_URL}/api/deluge/torrents/delete`,
                {
                    hash,
                    deleteFiles
                },
                {
                    params: connectionInfo,
                    withCredentials: true
                }
            );
            return true;
        } catch (error) {
            console.error('Deluge delete error:', error);
            return false;
        }
    }
}
