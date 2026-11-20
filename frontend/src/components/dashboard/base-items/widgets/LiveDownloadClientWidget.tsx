import { useCallback } from 'react';

import { DownloadClientStats, DownloadClientWidget, DownloadInfo } from './DownloadClientWidget';
import { useLiveData } from '../../../../hooks/useLiveData';
import { realtime } from '../../../../realtime/socket';

export type DownloadClientConfig = {
    host?: string;
    port?: string;
    ssl?: boolean;
    username?: string;
    _hasPassword?: boolean; // Security flag instead of actual password
    refreshInterval?: number;
    maxDisplayedTorrents?: number;
    showLabel?: boolean;
};

type Props = {
    clientName: string;
    defaultPort: string;
    config?: DownloadClientConfig;
    id?: string;
};

type Snapshot = {
    stats: DownloadClientStats;
    torrents: DownloadInfo[];
};

const noop = () => undefined;

/**
 * A download client widget fed by the server. The server logs in to the client
 * with the saved credentials and pushes transfer speeds and the download list;
 * pause, resume and delete go back over the same connection.
 */
export const LiveDownloadClientWidget = ({ clientName, defaultPort, config, id }: Props) => {
    const { data, error, loading } = useLiveData<Snapshot>('download.client', id);

    const act = useCallback(async (method: string, downloadId: string, params: Record<string, unknown> = {}) => {
        try {
            // The server pushes the updated list as soon as the client has applied the change
            await realtime.call(method, id, { id: downloadId, ...params });
            return true;
        } catch (actionError) {
            console.error(`${clientName} ${method} failed:`, actionError);
            return false;
        }
    }, [clientName, id]);

    return (
        <DownloadClientWidget
            clientName={clientName}
            isLoading={loading}
            isAuthenticated={Boolean(data)}
            authError={data ? '' : error ?? (loading ? 'Connecting...' : '')}
            stats={data?.stats ?? null}
            torrents={data?.torrents ?? []}
            loginCredentials={{
                host: config?.host || '',
                port: config?.port ?? defaultPort,
                ssl: config?.ssl || false
            }}
            handleInputChange={noop}
            handleLogin={realtime.reconnect}
            showLabel={config?.showLabel || false}
            onResumeTorrent={hash => act('download.resume', hash)}
            onPauseTorrent={hash => act('download.pause', hash)}
            onDeleteTorrent={(hash, deleteFiles) => act('download.remove', hash, { deleteFiles })}
        />
    );
};
