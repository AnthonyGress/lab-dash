import { Box, Button, CircularProgress, Grid2 as Grid, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaGlobe, FaList, FaPercentage } from 'react-icons/fa';
import { MdBlockFlipped, MdPause, MdPlayArrow } from 'react-icons/md';

import { DashApi } from '../../../../../api/dash-api';
import { BACKEND_URL } from '../../../../../constants/constants';
import { useAppContext } from '../../../../../context/useAppContext';
import { formatNumber } from '../../../../../utils/utils';

// Define our own Timeout type based on setTimeout's return type
type TimeoutId = ReturnType<typeof setTimeout>;

type PiholeWidgetConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    _hasApiToken?: boolean;
    _hasPassword?: boolean;
    showLabel?: boolean;
    displayName?: string;
};

type PiholeStats = {
    domains_being_blocked?: number;
    dns_queries_today?: number;
    ads_blocked_today?: number;
    ads_percentage_today?: number | string;
    status?: string;
    timer?: number | null; // Use timer in seconds instead of until timestamp
};

const initialStats: PiholeStats = {
    domains_being_blocked: 0,
    dns_queries_today: 0,
    ads_blocked_today: 0,
    ads_percentage_today: 0,
    status: 'unknown',
    timer: null
};

export const PiholeWidget = (props: { config?: PiholeWidgetConfig; id?: string }) => {
    const { config, id } = props;
    const { editMode, config: appConfig } = useAppContext();

    // Reference to track if this is the first render
    const isFirstRender = useRef(true);

    const [isLoading, setIsLoading] = useState(false);
    const [isConfigured, setIsConfigured] = useState(() => {
        // Initialize with a proper check of the config
        if (config) {
            return !!config.host && (!!config._hasApiToken || !!config._hasPassword);
        }
        return false;
    });
    const [stats, setStats] = useState<PiholeStats>(initialStats);
    const [error, setError] = useState<string | null>(null);
    const [piholeConfig, setPiholeConfig] = useState({
        host: config?.host || 'pi.hole',
        port: config?.port || '80',
        ssl: config?.ssl || false,
        _hasApiToken: config?._hasApiToken || false,
        _hasPassword: config?._hasPassword || false,
        showLabel: config?.showLabel,
        displayName: config?.displayName || 'Pi-hole'
    });

    // State for disable/enable blocking functionality
    const [isBlocking, setIsBlocking] = useState(true);
    const [disableMenuAnchor, setDisableMenuAnchor] = useState<null | HTMLElement>(null);
    const [isDisablingBlocking, setIsDisablingBlocking] = useState(false);
    const [disableEndTime, setDisableEndTime] = useState<Date | null>(null);
    const [disableTimer, setDisableTimer] = useState<TimeoutId | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');

    // Add a state to track authentication failures
    const [authFailed, setAuthFailed] = useState(false);

    // Add a flag to identify if we're using Pi-hole v6
    const [isPiholeV6, setIsPiholeV6] = useState(false);

    // Add a ref to store the refresh interval
    const refreshIntervalRef = useRef<TimeoutId | null>(null);

    // Add a ref to store the status check interval for Pi-hole v6
    const statusCheckIntervalRef = useRef<TimeoutId | null>(null);

    // Add a ref to track component mounted state to prevent updates after unmount
    const isMountedRef = useRef<boolean>(true);

    // Set isMounted on mount and clear on unmount
    useEffect(() => {
        isMountedRef.current = true;

        // Special initialization logic for first render
        if (isFirstRender.current) {
            isFirstRender.current = false;

            // Force configuration validation on mount
            const isValid = !!piholeConfig.host && (!!piholeConfig._hasApiToken || !!piholeConfig._hasPassword);
            if (isValid !== isConfigured) {
                setIsConfigured(isValid);
            }

            // If valid, trigger an initial status check
            if (isValid) {
                setIsLoading(true);

                // Use a small timeout to ensure state updates have completed
                setTimeout(() => {
                    if (isMountedRef.current && !error && !authFailed) {
                        checkPiholeStatus();
                    }
                }, 200);
            }
        }

        return () => {
            isMountedRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Determine if we're using Pi-hole v6 based on authentication method
    useEffect(() => {
        // Using password-only auth indicates Pi-hole v6
        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        setIsPiholeV6(isV6);
    }, [piholeConfig]);

    // Combined function to check both blocking status and stats in one operation
    const checkPiholeStatus = useCallback(async () => {
        // Skip requests if the component is unmounted
        if (!isMountedRef.current) return;

        // Skip if not properly configured or authentication failed or existing error
        if (!isConfigured || !piholeConfig.host ||
            (!piholeConfig._hasApiToken && !piholeConfig._hasPassword) || authFailed || error) {
            return;
        }

        try {
            // First check Pi-hole blocking status (works for both v5 and v6)
            try {
                if (!id) {
                    console.error('Widget ID is required for Pi-hole blocking status');
                    return;
                }

                // Use direct DashApi method to avoid stale frontend config during duplication
                const blockingData = await DashApi.getPiholeBlockingStatus(id);

                // Update isBlocking state based on status
                const newIsBlocking = blockingData.status === 'enabled';

                // Only update when there's a change to avoid unnecessary renders
                if (isBlocking !== newIsBlocking) {
                    setIsBlocking(newIsBlocking);
                }

                // If disabled with timer, set up the countdown
                if (blockingData.status === 'disabled') {
                    // Check if we have a timer or until value
                    if (blockingData.timer && typeof blockingData.timer === 'number') {
                        // Calculate end time from timer (seconds)
                        const endTime = new Date();
                        endTime.setSeconds(endTime.getSeconds() + blockingData.timer);

                        // Check if this is a significant change from the current end time
                        const shouldUpdateEndTime = !disableEndTime ||
                            Math.abs(endTime.getTime() - disableEndTime.getTime()) > 2000;

                        if (shouldUpdateEndTime) {
                            setDisableEndTime(endTime);

                            // Immediately calculate remaining time for UI responsiveness
                            const now = new Date();
                            const diffMs = endTime.getTime() - now.getTime();
                            const diffSec = Math.floor(diffMs / 1000);
                            const minutes = Math.floor(diffSec / 60);
                            const seconds = diffSec % 60;
                            const newRemainingTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                            setRemainingTime(newRemainingTime);

                            // Update stats
                            setStats(prevStats => ({
                                ...prevStats,
                                status: 'disabled',
                                timer: blockingData.timer
                            }));
                        }
                    } else {
                        // No timer, must be indefinite
                        setDisableEndTime(null);
                        setRemainingTime('');
                        setStats(prevStats => ({
                            ...prevStats,
                            status: 'disabled',
                            timer: null
                        }));
                    }
                } else {
                    // Pi-hole is enabled, clear any end time
                    setDisableEndTime(null);
                    setRemainingTime('');
                    setStats(prevStats => ({
                        ...prevStats,
                        status: 'enabled',
                        timer: null
                    }));
                }
            } catch (statusError: any) {
                // Handle status check errors
                if (statusError.response?.status === 400) {
                    setAuthFailed(true);
                    setError('Bad Request: Invalid configuration or authentication data');
                    return; // Exit early to avoid the stats request
                } else if (statusError.response?.status === 503 || statusError.message?.includes('socket hang up')) {
                    // Handle connection errors specifically
                    console.warn('Pi-hole connection error, will retry on next interval:', statusError.message);
                    // Don't set error state immediately for connection issues, allow retry
                    return; // Exit early but don't set permanent error
                } else if (statusError.response?.status === 504 || statusError.message?.includes('timeout')) {
                    // Handle timeout errors
                    console.warn('Pi-hole timeout error, will retry on next interval:', statusError.message);
                    return; // Exit early but don't set permanent error
                } else if (statusError.message?.includes('Item not found in configuration')) {
                    // Handle "Item not found" errors - this might be a timing issue during duplication
                    console.log('🔄 Pi-hole: Status check failed, retrying in 2s (duplication timing)');
                    // Schedule a retry after a short delay instead of setting permanent error
                    setTimeout(() => {
                        if (isMountedRef.current && !error && !authFailed) {
                            checkPiholeStatus();
                        }
                    }, 2000); // Retry after 2 seconds
                    return; // Exit without setting error state
                }
            }

            // Then fetch stats for both v5 and v6
            try {
                // Don't set loading state here to avoid flickering during regular updates
                // Only set error to null if we're currently showing an error
                if (error) setError(null);

                if (!id) {
                    console.error('Widget ID is required for Pi-hole stats');
                    return;
                }
                const piholeStats = await DashApi.getPiholeStats(id);

                // Reset auth failed flag on successful fetch
                setAuthFailed(false);

                // Set stats from API response (for Pi-hole v5 or if v6 status check failed)
                // For v6, if the status check succeeded, this will have additional data like domain counts
                setStats(prevStats => ({
                    ...piholeStats,
                    // Preserve the status and timer from status check if v6 and they exist
                    status: isPiholeV6 ? (prevStats.status || piholeStats.status) : piholeStats.status,
                    timer: isPiholeV6 ? (prevStats.timer || piholeStats.timer) : piholeStats.timer
                }));

                // Update blocking status if v5 or if v6 status check failed
                if (piholeStats.status === 'disabled' && (!isPiholeV6 || isBlocking)) {
                    setIsBlocking(false);

                    // For Pi-hole v5, handle timer display
                    if (!isPiholeV6 && typeof piholeStats.timer === 'number') {
                        const endTime = new Date();
                        endTime.setSeconds(endTime.getSeconds() + piholeStats.timer);
                        setDisableEndTime(endTime);
                    }
                } else if (piholeStats.status === 'enabled' && !isBlocking) {
                    setIsBlocking(true);
                    setDisableEndTime(null);
                    setRemainingTime('');
                }
            } catch (err: any) {
                // Only set error state on stats fetch errors
                if (err.pihole?.requiresReauth) {
                    setAuthFailed(true);
                    setError('Authentication failed. Please check your Pi-hole credentials in widget settings.');
                } else if (err.response?.status === 401 || err.response?.status === 403) {
                    setAuthFailed(true);
                    setError('Authentication failed. Please check your Pi-hole credentials in widget settings.');
                } else if (err.response?.status === 400) {
                    setAuthFailed(true);
                    setError('Bad Request: Invalid configuration or authentication data');
                } else if (err.response?.status === 503 || err.message?.includes('socket hang up')) {
                    // Handle connection errors - don't set permanent error, allow retry
                    console.warn('Pi-hole connection error during stats fetch, will retry:', err.message);
                    return; // Exit without setting error state
                } else if (err.response?.status === 504 || err.message?.includes('timeout')) {
                    // Handle timeout errors - don't set permanent error, allow retry
                    console.warn('Pi-hole timeout error during stats fetch, will retry:', err.message);
                    return; // Exit without setting error state
                } else if (err.response?.status === 429) {
                    // Check if this is a rate limit from our backend API
                    if (err.response?.data?.error_source === 'labdash_api') {
                        setAuthFailed(true);
                        setError(`Lab-Dash API rate limit exceeded: ${err.response?.data?.message}`);
                    } else {
                        // This is a rate limit from Pi-hole itself
                        setAuthFailed(true);
                        setError('Too many requests to Pi-hole API. The default session expiration is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.');
                    }
                } else if (err.pihole?.code === 'TOO_MANY_REQUESTS') {
                    setAuthFailed(true);
                    setError('Too many requests to Pi-hole API. The default session expiration is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.');
                } else if (err.message?.includes('Network Error') || err.message?.includes('timeout')) {
                    // Network errors like timeouts or connection refused - don't set permanent error for temporary issues
                    console.warn('Pi-hole network error, will retry:', err.message);
                    return; // Exit without setting permanent error state
                } else if (err.message?.includes('Item not found in configuration')) {
                    // Handle "Item not found" errors - this might be a timing issue during duplication
                    console.log('🔄 Pi-hole: Item not found, retrying in 2s (duplication timing)');
                    // Schedule a retry after a short delay instead of setting permanent error
                    setTimeout(() => {
                        if (isMountedRef.current && !error && !authFailed) {
                            checkPiholeStatus();
                        }
                    }, 2000); // Retry after 2 seconds
                    return; // Exit without setting error state
                } else if (err.message) {
                    setAuthFailed(true); // Use authFailed to prevent further requests for all other error types
                    setError(err.message);
                } else {
                    setAuthFailed(true);
                    setError('Failed to connect to Pi-hole. Please check your configuration.');
                }

                // Clear any scheduled checks
                if (statusCheckIntervalRef.current) {
                    clearTimeout(statusCheckIntervalRef.current);
                    statusCheckIntervalRef.current = null;
                }
            }
        } finally {
            // Always make sure isLoading is reset
            setIsLoading(false);
        }
    }, [
        isPiholeV6, isConfigured, piholeConfig, authFailed, isBlocking,
        disableEndTime, isMountedRef, error
    ]);

    // Set up a single polling cycle for all Pi-hole status checks
    useEffect(() => {
        // Clear any existing timeouts
        if (statusCheckIntervalRef.current) {
            clearTimeout(statusCheckIntervalRef.current);
            statusCheckIntervalRef.current = null;
        }

        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }

        // Only set up the polling if configured and not auth failed and no error
        if (isConfigured && !authFailed && !error) {
            // Set loading state on initial mount
            if (!stats.domains_being_blocked) {
                setIsLoading(true);
            }

            // Do an initial check
            checkPiholeStatus();

            // Determine the check interval based on state:
            let checkInterval = 30000; // Default: 30 seconds when enabled (reduced frequency)

            if (!isBlocking && disableEndTime !== null) {
                // Check every 5 seconds only when disabled with an active timer
                checkInterval = 5000;
            }
            // When disabled indefinitely, use the same 30 second interval as when enabled

            // Set up sequential checking with dynamic intervals
            const scheduleNextCheck = () => {
                // Skip if the component is unmounted
                if (!isMountedRef.current) return;

                // Skip if an error occurred or auth failed
                if (error || authFailed) return;

                // Calculate the interval based on the current state
                let interval = 30000; // 30 seconds for enabled state
                if (!isBlocking && disableEndTime !== null) {
                    // Use 5 seconds for disabled with timer
                    interval = 5000;
                }

                // Store the timeout ID for cleanup
                statusCheckIntervalRef.current = setTimeout(async () => {
                    // Double-check error and auth state before making the call
                    if (!error && !authFailed) {
                        await checkPiholeStatus();
                        // Schedule next check only if no errors occurred
                        if (!error && !authFailed) {
                            scheduleNextCheck();
                        }
                    }
                }, interval) as unknown as NodeJS.Timeout;
            };

            // Start the polling cycle
            scheduleNextCheck();
        }

        return () => {
            // Clean up both refs on unmount
            if (statusCheckIntervalRef.current) {
                clearTimeout(statusCheckIntervalRef.current);
                statusCheckIntervalRef.current = null;
            }

            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
        };
    }, [isConfigured, authFailed, isBlocking, disableEndTime, checkPiholeStatus, stats.domains_being_blocked, error]);

    // Update config when props change
    useEffect(() => {
        // Special case: config might be undefined initially and then populated later
        if (!config) {
            if (isConfigured) {
                setIsConfigured(false);
            }
            return;
        }

        const newConfig = {
            host: config.host || 'pi.hole',
            port: config.port !== undefined ? config.port : (piholeConfig.port || '80'),
            ssl: config.ssl || false,
            _hasApiToken: config._hasApiToken || false,
            _hasPassword: config._hasPassword || false,
            showLabel: config.showLabel,
            displayName: config.displayName || 'Pi-hole'
        };

        // Check if this is a valid configuration
        const isValid = !!config.host && (!!config._hasApiToken || !!config._hasPassword);

        // If configured state doesn't match validity, update it
        if (isValid !== isConfigured) {
            setIsConfigured(isValid);
        }

        // Only update if config has actually changed
        const configChanged =
            newConfig.host !== piholeConfig.host ||
            newConfig.port !== piholeConfig.port ||
            newConfig.ssl !== piholeConfig.ssl ||
            newConfig._hasApiToken !== piholeConfig._hasApiToken ||
            newConfig._hasPassword !== piholeConfig._hasPassword;

        if (configChanged) {
            // Update config
            setPiholeConfig(newConfig);

            // Reset error and auth states since config changed
            setAuthFailed(false);
            setError(null);

            // Reset stats
            setStats(initialStats);

            // Clear any polling timeouts
            if (statusCheckIntervalRef.current) {
                clearTimeout(statusCheckIntervalRef.current);
                statusCheckIntervalRef.current = null;
            }

            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }

            // Show loading state and trigger immediate check
            if (isValid) {
                setIsLoading(true);
                // Small delay to ensure state updates are processed
                setTimeout(() => {
                    if (isMountedRef.current) {
                        checkPiholeStatus();
                    }
                }, 200);
            }
        } else {
            // Just update the display settings if those changed
            setPiholeConfig(prev => ({
                ...prev,
                showLabel: config.showLabel,
                displayName: config.displayName || 'Pi-hole'
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    // Define updateRemainingTime before using it in the effect
    const updateRemainingTime = useCallback(() => {
        // Don't update if component is unmounted
        if (!isMountedRef.current) return;

        let targetTime = disableEndTime;

        // For Pi-hole v6, calculate from stats.timer if available
        if (isPiholeV6 && typeof stats.timer === 'number' && stats.timer > 0) {
            // If we have a timer but no end time, calculate it
            if (!targetTime) {
                const newEndTime = new Date();
                newEndTime.setSeconds(newEndTime.getSeconds() + stats.timer);
                setDisableEndTime(newEndTime);
                targetTime = newEndTime;
            }
        }

        if (!targetTime) {
            setRemainingTime('');
            return;
        }

        const now = new Date();
        const diffMs = targetTime.getTime() - now.getTime();

        if (diffMs <= 0) {
            setRemainingTime('');

            // Only update if component is still mounted
            if (isMountedRef.current) {
                // For Pi-hole v6, we should check status again as the timer might have expired
                if (isPiholeV6) {
                    checkPiholeStatus();
                } else {
                    // For v5, just trigger a refresh as we can't check status separately
                    setTimeout(() => checkPiholeStatus(), 500);
                }
            }
            return;
        }

        const diffSec = Math.floor(diffMs / 1000);
        const minutes = Math.floor(diffSec / 60);
        const seconds = diffSec % 60;

        const newRemainingTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Only update state if the time has actually changed
        if (newRemainingTime !== remainingTime) {
            setRemainingTime(newRemainingTime);
        }
    }, [disableEndTime, stats.timer, isPiholeV6, remainingTime, checkPiholeStatus]);

    // Update remaining time every second when a timed disable is active
    useEffect(() => {
        // For Pi-hole v6, use the timer value if available
        if (isPiholeV6 && typeof stats.timer === 'number' && stats.timer > 0) {
            if (!disableEndTime) {
                // Calculate end time from timer if we don't have one
                const newEndTime = new Date();
                newEndTime.setSeconds(newEndTime.getSeconds() + stats.timer);
                setDisableEndTime(newEndTime);
            }
        }

        if (!disableEndTime && !stats.timer) {
            // If no timer is active, clear remaining time
            if (remainingTime) {
                setRemainingTime('');
            }
            return;
        }

        // Update immediately
        updateRemainingTime();

        // Then update every second - we still update the countdown display every second
        // even though we're only checking the server status every 5 seconds
        const interval = setInterval(() => {
            updateRemainingTime();
        }, 1000);

        return () => clearInterval(interval);
    }, [disableEndTime, stats.timer, isPiholeV6, remainingTime, updateRemainingTime]);

    // Handle disable blocking with timeout
    const handleDisableBlocking = async (seconds: number | null) => {
        if (!isConfigured || (!piholeConfig._hasApiToken && !piholeConfig._hasPassword)) return;

        setIsDisablingBlocking(true);
        setDisableMenuAnchor(null);

        try {
            // Don't update UI state here - wait for API call to complete

            if (!id) {
                throw new Error('Widget ID is required for Pi-hole disable');
            }

            // Call the backend API to disable blocking - use direct method to avoid stale config
            const result = await DashApi.disablePihole(id, seconds || undefined);

            if (result) {
                // Only update UI after successful API call
                setIsBlocking(false);

                // For timed disables, set up the timer view
                if (seconds !== null) {
                    const endTime = new Date();
                    endTime.setSeconds(endTime.getSeconds() + seconds);
                    setDisableEndTime(endTime);

                    // Calculate and set remaining time immediately
                    const diffSec = seconds;
                    const minutes = Math.floor(diffSec / 60);
                    const secs = diffSec % 60;
                    setRemainingTime(`${minutes}:${secs.toString().padStart(2, '0')}`);

                    // Update stats with timer
                    setStats(prevStats => ({
                        ...prevStats,
                        status: 'disabled',
                        timer: seconds
                    }));
                } else {
                    // For indefinite disables, clear timer
                    setDisableEndTime(null);
                    setRemainingTime('');

                    // Update stats for indefinite disable
                    setStats(prevStats => ({
                        ...prevStats,
                        status: 'disabled',
                        timer: null
                    }));
                }

                // For Pi-hole v6, trigger an immediate status check
                if (isPiholeV6) {
                    checkPiholeStatus();
                } else {
                    // For Pi-hole v5, handle the local timer
                    if (seconds !== null) {
                        // Clear any existing timer
                        if (disableTimer) {
                            clearTimeout(disableTimer);
                        }

                        // Set new timer
                        const timer = setTimeout(() => {
                            handleEnableBlocking();
                            setDisableEndTime(null);
                            setRemainingTime('');
                        }, seconds * 1000);

                        setDisableTimer(timer as unknown as TimeoutId);
                    } else {
                        // Indefinite disable for v5
                        if (disableTimer) {
                            clearTimeout(disableTimer);
                            setDisableTimer(null);
                        }
                    }
                }
            } else {
                throw new Error('Failed to disable Pi-hole blocking');
            }
        } catch (err: any) {
            // Error handling remains the same
            setIsBlocking(true);
            setDisableEndTime(null);
            setRemainingTime('');

            // Check if this is an authentication error that requires re-auth
            if (err.pihole?.requiresReauth) {
                setAuthFailed(true);
                setError('Authentication failed. Please check your Pi-hole credentials in widget settings.');
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                setAuthFailed(true);
                setError('Authentication failed. Please check your Pi-hole credentials in widget settings.');
            } else if (err.response?.status === 429) {
                // Check if this is a rate limit from our backend API
                if (err.response?.data?.error_source === 'labdash_api') {
                    setAuthFailed(true);
                    setError(`Lab-Dash API rate limit exceeded: ${err.response?.data?.message}`);
                } else {
                    // This is a rate limit from Pi-hole itself
                    setAuthFailed(true);
                    setError('Too many requests to Pi-hole API. The default session expiration is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.');
                }
            } else if (err.pihole?.code === 'TOO_MANY_REQUESTS') {
                setAuthFailed(true);
                setError('Too many requests to Pi-hole API. The default session expiration is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.');
            } else if (err.message?.includes('Network Error') || err.message?.includes('timeout')) {
                setAuthFailed(true);
                setError(`Connection failed: ${err.message}. Please check if Pi-hole is running.`);
            } else {
                // Generic error
                setError(err.message || 'Failed to disable Pi-hole blocking');
            }
        } finally {
            setIsDisablingBlocking(false);
        }
    };

    // Handle enable blocking
    const handleEnableBlocking = useCallback(async () => {
        if (isDisablingBlocking) return; // Prevent action if we're already handling a state change

        setIsDisablingBlocking(true); // Use the same lock for enable operations

        try {
            setIsLoading(true);

            if (!id) {
                throw new Error('Widget ID is required for Pi-hole enable');
            }

            // Call API first, don't update UI state optimistically - use direct method to avoid stale config
            await DashApi.enablePihole(id);

            // Only update UI after successful API call
            setIsBlocking(true);
            setDisableEndTime(null);
            setRemainingTime('');

            // Clear any disable timer
            if (disableTimer) {
                clearTimeout(disableTimer);
                setDisableTimer(null);
            }

            setIsLoading(false);
            // Fetch updated stats after enabling
            await checkPiholeStatus();
        } catch (err: any) {
            // On error, revert UI state
            setIsBlocking(false);
            setIsLoading(false);

            // Check if this is an authentication error that requires re-auth
            if (err.pihole?.requiresReauth) {
                setAuthFailed(true);
                setError('Authentication failed. Please check your Pi-hole credentials in widget settings.');
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                setAuthFailed(true);
                setError('Authentication failed. Please check your Pi-hole credentials in widget settings.');
            } else if (err.response?.status === 429) {
                // Check if this is a rate limit from our backend API
                if (err.response?.data?.error_source === 'labdash_api') {
                    setAuthFailed(true);
                    setError(`Lab-Dash API rate limit exceeded: ${err.response?.data?.message}`);
                } else {
                    // This is a rate limit from Pi-hole itself
                    setAuthFailed(true);
                    setError('Too many requests to Pi-hole API. The default session expiration is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.');
                }
            } else if (err.pihole?.code === 'TOO_MANY_REQUESTS') {
                setAuthFailed(true);
                setError('Too many requests to Pi-hole API. The default session expiration is 30 minutes. You can manually clear unused sessions or increase the max_sessions setting in Pi-hole.');
            } else if (err.message?.includes('Network Error') || err.message?.includes('timeout')) {
                setAuthFailed(true);
                setError(`Connection failed: ${err.message}. Please check if Pi-hole is running.`);
            } else {
                // Generic error
                setError(err.message || 'Failed to enable Pi-hole blocking');
            }
        } finally {
            setIsDisablingBlocking(false);
        }
    }, [piholeConfig, checkPiholeStatus, disableTimer, isDisablingBlocking]);

    // Clean up disable timer on unmount
    useEffect(() => {
        return () => {
            if (disableTimer) {
                clearTimeout(disableTimer);
            }
        };
    }, [disableTimer]);

    // Reset authentication state and retry
    const handleRetry = () => {
        // Clear error and reset auth failure state
        setAuthFailed(false);
        setError(null);

        // Reset all timers and states
        setDisableEndTime(null);
        setRemainingTime('');
        if (disableTimer) {
            clearTimeout(disableTimer);
            setDisableTimer(null);
        }

        // Clear any existing timeouts for polling
        if (statusCheckIntervalRef.current) {
            clearTimeout(statusCheckIntervalRef.current);
            statusCheckIntervalRef.current = null;
        }

        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }

        // Recheck configuration
        const isValid = !!piholeConfig.host && (!!piholeConfig._hasApiToken || !!piholeConfig._hasPassword);
        setIsConfigured(isValid);

        // Reset stats to initial state
        setStats(initialStats);

        // Set loading state to show that we're retrying
        setIsLoading(true);

        // Perform an immediate check with the combined function
        setTimeout(() => checkPiholeStatus(), 100);
    };

    // Handle menu open
    const handleDisableMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setDisableMenuAnchor(event.currentTarget);
    };

    // Handle menu close
    const handleDisableMenuClose = () => {
        setDisableMenuAnchor(null);
    };

    // Format remaining time (use the state value now)
    const formatRemainingTime = (): string => {
        return remainingTime;
    };

    // Create base URL for Pi-hole admin panel
    const getBaseUrl = () => {
        if (!piholeConfig.host) return '';

        // Strip any existing protocol prefix
        const cleanHost = piholeConfig.host.replace(/^https?:\/\//, '');
        const protocol = piholeConfig.ssl ? 'https' : 'http';
        const port = piholeConfig.port ? `:${piholeConfig.port}` : '';

        // The base API URL is the same for both v5 and v6
        return `${protocol}://${cleanHost}${port}/admin`;
    };

    // Handle opening the Pi-hole admin dashboard (default page)
    const handleOpenPiholeAdmin = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        // Main dashboard is /admin for both v5 and v6
        window.open(baseUrl, '_blank');
    };

    // Handle opening the queries page (percentage blocked)
    const handleOpenQueriesPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        // For v6, direct links won't work without authentication, so just open the main admin page
        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/queries`, '_blank');
            return;
        }

        const queriesUrl = `${baseUrl}/queries.php`;
        window.open(queriesUrl, '_blank');
    };

    // Handle opening the blocked queries page
    const handleOpenBlockedPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/queries?upstream=blocklist`, '_blank');
            return;
        }

        const blockedUrl = `${baseUrl}/queries.php?forwarddest=blocked`;
        window.open(blockedUrl, '_blank');
    };

    // Handle opening the network page (queries today)
    const handleOpenNetworkPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/network`, '_blank');
            return;
        }

        // For v5, we can deep link directly
        const networkUrl = `${baseUrl}/network.php`;
        window.open(networkUrl, '_blank');
    };

    // Handle opening the adlists page
    const handleOpenAdlistsPage = () => {
        const baseUrl = getBaseUrl();
        if (!baseUrl) return;

        const isV6 = !!piholeConfig._hasPassword && !piholeConfig._hasApiToken;
        if (isV6) {
            window.open(`${baseUrl}/groups-lists`, '_blank');
            return;
        }

        const adlistsUrl = `${baseUrl}/groups-adlists.php`;
        window.open(adlistsUrl, '_blank');
    };

    if (error) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2
            }}>
                <Typography variant='subtitle1' align='center'>
                    {error}
                </Typography>
                <Typography variant='caption' align='center' sx={{ mt: 1, fontSize: '0.8rem' }}>
                    {authFailed ?
                        `Using ${piholeConfig._hasApiToken ? 'API token' : 'password'} authentication` :
                        'Check your Pi-hole configuration and network connection'}
                </Typography>
                <Button
                    variant='contained'
                    color='primary'
                    sx={{ mt: 2 }}
                    onClick={handleRetry}
                >
                    Retry
                </Button>
            </Box>
        );
    }

    if (!isConfigured) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <Typography variant='subtitle1'>
                    Please configure the Pi-hole widget in settings
                </Typography>
            </Box>
        );
    }

    if (isLoading && !stats.domains_being_blocked) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <CircularProgress size={30} />
            </Box>
        );
    }

    // Convert percentage to number if it's a string
    const parsePercentage = (value: number | string | undefined): number => {
        if (value === undefined) return 0;
        if (typeof value === 'number') return value;

        // Handle string representation
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Get percentage as a number for the progress circle
    const blockPercentage = parsePercentage(stats.ads_percentage_today);

    // Format the percentage text
    const percentageText = blockPercentage.toFixed(1);

    return (
        <Box sx={{ p: 0.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
            }}>
                {/* Left side - Pi-hole title */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {piholeConfig.showLabel && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%',
                                cursor: editMode ? 'grab' : 'pointer',
                                '&:hover': {
                                    opacity: editMode ? 1 : 0.8
                                }
                            }}
                            onClick={editMode ? undefined : handleOpenPiholeAdmin}
                            mb={0.5}
                        >
                            <img
                                src={`${BACKEND_URL}/icons/pihole.svg`}
                                alt='Pi-hole logo'
                                style={{
                                    width: '30px',
                                    height: '30px',
                                }}
                            />
                            <Typography variant='h6' sx={{ mb: 0, fontSize: '1rem', ml: 0.5 }}>
                                {piholeConfig.displayName}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Right side - Disable/Enable button - Only show when not in edit mode */}
                {!editMode && (
                    <Button
                        variant='text'
                        startIcon={isBlocking ? <MdPause /> : <MdPlayArrow />}
                        onClick={isBlocking ? handleDisableMenuClick : handleEnableBlocking}
                        disabled={isDisablingBlocking}
                        sx={{
                            height: 25,
                            fontSize: '0.7rem',
                            color: 'white',
                            minWidth: '80px', // Add fixed minimum width to prevent size changes
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ml: 'auto'
                        }}
                    >
                        {isBlocking ? 'Disable' : (remainingTime ? `Resume (${remainingTime})` : 'Resume')}
                    </Button>
                )}

                {/* Disable interval menu */}
                <Menu
                    anchorEl={disableMenuAnchor}
                    open={Boolean(disableMenuAnchor)}
                    onClose={handleDisableMenuClose}
                    closeAfterTransition={false}
                >
                    <MenuItem onClick={() => handleDisableBlocking(10)}>10 seconds</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(30)}>30 seconds</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(60)}>1 minute</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(300)}>5 minutes</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(1800)}>30 minutes</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(3600)}>1 hour</MenuItem>
                    <MenuItem onClick={() => handleDisableBlocking(null)}>Indefinitely</MenuItem>
                </Menu>
            </Box>

            <Grid container spacing={0.4} sx={{ flex: 1 }}>
                {/* Blocked Today */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : handleOpenBlockedPage}
                        sx={{
                            backgroundColor: '#74281E',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <MdBlockFlipped style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Blocked Today
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.ads_blocked_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Percent Blocked */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : handleOpenQueriesPage}
                        sx={{
                            backgroundColor: '#8E5B0A',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FaPercentage style={{ fontSize: '1.6rem' }} />
                        </Box>
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Percent Blocked
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {percentageText}%
                        </Typography>
                    </Paper>
                </Grid>

                {/* Queries Today */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : handleOpenNetworkPage}
                        sx={{
                            backgroundColor: '#006179',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <FaGlobe style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Queries Today
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.dns_queries_today || 0)}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Domains on Adlists */}
                <Grid size={{ xs: 6 }}>
                    <Paper
                        elevation={0}
                        onClick={editMode ? undefined : handleOpenAdlistsPage}
                        sx={{
                            backgroundColor: '#004A28',
                            p: '5px 8px',
                            minHeight: '60px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: editMode ? 'grab' : 'pointer',
                            '&:hover': {
                                opacity: editMode ? 1 : 0.9,
                                boxShadow: editMode ? 0 : 2
                            }
                        }}
                    >
                        <FaList style={{ fontSize: '1.6rem' }} />
                        <Typography variant='body2' align='center' sx={{ mt: 0, mb: 0, fontSize: '0.75rem' }}>
                            Domains on Adlists
                        </Typography>
                        <Typography variant='subtitle2' align='center' fontWeight='bold' sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                            {formatNumber(stats.domains_being_blocked || 0)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Status indicator - only show when not in edit mode and blocking is disabled */}
            {!editMode && !isBlocking && (
                <Box sx={{ mt: 0.2, textAlign: 'center' }}>
                    <Typography variant='caption' color='white' sx={{ fontSize: '0.6rem' }}>
                        {remainingTime
                            ? `Blocking disabled. Will resume in ${remainingTime}`
                            : 'Blocking disabled indefinitely'}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};
