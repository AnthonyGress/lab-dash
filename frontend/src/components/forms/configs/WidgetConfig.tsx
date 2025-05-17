import { UseFormReturn } from 'react-hook-form';

import { FormValues } from '../AddEditForm';
import { DateTimeWidgetConfig } from './DateTimeWidgetConfig';
import { DualWidgetConfig } from './DualWidgetConfig';
import { GroupWidgetConfig } from './GroupWidgetConfig';
import { PiholeWidgetConfig } from './PiholeWidgetConfig';
import { SystemMonitorWidgetConfig } from './SystemMonitorWidgetConfig';
import { TorrentClientWidgetConfig } from './TorrentClientWidgetConfig';
import { WeatherWidgetConfig } from './WeatherWidgetConfig';
import { ITEM_TYPE } from '../../../types';

interface WidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    widgetType: string;
}

export const WidgetConfig = ({ formContext, widgetType }: WidgetConfigProps) => {
    switch (widgetType) {
    case ITEM_TYPE.WEATHER_WIDGET:
        return <WeatherWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.DATE_TIME_WIDGET:
        return <DateTimeWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
        return <SystemMonitorWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.PIHOLE_WIDGET:
        return <PiholeWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.TORRENT_CLIENT:
        return <TorrentClientWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.DUAL_WIDGET:
        return <DualWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.GROUP_WIDGET:
        return <GroupWidgetConfig formContext={formContext} />;
    default:
        return null;
    }
};
