import { useCallback, useEffect, useRef, useState } from 'react';

import { DownloadClientWidget } from './DownloadClientWidget';
import { DashApi } from '../../../../api/dash-api';

type DelugeWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    username?: string;
    _hasPassword?: boolean; // Security flag instead of actual password
    refreshInterval?: number;
    maxDisplayedTorrents?: number;
    showLabel?: boolean;
};

export const DelugeWidget = (props: { config?: DelugeWidgetConfig; id?: string }) => {
    const { config, id } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [torrents, setTorrents] = useState<any[]>([]);
    const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '8112',
        ssl: config?.ssl || false,
        username: config?.username || '',
        password: '' // Password is handled on backend, not sent to frontend
    });

    // Add a counter for login attempts and a maximum number of attempts
    const loginAttemptsRef = useRef(0);
    const MAX_LOGIN_ATTEMPTS = 3;
    const autoLoginAttemptedRef = useRef(false);

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            // Only update if there are actual changes to credentials
            const newCredentials = {
                host: config.host || '',
                port: config.port !== undefined ? config.port : (loginCredentials.port || '8112'),
                ssl: config.ssl || false,
                username: config.username || '',
                password: '' // Password is handled on backend, not sent to frontend
            };

            const credentialsChanged =
                newCredentials.host !== loginCredentials.host ||
                newCredentials.port !== loginCredentials.port ||
                newCredentials.ssl !== loginCredentials.ssl ||
                newCredentials.username !== loginCredentials.username ||
                newCredentials.password !== loginCredentials.password;

            if (credentialsChanged) {
                console.log('Credentials changed, updating state');
                setLoginCredentials(newCredentials);
                // Reset failed flag and attempt counter when credentials are updated
                setLoginAttemptFailed(false);
                loginAttemptsRef.current = 0;
                autoLoginAttemptedRef.current = false; // Reset auto-login flag when credentials change
            }
        }
    }, [config]);

    const handleLogin = useCallback(async () => {
        if (isLoading) {
            console.log('Login already in progress, skipping');
            return; // Prevent multiple simultaneous login attempts
        }

        setIsLoading(true);
        setAuthError('');

        try {
            if (!id) {
                throw new Error('Widget ID is required but not provided');
            }
            const success = await DashApi.delugeLogin(id);
            setIsAuthenticated(success);

            if (!success) {
                // Increment attempt counter
                loginAttemptsRef.current += 1;
                console.log(`Login attempt ${loginAttemptsRef.current} failed`);

                // Only set login as failed if we've reached the maximum attempts
                if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                    console.log('Max login attempts reached, setting failed flag');
                    setAuthError('Login failed after multiple attempts. Check your credentials and connection.');
                    setLoginAttemptFailed(true);
                } else {
                    // If we haven't reached max attempts, show a message but don't set loginAttemptFailed
                    setAuthError(`Login attempt ${loginAttemptsRef.current}/${MAX_LOGIN_ATTEMPTS} failed. Retrying...`);

                    // Schedule another attempt after a short delay
                    setTimeout(() => {
                        if (!isAuthenticated) {
                            console.log('Retrying login...');
                            handleLogin();
                        }
                    }, 2000);
                }
            } else {
                // Reset counter on success
                loginAttemptsRef.current = 0;
                setLoginAttemptFailed(false);
                autoLoginAttemptedRef.current = true;
            }
        } catch (error: any) {
            console.error('Login error:', error);

            // Increment attempt counter
            loginAttemptsRef.current += 1;

            // Check if we've reached the maximum attempts
            if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                // Check for decryption error
                if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                    setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                } else {
                    setAuthError('Connection error after multiple attempts. Check your Deluge WebUI settings.');
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
    }, [loginCredentials, isAuthenticated, isLoading]);

    // Auto-login when component mounts or credentials change
    useEffect(() => {
        if (
            config?._hasPassword &&
            !autoLoginAttemptedRef.current &&
            !isAuthenticated &&
            !loginAttemptFailed
        ) {
            autoLoginAttemptedRef.current = true; // Mark that we've attempted auto-login
            // Use a short delay to ensure component is fully mounted
            setTimeout(() => {
                handleLogin();
            }, 500);
        }
    }, [config, handleLogin, isAuthenticated, loginAttemptFailed]);

    const fetchStats = useCallback(async () => {
        if (loginAttemptFailed || !isAuthenticated) return;

        try {
            if (!id) {
                console.error('Widget ID is required for stats');
                return;
            }
            const statsData = await DashApi.delugeGetStats(id);

            // Check for decryption error
            if (statsData.decryptionError) {
                setIsAuthenticated(false);
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                return;
            }

            setStats(statsData);
        } catch (error) {
            console.error('Error fetching Deluge stats:', error);
            // If we get an auth error, set isAuthenticated to false to show login form
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials, isAuthenticated, loginAttemptFailed]);

    const fetchTorrents = useCallback(async () => {
        if (loginAttemptFailed || !isAuthenticated) return;

        try {
            if (!id) {
                console.error('Widget ID is required for torrents');
                return;
            }
            const torrentsData = await DashApi.delugeGetTorrents(id);
            // Sort by progress (downloading first) then by name
            const sortedTorrents = torrentsData.sort((a, b) => {
                // Prioritize downloading torrents
                if (a.state === 'downloading' && b.state !== 'downloading') return -1;
                if (a.state !== 'downloading' && b.state === 'downloading') return 1;

                // Then by progress (least complete first)
                if (a.progress !== b.progress) return a.progress - b.progress;

                // Then alphabetically
                return a.name.localeCompare(b.name);
            });

            // No limit on torrents - show all torrents
            setTorrents(sortedTorrents);
        } catch (error) {
            console.error('Error fetching Deluge torrents:', error);
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials, isAuthenticated, loginAttemptFailed]);

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        // Reset failed flag when credentials are changed manually
        setLoginAttemptFailed(false);
        autoLoginAttemptedRef.current = false; // Allow auto-login to be attempted again
    };

    // Add ref to track current torrents without causing re-renders
    const torrentsRef = useRef<any[]>([]);

    // Update ref when torrents change
    useEffect(() => {
        torrentsRef.current = torrents;
    }, [torrents]);

    // Refresh stats and torrents periodically with dynamic intervals
    useEffect(() => {
        if (!isAuthenticated) return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const scheduleNext = () => {
            // Check if there are any active downloads using ref to avoid dependency issues
            const hasActiveDownloads = torrentsRef.current.some(torrent =>
                torrent.state === 'downloading' ||
                torrent.state === 'checking' ||
                torrent.state === 'metaDl'
            );

            // Use 2 seconds if there are active downloads, otherwise 20 seconds
            const interval = hasActiveDownloads ? 2000 : 20000;

            timeoutId = setTimeout(() => {
                Promise.all([fetchStats(), fetchTorrents()]).then(() => {
                    scheduleNext(); // Schedule the next fetch
                });
            }, interval);
        };

        // Initial fetch
        fetchStats();
        fetchTorrents();

        // Start the dynamic polling
        scheduleNext();

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isAuthenticated, fetchStats, fetchTorrents]);

    // Torrent actions
    const handleResumeTorrent = useCallback(async (hash: string) => {
        try {
            if (!id) {
                console.error('Widget ID is required for resume torrent');
                return false;
            }
            const success = await DashApi.delugeResumeTorrent(hash, id);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
                // Schedule another refresh after 2 seconds to ensure state is updated
                setTimeout(() => {
                    fetchTorrents();
                }, 2000);
            }

            return success;
        } catch (error) {
            console.error('Error resuming Deluge torrent:', error);
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    const handlePauseTorrent = useCallback(async (hash: string) => {
        try {
            if (!id) {
                console.error('Widget ID is required for pause torrent');
                return false;
            }
            const success = await DashApi.delugePauseTorrent(hash, id);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
                // Schedule another refresh after 2 seconds to ensure state is updated
                setTimeout(() => {
                    fetchTorrents();
                }, 2000);
            }

            return success;
        } catch (error) {
            console.error('Error pausing Deluge torrent:', error);
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    const handleDeleteTorrent = useCallback(async (hash: string, deleteFiles: boolean) => {
        try {
            if (!id) {
                console.error('Widget ID is required for delete torrent');
                return false;
            }
            const success = await DashApi.delugeDeleteTorrent(hash, deleteFiles, id);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
                // Schedule another refresh after 2 seconds to ensure state is updated
                setTimeout(() => {
                    fetchTorrents();
                }, 2000);
            }

            return success;
        } catch (error) {
            console.error('Error deleting Deluge torrent:', error);
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    return (
        <DownloadClientWidget
            clientName='Deluge'
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            authError={authError}
            stats={stats}
            torrents={torrents}
            loginCredentials={loginCredentials}
            handleInputChange={handleInputChange}
            handleLogin={handleLogin}
            showLabel={config?.showLabel || false}
            onResumeTorrent={handleResumeTorrent}
            onPauseTorrent={handlePauseTorrent}
            onDeleteTorrent={handleDeleteTorrent}
        />
    );
};
