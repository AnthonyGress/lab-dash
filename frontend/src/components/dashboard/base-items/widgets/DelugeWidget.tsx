import { useCallback, useEffect, useState } from 'react';

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

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials({
                host: config.host || 'localhost',
                port: config.port || '8112',
                ssl: config.ssl || false,
                username: config.username || '',
                password: config.password || ''
            });
            // Reset failed flag when credentials are updated
            setLoginAttemptFailed(false);
        }
    }, [config]);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setAuthError('');
        try {
            const success = await DashApi.delugeLogin(loginCredentials);
            setIsAuthenticated(success);
            if (!success) {
                setAuthError('Login failed. Check your credentials and connection.');
                setLoginAttemptFailed(true);
            } else {
                setLoginAttemptFailed(false);
            }
        } catch (error: any) {
            console.error('Login error:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
            } else {
                setAuthError('Connection error. Check your Deluge WebUI settings.');
            }
            setIsAuthenticated(false);
            setLoginAttemptFailed(true);
        } finally {
            setIsLoading(false);
        }
    }, [loginCredentials]);

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
    };

    // Auto-login when username and password are available and no previous login attempt failed
    useEffect(() => {
        if (config?.username && config?.password && !loginAttemptFailed && !isAuthenticated) {
            handleLogin();
        }
    }, [config, handleLogin, loginAttemptFailed, isAuthenticated]);

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
            }, 5000); // Fixed interval of 5000ms as specified

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
