import { DownloadClientConfig, LiveDownloadClientWidget } from './LiveDownloadClientWidget';

export const SabnzbdWidget = (props: { config?: DownloadClientConfig; id?: string }) => (
    <LiveDownloadClientWidget clientName='SABnzbd' defaultPort='8080' {...props} />
);
