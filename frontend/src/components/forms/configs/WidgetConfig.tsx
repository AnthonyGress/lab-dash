import { UseFormReturn } from 'react-hook-form';

import { AdGuardWidgetConfig } from './AdGuardWidgetConfig';
import { DateTimeWidgetConfig } from './DateTimeWidgetConfig';
import { DiskMonitorWidgetConfig } from './DiskMonitorWidgetConfig';
import { DownloadClientWidgetConfig } from './DownloadClientWidgetConfig';
import { DualWidgetConfig } from './DualWidgetConfig';
import { GroupWidgetConfig } from './GroupWidgetConfig';
import { MediaRequestManagerWidgetConfig } from './MediaRequestManagerWidgetConfig';
import { MediaServerWidgetConfig } from './MediaServerWidgetConfig';
import { NotesWidgetConfig } from './NotesWidgetConfig';
import { PiholeWidgetConfig } from './PiholeWidgetConfig';
import { RadarrWidgetConfig } from './RadarrWidgetConfig';
import { SonarrWidgetConfig } from './SonarrWidgetConfig';
import { SystemMonitorWidgetConfig } from './SystemMonitorWidgetConfig';
import { WeatherWidgetConfig } from './WeatherWidgetConfig';
import { DashboardItem, ITEM_TYPE } from '../../../types';
import { FormValues } from '../AddEditForm/types';

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
    case ITEM_TYPE.DISK_MONITOR_WIDGET:
        return <DiskMonitorWidgetConfig formContext={formContext} />;
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
    case ITEM_TYPE.MEDIA_SERVER_WIDGET:
        return <MediaServerWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET:
        return <MediaRequestManagerWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.NOTES_WIDGET:
        return <NotesWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.SONARR_WIDGET:
        return <SonarrWidgetConfig formContext={formContext} />;
    case ITEM_TYPE.RADARR_WIDGET:
        return <RadarrWidgetConfig formContext={formContext} />;
    default:
        return null;
    }
};
