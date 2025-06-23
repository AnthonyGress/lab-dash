import { UseFormReturn } from 'react-hook-form';

import { FormValues } from '../AddEditForm';
import { AdGuardWidgetConfig } from './AdGuardWidgetConfig';
import { DateTimeWidgetConfig } from './DateTimeWidgetConfig';
import { DownloadClientWidgetConfig } from './DownloadClientWidgetConfig';
import { DualWidgetConfig } from './DualWidgetConfig';
import { GroupWidgetConfig } from './GroupWidgetConfig';
import { PiholeWidgetConfig } from './PiholeWidgetConfig';
import { SystemMonitorWidgetConfig } from './SystemMonitorWidgetConfig';
import { WeatherWidgetConfig } from './WeatherWidgetConfig';
import { DashboardItem, ITEM_TYPE } from '../../../types';

interface WidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    widgetType: string;
    existingItem?: DashboardItem | null;
}

export const WidgetConfig = ({ formContext, widgetType, existingItem }: WidgetConfigProps) => {
    switch (widgetType) {
    case ITEM_TYPE.WEATHER_WIDGET:
        return <WeatherWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.DATE_TIME_WIDGET:
        return <DateTimeWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
        return <SystemMonitorWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.PIHOLE_WIDGET:
        return <PiholeWidgetConfig formContext={formContext} existingItem={existingItem} />;
    case ITEM_TYPE.ADGUARD_WIDGET:
        return <AdGuardWidgetConfig formContext={formContext} existingItem={existingItem} />;
    case ITEM_TYPE.DOWNLOAD_CLIENT:
        return <DownloadClientWidgetConfig formContext={formContext} existingItem={existingItem} />;
    case ITEM_TYPE.TORRENT_CLIENT: // Legacy support - maps to DOWNLOAD_CLIENT
        return <DownloadClientWidgetConfig formContext={formContext} existingItem={existingItem} />;
    case ITEM_TYPE.DUAL_WIDGET:
        return <DualWidgetConfig formContext={formContext} existingItem={existingItem} />;
    case ITEM_TYPE.GROUP_WIDGET:
        return <GroupWidgetConfig formContext={formContext} />;
    default:
        return null;
    }
};
