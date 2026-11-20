import { DownloadClientConfig, LiveDownloadClientWidget } from './LiveDownloadClientWidget';

export const TransmissionWidget = (props: { config?: DownloadClientConfig; id?: string }) => (
    <LiveDownloadClientWidget clientName='Transmission' defaultPort='9091' {...props} />
);
