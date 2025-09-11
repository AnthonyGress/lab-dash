import React, { useCallback, useEffect, useRef, useState } from 'react';

import { QueueItem, QueueManagementWidget } from './QueueManagementWidget';
import { DashApi } from '../../../../api/dash-api';
import { TWENTY_SEC_IN_MS } from '../../../../constants/constants';

interface RadarrWidgetConfig {
    host?: string;
    port?: number;
    ssl?: boolean;
    _hasApiKey?: boolean;
    displayName?: string;
    showLabel?: boolean;
}

interface RadarrWidgetProps {
    id: string;
    config?: RadarrWidgetConfig;
}

export const RadarrWidget: React.FC<RadarrWidgetProps> = ({ id, config }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [statistics, setStatistics] = useState<{
        totalItems: number;
        monitoredItems: number;
        isLoading: boolean;
    }>({
        totalItems: 0,
        monitoredItems: 0,
        isLoading: true
    });

    const fetchQueueData = useCallback(async () => {
        // Check for required configuration and valid ID
        if (!id || !config?.host || !config?._hasApiKey) {
            setIsLoading(false);
            setError('Missing required configuration. Please configure host and API key.');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const response = await DashApi.getRadarrQueue(id);

            // Sort by downloading status first, then by progress
            const sortedQueue = response.sort((a: QueueItem, b: QueueItem) => {
                if (a.state === 'downloading' && b.state !== 'downloading') return -1;
                if (a.state !== 'downloading' && b.state === 'downloading') return 1;
                return b.progress - a.progress;
            });

            setQueueItems(sortedQueue);
        } catch (err) {
            console.error('Failed to fetch Radarr queue:', err);
            setError('Failed to connect to Radarr. Please check your configuration.');
            setQueueItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [id, config?.host, config?._hasApiKey]);

    const fetchStatistics = useCallback(async () => {
        if (!id || !config?.host || !config?._hasApiKey) {
            setStatistics(prev => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            setStatistics(prev => ({ ...prev, isLoading: true }));
            const response = await DashApi.getRadarrMovies(id);
            setStatistics({
                totalItems: response.totalMovies || 0,
                monitoredItems: response.monitoredMovies || 0,
                isLoading: false
            });
        } catch (err) {
            console.error('Failed to fetch Radarr movies statistics:', err);
            setStatistics({
                totalItems: 0,
                monitoredItems: 0,
                isLoading: false
            });
        }
    }, [id, config?.host, config?._hasApiKey]);

    // Add ref to track current queue items without causing re-renders
    const queueItemsRef = useRef<QueueItem[]>([]);

    // Update ref when queue items change
    useEffect(() => {
        queueItemsRef.current = queueItems;
    }, [queueItems]);

    useEffect(() => {
        // Only fetch if we have the required configuration
        if (!id || !config?.host || !config?._hasApiKey) {
            setIsLoading(false);
            setError('Missing required configuration. Please configure host and API key.');
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout>;

        const scheduleNext = () => {
            // Check if there are any active downloads using ref to avoid dependency issues
            const hasActiveDownloads = queueItemsRef.current.some(item =>
                item.state === 'downloading' ||
                item.state === 'active'
            );

            // Use 2 seconds if there are active downloads, otherwise 20 seconds
            const interval = hasActiveDownloads ? 2000 : TWENTY_SEC_IN_MS;

            timeoutId = setTimeout(() => {
                // Double-check config is still available before each fetch
                if (id && config?.host && config?._hasApiKey) {
                    fetchQueueData().then(() => {
                        scheduleNext(); // Schedule the next fetch
                    });
                }
            }, interval);
        };

        // Add a small delay to ensure config is fully loaded after duplication
        const initialFetchTimeout = setTimeout(() => {
            fetchQueueData();
            fetchStatistics();
            // Start the dynamic polling after initial fetch
            scheduleNext();
        }, 100);

        return () => {
            clearTimeout(initialFetchTimeout);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [id, config?.host, config?._hasApiKey, fetchQueueData, fetchStatistics]);

    const handleRemoveItem = useCallback(async (itemId: string, removeFromClient: boolean, blocklist: boolean): Promise<boolean> => {
        try {
            await DashApi.removeRadarrQueueItem(id, itemId, removeFromClient, blocklist);
            // Refresh the queue after removal
            await fetchQueueData();
            return true;
        } catch (err) {
            console.error('Failed to remove Radarr queue item:', err);
            return false;
        }
    }, [id, fetchQueueData]);

    return (
        <QueueManagementWidget
            serviceName='Radarr'
            isLoading={isLoading}
            queueItems={queueItems}
            showLabel={config?.showLabel !== false}
            onRemoveItem={handleRemoveItem}
            error={error}
            statistics={statistics}
            connectionDetails={config?.host ? {
                host: config.host,
                port: config.port?.toString() || '7878',
                ssl: config.ssl || false
            } : undefined}
        />
    );
};
