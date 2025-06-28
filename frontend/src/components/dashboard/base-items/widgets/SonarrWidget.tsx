import React, { useCallback, useEffect, useState } from 'react';

import { QueueItem, QueueManagementWidget } from './QueueManagementWidget';
import { DashApi } from '../../../../api/dash-api';
import { TWENTY_SEC_IN_MS } from '../../../../constants/constants';

interface SonarrWidgetConfig {
    host?: string;
    port?: number;
    ssl?: boolean;
    _hasApiKey?: boolean;
    displayName?: string;
    showLabel?: boolean;
}

interface SonarrWidgetProps {
    id: string;
    config?: SonarrWidgetConfig;
}

export const SonarrWidget: React.FC<SonarrWidgetProps> = ({ id, config }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [error, setError] = useState<string | null>(null);

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
            const response = await DashApi.getSonarrQueue(id);

            // Sort by downloading status first, then by progress
            const sortedQueue = response.sort((a: QueueItem, b: QueueItem) => {
                if (a.state === 'downloading' && b.state !== 'downloading') return -1;
                if (a.state !== 'downloading' && b.state === 'downloading') return 1;
                return b.progress - a.progress;
            });

            setQueueItems(sortedQueue);
        } catch (err) {
            console.error('Failed to fetch Sonarr queue:', err);
            setError('Failed to connect to Sonarr. Please check your configuration.');
            setQueueItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [id, config?.host, config?._hasApiKey]);

    useEffect(() => {
        // Only fetch if we have the required configuration
        if (!id || !config?.host || !config?._hasApiKey) {
            setIsLoading(false);
            setError('Missing required configuration. Please configure host and API key.');
            return;
        }

        // Add a small delay to ensure config is fully loaded after duplication
        const initialFetchTimeout = setTimeout(() => {
            fetchQueueData();
        }, 100);

        // Fixed 20-second interval like download client widgets
        const interval = setInterval(() => {
            // Double-check config is still available before each fetch
            if (id && config?.host && config?._hasApiKey) {
                fetchQueueData();
            }
        }, TWENTY_SEC_IN_MS);

        return () => {
            clearTimeout(initialFetchTimeout);
            clearInterval(interval);
        };
    }, [id, config?.host, config?._hasApiKey, fetchQueueData]);

    const handleRemoveItem = useCallback(async (itemId: string, removeFromClient: boolean, blocklist: boolean): Promise<boolean> => {
        try {
            await DashApi.removeSonarrQueueItem(id, itemId, removeFromClient, blocklist);
            // Refresh the queue after removal
            await fetchQueueData();
            return true;
        } catch (err) {
            console.error('Failed to remove Sonarr queue item:', err);
            return false;
        }
    }, [id, fetchQueueData]);

    return (
        <QueueManagementWidget
            serviceName='Sonarr'
            isLoading={isLoading}
            queueItems={queueItems}
            showLabel={config?.showLabel !== false}
            onRemoveItem={handleRemoveItem}
            error={error}
            connectionDetails={config?.host ? {
                host: config.host,
                port: config.port?.toString() || '8989',
                ssl: config.ssl || false
            } : undefined}
        />
    );
};
