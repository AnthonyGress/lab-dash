import { useCallback, useEffect, useRef, useState } from 'react';

import { TorrentClientWidget } from './TorrentClientWidget';
import { DashApi } from '../../../../api/dash-api';

type DelugeWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    username?: string;
    password?: string;
    maxDisplayedTorrents?: number;
    showLabel?: boolean;
};

export const DelugeWidget = (props: { config?: DelugeWidgetConfig }) => {
    const { config } = props;
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
        password: config?.password || ''
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
                port: config.port || '8112',
                ssl: config.ssl || false,
                username: config.username || '',
                password: config.password || ''
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
            const success = await DashApi.delugeLogin(loginCredentials);
            console.log('Deluge login result:', success);
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
                console.log('Login successful');
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
            config?.password &&
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
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const statsData = await DashApi.delugeGetStats(connectionInfo);

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
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const torrentsData = await DashApi.delugeGetTorrents(connectionInfo);
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

            // Limit the number of torrents displayed
            const maxTorrents = config?.maxDisplayedTorrents || 5;
            setTorrents(sortedTorrents.slice(0, maxTorrents));
        } catch (error) {
            console.error('Error fetching Deluge torrents:', error);
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials, config?.maxDisplayedTorrents, isAuthenticated, loginAttemptFailed]);

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

    // Refresh stats and torrents periodically
    useEffect(() => {
        // Only fetch data if authenticated
        if (isAuthenticated) {
            fetchStats();
            fetchTorrents();

            // Set up periodic refresh
            const interval = setInterval(() => {
                fetchStats();
                fetchTorrents();
            }, 30000); // 30 seconds

            return () => clearInterval(interval);
        }
    }, [fetchStats, fetchTorrents, isAuthenticated]);

    // Torrent actions
    const handleResumeTorrent = useCallback(async (hash: string) => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const success = await DashApi.delugeResumeTorrent(hash, connectionInfo);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
            }

            return success;
        } catch (error) {
            console.error('Error resuming Deluge torrent:', error);
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    const handlePauseTorrent = useCallback(async (hash: string) => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const success = await DashApi.delugePauseTorrent(hash, connectionInfo);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
            }

            return success;
        } catch (error) {
            console.error('Error pausing Deluge torrent:', error);
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    const handleDeleteTorrent = useCallback(async (hash: string, deleteFiles: boolean) => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const success = await DashApi.delugeDeleteTorrent(hash, deleteFiles, connectionInfo);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
            }

            return success;
        } catch (error) {
            console.error('Error deleting Deluge torrent:', error);
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    return (
        <TorrentClientWidget
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
