import { useCallback, useEffect, useRef, useState } from 'react';

import { DownloadClientWidget } from './DownloadClientWidget';
import { DashApi } from '../../../../api/dash-api';

type SabnzbdWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    _hasPassword?: boolean; // Security flag instead of actual password
    refreshInterval?: number;
    maxDisplayedDownloads?: number;
    showLabel?: boolean;
};

export const SabnzbdWidget = (props: { config?: SabnzbdWidgetConfig; id?: string }) => {
    const { config, id } = props;

    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [downloads, setDownloads] = useState<any[]>([]);
    const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '8080',
        ssl: config?.ssl || false,
        username: '', // SABnzbd doesn't use username
        password: '' // API key is handled on backend, not sent to frontend
    });

    // Add a counter for login attempts and a maximum number of attempts
    const loginAttemptsRef = useRef(0);
    const MAX_LOGIN_ATTEMPTS = 3;

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials(prev => ({
                host: config.host || '',
                port: config.port !== undefined ? config.port : (prev.port || '8080'),
                ssl: config.ssl || false,
                username: '', // SABnzbd doesn't use username
                password: '' // API key is handled on backend, not sent to frontend
            }));
            // Reset attempt counter and failed flag when credentials change
            loginAttemptsRef.current = 0;
            setLoginAttemptFailed(false);
        }
    }, [config]);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setAuthError('');

        try {
            // SABnzbd doesn't need a login process - it uses API key directly
            // But we need to validate the connection by making a test API call
            if (!loginCredentials.host || !loginCredentials.port || !config?._hasPassword) {
                // Increment attempt counter
                loginAttemptsRef.current += 1;

                if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                    setAuthError('Connection error after multiple attempts. Please check your SABnzbd settings.');
                    setIsAuthenticated(false);
                    setLoginAttemptFailed(true);
                } else {
                    setAuthError(`Login attempt ${loginAttemptsRef.current}/${MAX_LOGIN_ATTEMPTS} failed. Missing required fields.`);

                    // Schedule another attempt
                    setTimeout(() => {
                        if (!isAuthenticated) {
                            handleLogin();
                        }
                    }, 2000);
                }
                return;
            }

            // Test the connection by making a stats API call
            const statsData = await DashApi.sabnzbdGetStats(id || '');

            // Check for decryption error
            if (statsData.decryptionError) {
                console.error('SABnzbd login error: decryption failed');

                // Increment attempt counter
                loginAttemptsRef.current += 1;

                if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                    setAuthError('Failed to decrypt API key after multiple attempts. Please update your credentials in the widget settings.');
                    setIsAuthenticated(false);
                    setLoginAttemptFailed(true);
                } else {
                    setAuthError(`Login attempt ${loginAttemptsRef.current}/${MAX_LOGIN_ATTEMPTS} failed. Retrying...`);

                    // Schedule another attempt
                    setTimeout(() => {
                        if (!isAuthenticated) {
                            handleLogin();
                        }
                    }, 2000);
                }
                return;
            }

            // If we get here, the connection is successful
            setIsAuthenticated(true);
            setAuthError('');
            loginAttemptsRef.current = 0;
            setLoginAttemptFailed(false);

        } catch (error: any) {
            console.error('SABnzbd login error:', error);

            // Increment attempt counter
            loginAttemptsRef.current += 1;

            // Check if we've reached the maximum attempts
            if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                // Check for decryption error
                if (error.response?.data?.error?.includes('Failed to decrypt')) {
                    setAuthError('Failed to decrypt API key. Please update your credentials in the widget settings.');
                } else {
                    setAuthError('Connection error after multiple attempts. Check your SABnzbd settings.');
                }
                setIsAuthenticated(false);
                setLoginAttemptFailed(true);
            } else {
                // If we haven't reached max attempts, show a retry message
                setAuthError(`Login attempt ${loginAttemptsRef.current}/${MAX_LOGIN_ATTEMPTS} failed. Retrying...`);

                // Schedule another attempt
                setTimeout(() => {
                    if (!isAuthenticated) {
                        handleLogin();
                    }
                }, 2000);
            }
        } finally {
            // Only set isLoading to false if we've finished all attempts or succeeded
            if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS || isAuthenticated) {
                setIsLoading(false);
            }
        }
    }, [loginCredentials, config, isAuthenticated, id]);

    const fetchStats = useCallback(async () => {
        if (!isAuthenticated || loginAttemptFailed) return;

        try {
            const statsData = await DashApi.sabnzbdGetStats(id || '');

            // Check for decryption error
            if (statsData.decryptionError) {
                setIsAuthenticated(false);
                setAuthError('Failed to decrypt API key. Please update your credentials in the widget settings.');
                return;
            }

            // Convert SABnzbd stats to DownloadClientStats format
            const downloadStats = {
                dl_info_speed: statsData.speed || statsData.dl_info_speed || 0, // Current download speed
                dl_info_data: statsData.dl_info_data || 0, // Monthly download total from backend (already calculated)
                up_info_speed: 0, // SABnzbd doesn't upload
                up_info_data: 0, // SABnzbd doesn't upload
                torrents: {
                    total: (statsData.downloads?.downloading || 0) + (statsData.downloads?.completed || 0),
                    downloading: statsData.downloads?.downloading || 0,
                    seeding: 0, // SABnzbd doesn't seed
                    completed: statsData.downloads?.completed || 0,
                    paused: statsData.downloads?.paused || 0
                }
            };
            setStats(downloadStats);
        } catch (error) {
            console.error('Error fetching SABnzbd stats:', error);
            // If we get an auth error, set isAuthenticated to false to trigger retry
            if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 403) {
                setIsAuthenticated(false);
                setAuthError('Authentication failed. Retrying...');
                loginAttemptsRef.current = 0; // Reset counter for retry
                setLoginAttemptFailed(false);
            }
        }
    }, [isAuthenticated, loginAttemptFailed, id]);

    const fetchDownloads = useCallback(async () => {
        if (!isAuthenticated || loginAttemptFailed) return;

        try {
            const downloadsData = await DashApi.sabnzbdGetDownloads(id || '');

            // Check if an empty array was returned due to decryption error
            if (Array.isArray(downloadsData) && downloadsData.length === 0 && config?._hasPassword) {
                // If we have credentials but get empty results, it could be a decryption error
                // We'll handle this case by checking the auth status in the next stats fetch
                setDownloads([]);
                return;
            }

            // Convert SABnzbd downloads to DownloadInfo format
            const convertedDownloads = downloadsData.map((download: any) => ({
                hash: download.hash || download.nzo_id, // Use nzo_id as hash equivalent
                name: download.name,
                state: download.state, // Keep SABnzbd states: 'downloading', 'paused', 'completed', etc.
                progress: download.progress,
                size: download.size,
                dlspeed: download.dlspeed,
                upspeed: 0, // SABnzbd doesn't upload
                eta: download.eta // Backend already processes timeleft into eta in seconds
            }));

            // For SABnzbd, keep the original order from the API (which reflects SABnzbd's queue order)
            // The active download should already be first in the queue from SABnzbd
            // No sorting needed - maintain SABnzbd's original queue order
            setDownloads(convertedDownloads);
        } catch (error) {
            console.error('Error fetching SABnzbd downloads:', error);
            if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 403) {
                setIsAuthenticated(false);
                setAuthError('Authentication failed. Retrying...');
                loginAttemptsRef.current = 0; // Reset counter for retry
                setLoginAttemptFailed(false);
            }
        }
    }, [isAuthenticated, loginAttemptFailed, id]);

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        // Reset failed flag when credentials are changed manually
        setLoginAttemptFailed(false);
        loginAttemptsRef.current = 0;
    };

    // Auto-authenticate when config is available and not authenticated
    useEffect(() => {
        if (config?._hasPassword && !isAuthenticated && !loginAttemptFailed) {
            handleLogin();
        }
    }, [config, handleLogin, isAuthenticated, loginAttemptFailed]);

    // Add ref to track current downloads without causing re-renders
    const downloadsRef = useRef<any[]>([]);

    // Update ref when downloads change
    useEffect(() => {
        downloadsRef.current = downloads;
    }, [downloads]);

    // Refresh stats and downloads periodically with dynamic intervals
    useEffect(() => {
        if (!isAuthenticated) return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const scheduleNext = () => {
            // Check if there are any active downloads using ref to avoid dependency issues
            const hasActiveDownloads = downloadsRef.current.some(download =>
                download.state === 'downloading' ||
                download.state === 'active' ||
                download.state === 'extracting'
            );

            // Use 2 seconds if there are active downloads, otherwise 20 seconds
            const interval = hasActiveDownloads ? 2000 : 20000;

            timeoutId = setTimeout(() => {
                Promise.all([fetchStats(), fetchDownloads()]).then(() => {
                    scheduleNext(); // Schedule the next fetch
                });
            }, interval);
        };

        // Initial fetch
        fetchStats();
        fetchDownloads();

        // Start the dynamic polling
        scheduleNext();

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isAuthenticated, fetchStats, fetchDownloads]);

    // Download management functions
    const onResumeDownload = useCallback(async (nzoId: string): Promise<boolean> => {
        try {
            await DashApi.sabnzbdResumeDownload(id || '', nzoId);
            // Refresh downloads list
            setTimeout(() => fetchDownloads(), 500);
            return true;
        } catch (error) {
            console.error('Error resuming download:', error);
            return false;
        }
    }, [id, fetchDownloads]);

    const onPauseDownload = useCallback(async (nzoId: string): Promise<boolean> => {
        try {
            await DashApi.sabnzbdPauseDownload(id || '', nzoId);
            // Refresh downloads list
            setTimeout(() => fetchDownloads(), 500);
            return true;
        } catch (error) {
            console.error('Error pausing download:', error);
            return false;
        }
    }, [id, fetchDownloads]);

    const onDeleteDownload = useCallback(async (nzoId: string, deleteFiles: boolean): Promise<boolean> => {
        try {
            await DashApi.sabnzbdDeleteDownload(id || '', nzoId, deleteFiles);
            // Refresh downloads list
            setTimeout(() => fetchDownloads(), 500);
            return true;
        } catch (error) {
            console.error('Error deleting download:', error);
            return false;
        }
    }, [id, fetchDownloads]);

    return (
        <DownloadClientWidget
            clientName='SABnzbd'
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            authError={authError}
            stats={stats}
            torrents={downloads}
            loginCredentials={loginCredentials}
            handleInputChange={handleInputChange}
            handleLogin={handleLogin}
            showLabel={config?.showLabel !== false}
            onResumeTorrent={onResumeDownload}
            onPauseTorrent={onPauseDownload}
            onDeleteTorrent={onDeleteDownload}
        />
    );
};
