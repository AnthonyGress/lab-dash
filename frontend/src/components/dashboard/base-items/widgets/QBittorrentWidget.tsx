import { useCallback, useEffect, useState } from 'react';

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
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '8080',
        ssl: config?.ssl || false,
        username: config?.username || '',
        password: config?.password || ''
    });

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials({
                host: config.host || 'localhost',
                port: config.port || '8080',
                ssl: config.ssl || false,
                username: config.username || '',
                password: config.password || ''
            });
        }
    }, [config]);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setAuthError('');
        try {
            const success = await DashApi.qbittorrentLogin(loginCredentials);
            setIsAuthenticated(success);
            if (!success) {
                setAuthError('Login failed. Check your credentials and connection.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setAuthError('Connection error. Check your qBittorrent WebUI settings.');
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, [loginCredentials]);

    const fetchStats = useCallback(async () => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const statsData = await DashApi.qbittorrentGetStats(connectionInfo);
            setStats(statsData);
        } catch (error) {
            console.error('Error fetching qBittorrent stats:', error);
            // If we get an auth error, set isAuthenticated to false to show login form
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials]);

    const fetchTorrents = useCallback(async () => {
        try {
            const connectionInfo = {
                host: loginCredentials.host,
                port: loginCredentials.port,
                ssl: loginCredentials.ssl,
                username: loginCredentials.username,
                password: loginCredentials.password
            };
            const torrentsData = await DashApi.qbittorrentGetTorrents(connectionInfo);

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
    }, [loginCredentials, config?.maxDisplayedTorrents]);

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Auto-login when username and password are available
    useEffect(() => {
        if (config?.username && config?.password) {
            handleLogin();
        }
    }, [config, handleLogin]);

    // Refresh stats and torrents periodically
    useEffect(() => {
        // Refresh both stats and torrents when the component mounts
        fetchStats();
        fetchTorrents();

        // Set up periodic refresh
        const interval = setInterval(() => {
            fetchStats();
            fetchTorrents();
        }, 5000); // Fixed interval of 5000ms as specified

        return () => clearInterval(interval);
    }, [fetchStats, fetchTorrents]);

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
        } catch (error) {
            console.error('Error starting qBittorrent torrent:', error);
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
        } catch (error) {
            console.error('Error stopping qBittorrent torrent:', error);
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
        } catch (error) {
            console.error('Error deleting qBittorrent torrent:', error);
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
            showLabel={config?.showLabel !== undefined ? config.showLabel : true}
            onResumeTorrent={handleStartTorrent}
            onPauseTorrent={handleStopTorrent}
            onDeleteTorrent={handleDeleteTorrent}
        />
    );
};
