import { DownloadClientConfig, LiveDownloadClientWidget } from './LiveDownloadClientWidget';

export const QBittorrentWidget = (props: { config?: DownloadClientConfig; id?: string }) => (
    <LiveDownloadClientWidget clientName='qBittorrent' defaultPort='8080' {...props} />
);
