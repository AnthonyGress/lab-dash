import React from 'react';

import { DashboardItem, DOWNLOAD_CLIENT_TYPE, ITEM_TYPE } from '../../types';
import { AppShortcut } from './base-items/apps/AppShortcut';
import { BlankAppShortcut } from './base-items/apps/BlankAppShortcut';
import { AdGuardWidget } from './base-items/widgets/AdGuardWidget/AdGuardWidget';
import { BlankWidget } from './base-items/widgets/BlankWidget';
import { DateTimeWidget } from './base-items/widgets/DateTimeWidget';
import { DelugeWidget } from './base-items/widgets/DelugeWidget';
import { DiskMonitorWidget } from './base-items/widgets/DiskMonitorWidget';
import { DualWidget } from './base-items/widgets/DualWidget';
import { GroupWidgetItem } from './base-items/widgets/GroupWidgetItem';
import { MediaRequestManagerWidget } from './base-items/widgets/MediaRequestManagerWidget';
import { MediaServerWidget } from './base-items/widgets/MediaServerWidget/MediaServerWidget';
import { NotesWidget } from './base-items/widgets/NotesWidget/NotesWidget';
import { NzbgetWidget } from './base-items/widgets/NzbgetWidget';
import { PiholeWidget } from './base-items/widgets/PiholeWidget/PiholeWidget';
import { QBittorrentWidget } from './base-items/widgets/QBittorrentWidget';
import { RadarrWidget } from './base-items/widgets/RadarrWidget';
import { SabnzbdWidget } from './base-items/widgets/SabnzbdWidget';
import { SonarrWidget } from './base-items/widgets/SonarrWidget';
import { SystemMonitorWidget } from './base-items/widgets/SystemMonitorWidget/SystemMonitorWidget';
import { TransmissionWidget } from './base-items/widgets/TransmissionWidget';
import { WeatherWidget } from './base-items/widgets/WeatherWidget';
import { WidgetContainer } from './base-items/widgets/WidgetContainer';

type Props = {
    item: DashboardItem;
    editMode: boolean;
    onDelete: (item: DashboardItem) => void;
    onEdit: (item: DashboardItem) => void;
    onDuplicate: (item: DashboardItem) => void;
};

const renderDownloadClient = (item: DashboardItem) => {
    // The legacy torrent-client type shares these values, minus the usenet clients
    switch (item.config?.clientType) {
    case DOWNLOAD_CLIENT_TYPE.DELUGE:
        return <DelugeWidget config={item.config} id={item.id} />;
    case DOWNLOAD_CLIENT_TYPE.TRANSMISSION:
        return <TransmissionWidget config={item.config} id={item.id} />;
    case DOWNLOAD_CLIENT_TYPE.SABNZBD:
        if (item.type === ITEM_TYPE.DOWNLOAD_CLIENT) return <SabnzbdWidget config={item.config} id={item.id} />;
        break;
    case DOWNLOAD_CLIENT_TYPE.NZBGET:
        if (item.type === ITEM_TYPE.DOWNLOAD_CLIENT) return <NzbgetWidget config={item.config} id={item.id} />;
        break;
    }

    return <QBittorrentWidget config={item.config} id={item.id} />;
};

/**
 * What a dashboard item shows inside its grid cell. Position, size and dragging
 * belong to DashboardGridItem; this only picks the widget for the item's type.
 */
export const DashboardItemContent = React.memo(({ item, editMode, onDelete, onEdit, onDuplicate }: Props) => {
    const { id } = item;
    // The stored config is free-form; each widget declares the shape it reads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = item.config;
    const actions = {
        editMode,
        id,
        onDelete: () => onDelete(item),
        onEdit: () => onEdit(item),
        onDuplicate: () => onDuplicate(item),
    };
    const contained = (widget: React.ReactNode) => <WidgetContainer {...actions}>{widget}</WidgetContainer>;

    switch (item.type) {
    case ITEM_TYPE.WEATHER_WIDGET:
        return contained(<WeatherWidget config={config} id={id} />);
    case ITEM_TYPE.DATE_TIME_WIDGET:
        return contained(
            <DateTimeWidget config={{
                location: config?.location || null,
                timezone: config?.timezone || undefined,
                use24Hour: config?.use24Hour || false
            }} />
        );
    case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
        return contained(<SystemMonitorWidget config={config} editMode={editMode} id={id} />);
    case ITEM_TYPE.DISK_MONITOR_WIDGET:
        return contained(<DiskMonitorWidget config={config} editMode={editMode} id={id} />);
    case ITEM_TYPE.PIHOLE_WIDGET:
        return contained(<PiholeWidget config={config} id={id} />);
    case ITEM_TYPE.ADGUARD_WIDGET:
        return contained(<AdGuardWidget config={config} id={id} />);
    case ITEM_TYPE.DOWNLOAD_CLIENT:
    case ITEM_TYPE.TORRENT_CLIENT:
        return contained(renderDownloadClient(item));
    case ITEM_TYPE.NOTES_WIDGET:
        return contained(<NotesWidget config={config} />);
    case ITEM_TYPE.SONARR_WIDGET:
        return contained(<SonarrWidget config={config} id={id} />);
    case ITEM_TYPE.RADARR_WIDGET:
        return contained(<RadarrWidget config={config} id={id} />);
    case ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET:
        return contained(
            <MediaRequestManagerWidget
                id={id}
                service={config?.service || 'jellyseerr'}
                host={config?.host}
                port={config?.port}
                ssl={config?.ssl}
                _hasApiKey={config?._hasApiKey}
                displayName={config?.displayName}
                showLabel={config?.showLabel}
            />
        );
    // These bring their own container
    case ITEM_TYPE.MEDIA_SERVER_WIDGET:
        return <MediaServerWidget config={config} {...actions} />;
    case ITEM_TYPE.DUAL_WIDGET:
        return (
            <DualWidget
                config={{ topWidget: config?.topWidget || undefined, bottomWidget: config?.bottomWidget || undefined }}
                {...actions}
            />
        );
    case ITEM_TYPE.GROUP_WIDGET:
        return <GroupWidgetItem label={item.label} config={config} {...actions} />;
    case ITEM_TYPE.APP_SHORTCUT:
        return (
            <WidgetContainer
                {...actions}
                url={config?.healthUrl || item.url}
                healthCheckType={config?.healthCheckType || 'http'}
            >
                <AppShortcut
                    url={item.url}
                    name={item.label}
                    iconName={item.icon?.path || ''}
                    showLabel={item.showLabel}
                    editMode={editMode}
                    config={config}
                />
            </WidgetContainer>
        );
    case ITEM_TYPE.BLANK_APP:
        return <BlankAppShortcut {...actions} />;
    default:
        return <BlankWidget {...actions} />;
    }
});

DashboardItemContent.displayName = 'DashboardItemContent';
