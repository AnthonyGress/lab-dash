import { LiveQueueWidget, QueueWidgetConfig } from './LiveQueueWidget';

export const RadarrWidget = (props: { id: string; config?: QueueWidgetConfig }) => (
    <LiveQueueWidget serviceName='Radarr' defaultPort='7878' {...props} />
);
