import { DownloadClientConfig, LiveDownloadClientWidget } from './LiveDownloadClientWidget';

export const DelugeWidget = (props: { config?: DownloadClientConfig; id?: string }) => (
    <LiveDownloadClientWidget clientName='Deluge' defaultPort='8112' {...props} />
);
