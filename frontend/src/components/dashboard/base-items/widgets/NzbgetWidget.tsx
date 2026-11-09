import { DownloadClientConfig, LiveDownloadClientWidget } from './LiveDownloadClientWidget';

export const NzbgetWidget = (props: { config?: DownloadClientConfig; id?: string }) => (
    <LiveDownloadClientWidget clientName='NZBGet' defaultPort='6789' {...props} />
);
