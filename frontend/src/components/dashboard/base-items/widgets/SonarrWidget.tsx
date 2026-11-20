import { LiveQueueWidget, QueueWidgetConfig } from './LiveQueueWidget';

export const SonarrWidget = (props: { id: string; config?: QueueWidgetConfig }) => (
    <LiveQueueWidget serviceName='Sonarr' defaultPort='8989' {...props} />
);
