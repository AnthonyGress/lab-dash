import { useCallback } from 'react';

import { QueueItem, QueueManagementWidget } from './QueueManagementWidget';
import { useLiveData } from '../../../../hooks/useLiveData';
import { realtime } from '../../../../realtime/socket';

export type QueueWidgetConfig = {
    host?: string;
    port?: number;
    ssl?: boolean;
    _hasApiKey?: boolean;
    displayName?: string;
    showLabel?: boolean;
};

type Props = {
    serviceName: string;
    defaultPort: string;
    id: string;
    config?: QueueWidgetConfig;
};

type Snapshot = {
    queue: QueueItem[];
    statistics: { totalItems: number; monitoredItems: number };
};

/**
 * A Sonarr or Radarr queue fed by the server, which follows active downloads
 * closely and pushes changes; removing an item goes back over the same connection.
 */
export const LiveQueueWidget = ({ serviceName, defaultPort, id, config }: Props) => {
    const isConfigured = Boolean(id && config?.host && config?._hasApiKey);
    const { data, error, loading } = useLiveData<Snapshot>('arr.queue', id, isConfigured);

    const handleRemoveItem = useCallback(async (itemId: string, removeFromClient: boolean, blocklist: boolean) => {
        try {
            // The server pushes the updated queue as soon as the item is gone
            await realtime.call('arr.queue.remove', id, { id: itemId, removeFromClient, blocklist });
            return true;
        } catch (err) {
            console.error(`Failed to remove ${serviceName} queue item:`, err);
            return false;
        }
    }, [id, serviceName]);

    return (
        <QueueManagementWidget
            serviceName={serviceName}
            isLoading={loading}
            queueItems={data?.queue ?? []}
            showLabel={config?.showLabel !== false}
            onRemoveItem={handleRemoveItem}
            error={isConfigured
                ? (data ? null : error ?? null)
                : 'Missing required configuration. Please configure host and API key.'}
            statistics={{
                totalItems: data?.statistics.totalItems ?? 0,
                monitoredItems: data?.statistics.monitoredItems ?? 0,
                isLoading: !data
            }}
            connectionDetails={config?.host ? {
                host: config.host,
                port: config.port?.toString() || defaultPort,
                ssl: config.ssl || false
            } : undefined}
        />
    );
};
