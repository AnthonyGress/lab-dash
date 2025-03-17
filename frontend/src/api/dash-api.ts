import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { jwtDecode } from 'jwt-decode';

import { BACKEND_URL } from '../constants/constants';
import { Config, DashboardItem, DashboardLayout, Icon, UploadImageResponse } from '../types';

// Auth types
interface SignupRequest {
  username: string;
  password: string;
}

interface SignupResponse {
  message: string;
  username: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  message: string;
  username: string;
}

interface RefreshTokenResponse {
  token: string;
}

interface JwtPayload {
  exp: number;
  username: string;
  [key: string]: any;
}

export class DashApi {
    private static refreshPromise: Promise<void> | null = null;

    // Authentication methods
    public static async signup(username: string, password: string): Promise<SignupResponse> {
        try {
            const res = await axios.post(`${BACKEND_URL}/auth/signup`, {
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
            const res = await axios.post(`${BACKEND_URL}/auth/login`,
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
            // Call the logout endpoint to clear cookies on the server
            await axios.post(`${BACKEND_URL}/auth/logout`, {}, { withCredentials: true });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // Refresh access token using the refresh token cookie
    private static refreshAccessToken(): Promise<void> {
        // If a refresh is already in progress, return that promise
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = new Promise((resolve, reject) => {
            axios.post<{ message: string }>(
                `${BACKEND_URL}/auth/refresh`,
                {}, // No body needed as token is in cookie
                { withCredentials: true } // Include cookies in the request
            )
                .then(() => {
                    // No need to store token as it's in cookies
                    resolve();
                })
                .catch(error => {
                    // If refresh fails, redirect to login
                    this.redirectToLogin();
                    reject(new Error('Failed to refresh token'));
                })
                .finally(() => {
                    this.refreshPromise = null;
                });
        });

        return this.refreshPromise;
    }

    // Get auth headers with token refresh logic
    private static async getAuthHeadersWithRefresh(): Promise<Record<string, string>> {
        // With HTTP-only cookies, we don't need to manually add the token to headers
        // Cookies are automatically sent with the request

        // Check if we need to refresh the token
        try {
            // If cookies include access_token, assume we're authenticated
            // In a real implementation, you might want to check if the token is expired
            const cookie = document.cookie;
            const hasAccessToken = cookie.includes('access_token');

            if (!hasAccessToken) {
                // If no access token cookie, try to refresh
                await this.refreshAccessToken();
            }
        } catch (error) {
            console.error('Error checking authentication status:', error);
        }

        // Return empty headers as the cookies will be sent automatically
        return {};
    }

    // Helper for non-auth headers - not needed with cookie auth
    private static getAuthHeaders() {
        // With HTTP-only cookies, we don't need to manually add auth headers
        return {};
    }

    // Create an axios instance interceptor
    public static setupAxiosInterceptors(): void {
        // Don't set withCredentials globally - only for auth endpoints
        axios.defaults.withCredentials = false;

        // Request interceptor
        axios.interceptors.request.use(
            async (config) => {
                // Only include credentials for auth-related endpoints
                if (config.url?.includes('/auth/login') ||
                    config.url?.includes('/auth/logout') ||
                    config.url?.includes('/auth/refresh')) {
                    config.withCredentials = true;
                } else {
                    config.withCredentials = false;
                }

                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor to handle 401 errors
        axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // If 401 and not a retry and not login/refresh request
                if (error.response?.status === 401 &&
                    !originalRequest._retry &&
                    !originalRequest.url?.includes('/auth/login') &&
                    !originalRequest.url?.includes('/auth/refresh')) {

                    originalRequest._retry = true;

                    try {
                        // Refresh the token
                        await this.refreshAccessToken();

                        // Retry the original request
                        return axios(originalRequest);
                    } catch (refreshError) {
                        // If refresh fails, redirect to login
                        this.redirectToLogin();
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    // Helper method to redirect to login page
    private static redirectToLogin(): void {
        // Implement based on your routing library
        // For example, with react-router:
        // window.location.href = '/login';
        console.log('Authentication expired. Redirecting to login...');
    }

    // Existing methods - without auth headers for public endpoints
    public static async getIconList(): Promise<Icon[]> {
        const res = await axios.get(`${BACKEND_URL}/icon-list`);
        return res.data?.icons;
    }

    public static async getIcon(iconPath: string): Promise<string> {
        const res = await axios.get(`${BACKEND_URL}/icons/${iconPath.replace('./assets/', '')}`);
        return res.data;
    }

    // These endpoints require authentication
    public static async getConfig(): Promise<Config> {
        // Using axios interceptors, we don't need to manually add headers here
        const res = await axios.get(`${BACKEND_URL}/api/config`);
        return res.data;
    }

    public static async exportConfig(): Promise<void> {
        try {
            // Use axios to get the file as a blob
            const response = await axios.get(`${BACKEND_URL}/api/config/export`, {
                responseType: 'blob'
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
            // Using axios interceptors, we don't need to manually add headers here
            await axios.post(`${BACKEND_URL}/api/config`, config);
        } catch (error) {
            console.error('Failed to save layout:', error);
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
}
