import { useCallback, useEffect, useRef, useState } from 'react';

import { DownloadClientWidget } from './DownloadClientWidget';
import { DashApi } from '../../../../api/dash-api';

type NzbgetWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    _hasPassword?: boolean; // Security flag instead of actual password
    refreshInterval?: number;
    maxDisplayedDownloads?: number;
    showLabel?: boolean;
};

export const NzbgetWidget = (props: { config?: NzbgetWidgetConfig; id?: string }) => {
    const { config, id } = props;

    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [downloads, setDownloads] = useState<any[]>([]);
    const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '6789',
        ssl: config?.ssl || false,
        username: '',
        password: ''
    });

    // Add a counter for login attempts and a maximum number of attempts
    const loginAttemptsRef = useRef(0);
    const MAX_LOGIN_ATTEMPTS = 3;

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials(prev => ({
                host: config.host || '',
                port: config.port !== undefined ? config.port : (prev.port || '6789'),
                ssl: config.ssl || false,
                username: '',
                password: ''
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
            if (!loginCredentials.host || !loginCredentials.port || !config?._hasPassword) {
                // Increment attempt counter
                loginAttemptsRef.current += 1;

                if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                    setAuthError('Connection error after multiple attempts. Please check your NZBGet settings.');
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
            const statsData = await DashApi.nzbgetGetStats(id || '');

            // Check for decryption error
            if (statsData.decryptionError) {
                console.error('NZBGet login error: decryption failed');

                // Increment attempt counter
                loginAttemptsRef.current += 1;

                if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                    setAuthError('Failed to decrypt password after multiple attempts. Please update your credentials in the widget settings.');
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
            console.error('NZBGet login error:', error);

            // Increment attempt counter
            loginAttemptsRef.current += 1;

            // Check if we've reached the maximum attempts
            if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                // Check for decryption error
                if (error.response?.data?.error?.includes('Failed to decrypt')) {
                    setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                } else {
                    setAuthError('Connection error after multiple attempts. Check your NZBGet settings.');
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
            const statsData = await DashApi.nzbgetGetStats(id || '');

            // Check for decryption error
            if (statsData.decryptionError) {
                setIsAuthenticated(false);
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                return;
            }

            // Convert NZBGet stats to DownloadClientStats format
            const downloadStats = {
                dl_info_speed: statsData.downloadSpeed || 0,
                dl_info_data: statsData.cumulative?.downloadedBytes || 0,
                up_info_speed: 0, // NZBGet doesn't upload
                up_info_data: 0,
                torrents: {
                    total: statsData.downloads?.total || 0,
                    downloading: statsData.downloads?.downloading || 0,
                    seeding: 0, // NZBGet doesn't seed
                    completed: statsData.downloads?.completed || 0,
                    paused: statsData.downloads?.paused || 0
                }
            };
            setStats(downloadStats);
        } catch (error) {
            console.error('Error fetching NZBGet stats:', error);
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
            const downloadsData = await DashApi.nzbgetGetDownloads(id || '');

            // Check if an empty array was returned due to decryption error
            if (Array.isArray(downloadsData) && downloadsData.length === 0 && config?._hasPassword) {
                setDownloads([]);
                return;
            }

            setDownloads(downloadsData);
        } catch (error) {
            console.error('Error fetching NZBGet downloads:', error);
            if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 403) {
                setIsAuthenticated(false);
                setAuthError('Authentication failed. Retrying...');
                loginAttemptsRef.current = 0;
                setLoginAttemptFailed(false);
            }
        }
    }, [isAuthenticated, loginAttemptFailed, id, config?._hasPassword]);

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

    // Polling for stats and downloads when authenticated
    useEffect(() => {
        if (!isAuthenticated || loginAttemptFailed) return;

        const refreshInterval = config?.refreshInterval || 5000;
        let timeoutId: NodeJS.Timeout;

        const scheduleNext = () => {
            timeoutId = setTimeout(() => {
                fetchStats();
                fetchDownloads();
                scheduleNext();
            }, refreshInterval);
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
    }, [isAuthenticated, fetchStats, fetchDownloads, config?.refreshInterval, loginAttemptFailed]);

    // Download management functions
    const onResumeDownload = useCallback(async (nzbId: string): Promise<boolean> => {
        try {
            console.log('Resuming NZBGet download, nzbId:', nzbId);
            const result = await DashApi.nzbgetResumeDownload(id || '', nzbId);
            console.log('Resume result:', result);
            // Refresh downloads list
            setTimeout(() => fetchDownloads(), 500);
            return true;
        } catch (error) {
            console.error('Error resuming download:', error);
            return false;
        }
    }, [id, fetchDownloads]);

    const onPauseDownload = useCallback(async (nzbId: string): Promise<boolean> => {
        try {
            console.log('Pausing NZBGet download, nzbId:', nzbId);
            const result = await DashApi.nzbgetPauseDownload(id || '', nzbId);
            console.log('Pause result:', result);
            // Refresh downloads list
            setTimeout(() => fetchDownloads(), 500);
            return true;
        } catch (error) {
            console.error('Error pausing download:', error);
            return false;
        }
    }, [id, fetchDownloads]);

    const onDeleteDownload = useCallback(async (nzbId: string, deleteFiles: boolean): Promise<boolean> => {
        try {
            await DashApi.nzbgetDeleteDownload(id || '', nzbId, deleteFiles);
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
            clientName='NZBGet'
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
