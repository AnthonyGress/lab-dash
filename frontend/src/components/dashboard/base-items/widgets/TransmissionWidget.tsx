import { useCallback, useEffect, useRef, useState } from 'react';

import { DownloadClientWidget } from './DownloadClientWidget';
import { DashApi } from '../../../../api/dash-api';

// Helper function to convert Transmission status codes to common state strings
const getTransmissionState = (status: number): string => {
    switch (status) {
    case 0: return 'stopped';        // TR_STATUS_STOPPED
    case 1: return 'checkingResumeData'; // TR_STATUS_CHECK_WAIT
    case 2: return 'checkingDL';     // TR_STATUS_CHECK
    case 3: return 'stalledDL';      // TR_STATUS_DOWNLOAD_WAIT
    case 4: return 'downloading';    // TR_STATUS_DOWNLOAD
    case 5: return 'stalledUP';      // TR_STATUS_SEED_WAIT
    case 6: return 'seeding';        // TR_STATUS_SEED
    default: return 'unknown';
    }
};

type TransmissionWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    username?: string;
    _hasPassword?: boolean; // Security flag instead of actual password
    refreshInterval?: number;
    maxDisplayedTorrents?: number;
    showLabel?: boolean;
};

export const TransmissionWidget = (props: { config?: TransmissionWidgetConfig; id?: string }) => {
    const { config, id } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [torrents, setTorrents] = useState<any[]>([]);
    const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);
    const [loginCredentials, setLoginCredentials] = useState({
        host: config?.host || 'localhost',
        port: config?.port || '9091',
        ssl: config?.ssl || false,
        username: config?.username || '',
        password: '' // Password is handled on backend, not sent to frontend
    });

    // Add a counter for login attempts and a maximum number of attempts
    const loginAttemptsRef = useRef(0);
    const MAX_LOGIN_ATTEMPTS = 3;

    // Update credentials when config changes
    useEffect(() => {
        if (config) {
            setLoginCredentials(prev => ({
                host: config.host || '',
                port: config.port !== undefined ? config.port : (prev.port || '9091'),
                ssl: config.ssl || false,
                username: config.username || '',
                password: '' // Password is handled on backend, not sent to frontend
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
            // If no username and no password configured, skip login and go straight to authenticated state
            // For Transmission, authentication is optional
            if (!config?.username && !config?._hasPassword) {
                setIsAuthenticated(true);
                loginAttemptsRef.current = 0;
                setLoginAttemptFailed(false);
                setIsLoading(false);
                return;
            }

            const success = await DashApi.transmissionLogin(id || '');
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
                    setAuthError('Connection error after multiple attempts. Check your Transmission settings.');
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
            const statsData = await DashApi.transmissionGetStats(id || '');

            // Check for decryption error
            if (statsData.decryptionError) {
                setIsAuthenticated(false);
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                return;
            }

            // Convert Transmission stats format to common format
            // Transmission session-stats returns: downloadSpeed, uploadSpeed, cumulative-stats with downloadedBytes/uploadedBytes
            const convertedStats = {
                dl_info_speed: statsData.downloadSpeed || 0,
                dl_info_data: statsData['cumulative-stats']?.downloadedBytes || 0,
                up_info_speed: statsData.uploadSpeed || 0,
                up_info_data: statsData['cumulative-stats']?.uploadedBytes || 0,
                torrents: {
                    total: statsData.torrentCount || 0,
                    downloading: statsData.activeTorrentCount || 0,
                    seeding: statsData.activeTorrentCount || 0,
                    completed: 0,
                    paused: statsData.pausedTorrentCount || 0
                }
            };

            setStats(convertedStats);
        } catch (error) {
            console.error('Error fetching Transmission stats:', error);
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
            const torrentsData = await DashApi.transmissionGetTorrents(id || '');

            // Check if an empty array was returned due to decryption error
            if (Array.isArray(torrentsData) && torrentsData.length === 0 && loginCredentials.username && config?._hasPassword) {
                // If we have credentials but get empty results, it could be a decryption error
                // We'll handle this case by checking the auth status in the next stats fetch
                setTorrents([]);
                return;
            }

            // Convert Transmission format to common format and sort
            const convertedTorrents = torrentsData.map((torrent: any) => ({
                hash: torrent.hashString || torrent.id?.toString() || '',
                id: torrent.id, // Keep original ID for API calls
                name: torrent.name || '',
                state: getTransmissionState(torrent.status),
                progress: torrent.percentDone || 0,
                size: torrent.totalSize || 0,
                dlspeed: torrent.rateDownload || 0,
                upspeed: torrent.rateUpload || 0,
                eta: torrent.eta && torrent.eta > 0 ? torrent.eta : undefined
            }));

            // Sort by progress (downloading first) then by name
            const sortedTorrents = convertedTorrents.sort((a: any, b: any) => {
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
            console.error('Error fetching Transmission torrents:', error);
            if ((error as any)?.response?.status === 401) {
                setIsAuthenticated(false);
                setAuthError('Session expired. Please login again.');
            }
        }
    }, [loginCredentials, isAuthenticated]);

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Auto-login when config is available and not authenticated
    // For Transmission, credentials are optional
    useEffect(() => {
        if (config && !isAuthenticated && !loginAttemptFailed) {
            handleLogin();
        }
    }, [config, handleLogin, isAuthenticated, loginAttemptFailed]);



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
            // For Transmission, only consider downloading state for fast polling (not seeding/uploading)
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
    const handleStartTorrent = useCallback(async (hash: string) => {
        try {
            // For Transmission, we need to find the torrent ID from the hash
            const torrent = torrents.find(t => t.hash === hash);
            if (!torrent) return false;

            const success = await DashApi.transmissionStartTorrent(torrent.id || hash, id || '');

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
                // Schedule another refresh after 2 seconds to ensure state is updated
                setTimeout(() => {
                    fetchTorrents();
                }, 2000);
            }

            return success;
        } catch (error: any) {
            console.error('Error starting Transmission torrent:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                setIsAuthenticated(false);
            }
            return false;
        }
    }, [loginCredentials, fetchTorrents, torrents]);

    const handleStopTorrent = useCallback(async (hash: string) => {
        try {
            // For Transmission, we need to find the torrent ID from the hash
            const torrent = torrents.find(t => t.hash === hash);
            if (!torrent) return false;

            const success = await DashApi.transmissionStopTorrent(torrent.id || hash, id || '');

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
                // Schedule another refresh after 2 seconds to ensure state is updated
                setTimeout(() => {
                    fetchTorrents();
                }, 2000);
            }

            return success;
        } catch (error: any) {
            console.error('Error stopping Transmission torrent:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                setIsAuthenticated(false);
            }
            return false;
        }
    }, [loginCredentials, fetchTorrents, torrents]);

    const handleDeleteTorrent = useCallback(async (hash: string, deleteFiles: boolean) => {
        try {
            // For Transmission, we need to find the torrent ID from the hash
            const torrent = torrents.find(t => t.hash === hash);
            if (!torrent) return false;

            const success = await DashApi.transmissionDeleteTorrent(torrent.id || hash, deleteFiles, id || '');

            // Refresh the torrents list after operation
            if (success) {
                await fetchTorrents();
                // Schedule another refresh after 2 seconds to ensure state is updated
                setTimeout(() => {
                    fetchTorrents();
                }, 2000);
            }

            return success;
        } catch (error: any) {
            console.error('Error deleting Transmission torrent:', error);
            // Check for decryption error
            if (error.response?.data?.error?.includes('Failed to decrypt password')) {
                setAuthError('Failed to decrypt password. Please update your credentials in the widget settings.');
                setIsAuthenticated(false);
            }
            return false;
        }
    }, [loginCredentials, fetchTorrents, torrents]);

    return (
        <DownloadClientWidget
            clientName='Transmission'
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
