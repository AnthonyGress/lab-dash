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
            console.log('Cookie status after logout:', cookieStatus);
        } catch (error) {
            console.error('Logout error:', error);
            // Even if the API call fails, clear local storage
            localStorage.removeItem('username');
        }
    }

    // Create an axios instance interceptor
    public static setupAxiosInterceptors(): void {
        // Don't set withCredentials globally by default
        axios.defaults.withCredentials = false;

        // Request interceptor
        axios.interceptors.request.use(
            async (config) => {
                // Always send credentials for API requests that require authentication
                if (config.url?.includes('/api/config') ||
                    config.url?.includes('/api/auth') ||
                    config.url?.includes('/api/system')) {
                    config.withCredentials = true;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor to handle 401 errors
        axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                // Get the original request configuration
                const originalRequest = error.config;

                // Only handle 401 errors for authenticated routes
                if (error.response?.status === 401 &&
                    !originalRequest._retry &&
                    !originalRequest.url?.includes('api/auth/login') &&
                    !originalRequest.url?.includes('api/auth/refresh')) {

                    console.log('Intercepted 401 error for:', originalRequest.url);
                    originalRequest._retry = true;

                    try {
                        // Try to refresh the token
                        const refreshResult = await this.refreshToken();

                        if (refreshResult.success) {
                            console.log('Token refreshed, retrying original request');
                            // If refresh was successful, retry the original request
                            // Ensure credentials are included in the retry
                            originalRequest.withCredentials = true;
                            return axios(originalRequest);
                        } else {
                            // If refresh failed, redirect to login
                            console.log('Token refresh failed, redirecting to login');
                            // this.redirectToLogin();
                            return Promise.reject(error);
                        }
                    } catch (refreshError) {
                        console.error('Error during token refresh:', refreshError);
                        // If refresh fails, redirect to login
                        // this.redirectToLogin();
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
            console.log('Custom icons response:', res.data);
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
            return { success: false };
        }
    }

    public static async checkCookies(): Promise<any> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/auth/check-cookies`, {
                withCredentials: true
            });
            console.log('Cookie debug response:', res.data);
            return res.data;
        } catch (error) {
            console.error('Error debugging cookies:', error);
            return null;
        }
    }
}
