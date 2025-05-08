import { useCallback, useEffect, useRef, useState } from 'react';

import { TorrentClientWidget } from './TorrentClientWidget';
import { DashApi } from '../../../../api/dash-api';

type QBittorrentWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    username?: string;
    password?: string;
    refreshInterval?: number;
    maxDisplayedTorrents?: number;
    showLabel?: boolean;
};

export const QBittorrentWidget = (props: { config?: QBittorrentWidgetConfig }) => {
    const { config } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [torrents, setTorrents] = useState<any[]>([]);
    const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '8080',
        ssl: config?.ssl || false,
        username: config?.username || '',
        password: config?.password || ''
    });

    // Add a counter for login attempts and a maximum number of attempts
    const loginAttemptsRef = useRef(0);
    const MAX_LOGIN_ATTEMPTS = 3;

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials({
                host: config.host || '',
                port: config.port || '8080',
                ssl: config.ssl || false,
                username: config.username || '',
                password: config.password || ''
            });
            // Reset attempt counter and failed flag when credentials change
            loginAttemptsRef.current = 0;
            setLoginAttemptFailed(false);
        }
    }, [config]);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setAuthError('');
        try {
            const success = await DashApi.qbittorrentLogin(loginCredentials);
            setIsAuthenticated(success);

            if (!success) {
                // Increment attempt counter
                loginAttemptsRef.current += 1;

                // Only set login as failed if we've reached the maximum attempts
                if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                    setAuthError('Login failed after multiple attempts. Check your credentials and connection.');
                    setLoginAttemptFailed(true);
                } else {
                    // If we haven't reached max attempts, show a message but don't set loginAttemptFailed
                    setAuthError(`Login attempt ${loginAttemptsRef.current}/${MAX_LOGIN_ATTEMPTS} failed. Retrying...`);

                    // Schedule another attempt after a short delay
                    setTimeout(() => {
                        if (!isAuthenticated) {
                            handleLogin();
                        }
                    }, 2000);
                }
            } else {
                // Reset counter on success
                loginAttemptsRef.current = 0;
                setLoginAttemptFailed(false);
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
                    setAuthError('Connection error after multiple attempts. Check your qBittorrent WebUI settings.');
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
    }, [loginCredentials, isAuthenticated]);

    const fetchStats = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const statsData = await DashApi.qbittorrentGetStats(connectionInfo);

            // Check for decryption error
            if (statsData.decryptionError) {
                setIsAuthenticated(false);
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                return;
            }

            setStats(statsData);
        } catch (error) {
            console.error('Error fetching qBittorrent stats:', error);
            // If we get an auth error, set isAuthenticated to false to show login form
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials, isAuthenticated]);

    const fetchTorrents = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const torrentsData = await DashApi.qbittorrentGetTorrents(connectionInfo);

            // Check if an empty array was returned due to decryption error
            if (Array.isArray(torrentsData) && torrentsData.length === 0 && loginCredentials.username && loginCredentials.password) {
                // If we have credentials but get empty results, it could be a decryption error
                // We'll handle this case by checking the auth status in the next stats fetch
                setTorrents([]);
                return;
            }

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
            console.error('Error fetching qBittorrent torrents:', error);
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials, config?.maxDisplayedTorrents, isAuthenticated]);

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Auto-login when username and password are available and not authenticated
    useEffect(() => {
        if (config?.username && config?.password && !isAuthenticated && !loginAttemptFailed) {
            handleLogin();
        }
    }, [config, handleLogin, isAuthenticated, loginAttemptFailed]);

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
    const handleStartTorrent = useCallback(async (hash: string) => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            // Use the existing resume API endpoint
            const success = await DashApi.qbittorrentStartTorrent(hash, connectionInfo);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
            }

            return success;
        } catch (error: any) {
            console.error('Error starting qBittorrent torrent:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                setIsAuthenticated(false);
            }
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    const handleStopTorrent = useCallback(async (hash: string) => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            // Use the existing pause API endpoint
            const success = await DashApi.qbittorrentStopTorrent(hash, connectionInfo);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
            }

            return success;
        } catch (error: any) {
            console.error('Error stopping qBittorrent torrent:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                setIsAuthenticated(false);
            }
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
            const success = await DashApi.qbittorrentDeleteTorrent(hash, deleteFiles, connectionInfo);

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
            }

            return success;
        } catch (error: any) {
            console.error('Error deleting qBittorrent torrent:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                setIsAuthenticated(false);
            }
            return false;
        }
    }, [loginCredentials, fetchTorrents]);

    return (
        <TorrentClientWidget
            clientName='qBittorrent'
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            authError={authError}
            stats={stats}
            torrents={torrents}
            loginCredentials={loginCredentials}
            handleInputChange={handleInputChange}
            handleLogin={handleLogin}
            showLabel={config?.showLabel || false}
            onResumeTorrent={handleStartTorrent}
            onPauseTorrent={handleStopTorrent}
            onDeleteTorrent={handleDeleteTorrent}
        />
    );
};
