import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { FormValues } from './types';
import { DashboardItem, DOWNLOAD_CLIENT_TYPE, ITEM_TYPE } from '../../../types';

type UseExistingItemProps = {
    existingItem?: DashboardItem | null;
    formContext: UseFormReturn<FormValues>;
    setCustomIconFile: (file: File | null) => void;
};

export const useExistingItem = ({ existingItem, formContext, setCustomIconFile }: UseExistingItemProps) => {
    useEffect(() => {
        // Determine initial values based on existingItem
        const initialItemType = existingItem?.type === ITEM_TYPE.WEATHER_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DATE_TIME_WIDGET ||
                               existingItem?.type === ITEM_TYPE.SYSTEM_MONITOR_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DISK_MONITOR_WIDGET ||
                               existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET ||
                               existingItem?.type === ITEM_TYPE.ADGUARD_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT ||
                               existingItem?.type === ITEM_TYPE.TORRENT_CLIENT || // Legacy support
                               existingItem?.type === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                               existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ||
                               existingItem?.type === ITEM_TYPE.NOTES_WIDGET ||
                               existingItem?.type === ITEM_TYPE.SONARR_WIDGET ||
                               existingItem?.type === ITEM_TYPE.RADARR_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DUAL_WIDGET ||
                               existingItem?.type === ITEM_TYPE.GROUP_WIDGET
            ? 'widget'
            : (existingItem?.type === ITEM_TYPE.BLANK_WIDGET ||
               existingItem?.type === ITEM_TYPE.BLANK_ROW ||
               existingItem?.type === ITEM_TYPE.BLANK_APP)
                ? ITEM_TYPE.PLACEHOLDER
                : existingItem?.type || '';

        // Determine placeholder size from existing item type
        const initialPlaceholderSize = existingItem?.type === ITEM_TYPE.BLANK_APP ? 'app'
            : existingItem?.type === ITEM_TYPE.BLANK_WIDGET ? 'widget'
                : existingItem?.type === ITEM_TYPE.BLANK_ROW ? 'row'
                    : 'app'; // default

        const initialWidgetType = existingItem?.type === ITEM_TYPE.WEATHER_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.DATE_TIME_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.SYSTEM_MONITOR_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.DISK_MONITOR_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.ADGUARD_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT ||
                                  existingItem?.type === ITEM_TYPE.TORRENT_CLIENT || // Legacy support - map to DOWNLOAD_CLIENT
                                  existingItem?.type === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.NOTES_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.SONARR_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.RADARR_WIDGET
            ? (existingItem?.type === ITEM_TYPE.TORRENT_CLIENT ? ITEM_TYPE.DOWNLOAD_CLIENT : existingItem?.type)
            : existingItem?.type === ITEM_TYPE.DUAL_WIDGET ||
                                    existingItem?.type === ITEM_TYPE.GROUP_WIDGET
                ? existingItem?.type
                : '';

        const initialShowLabel = (existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT ||
                                  existingItem?.type === ITEM_TYPE.TORRENT_CLIENT || // Legacy support
                                  existingItem?.type === ITEM_TYPE.ADGUARD_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.NOTES_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.SONARR_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.RADARR_WIDGET)
            ? (existingItem?.config?.showLabel !== undefined ? existingItem.config.showLabel : true)
            : (existingItem?.showLabel !== undefined ? existingItem.showLabel : false);

        // Initialize other component state
        setCustomIconFile(null);

        // Initialize dual widget values if editing a dual widget
        let topWidgetType = '';
        let bottomWidgetType = '';
        const temperatureUnit = existingItem?.config?.temperatureUnit || 'fahrenheit';
        const location = existingItem?.config?.location || null;
        const systemMonitorGauges = existingItem?.config?.gauges || ['cpu', 'temp', 'ram'];
        const networkInterface = existingItem?.config?.networkInterface || '';
        const piholeHost = existingItem?.config?.piholeHost || existingItem?.config?.host || '';
        const piholePort = existingItem?.config?.piholePort || existingItem?.config?.port || '';
        const piholeSsl = existingItem?.config?.piholeSsl !== undefined
            ? existingItem?.config?.piholeSsl
            : existingItem?.config?.ssl || false;
        // Use masked values for sensitive data - actual values are never sent to frontend
        const piholeApiToken = existingItem?.config?._hasApiToken ? '**********' : '';
        const piholePassword = existingItem?.config?._hasPassword ? '**********' : '';
        const piholeName = existingItem?.config?.displayName || '';

        // AdGuard widget initialization
        const adguardHost = existingItem?.config?.host || '';
        const adguardPort = existingItem?.config?.port !== undefined ? existingItem.config.port : '80'; // AdGuard Home default web interface port
        const adguardSsl = existingItem?.config?.ssl || false;
        // Use masked values for sensitive data - actual values are never sent to frontend
        const adguardUsername = existingItem?.config?._hasUsername ? '**********' : '';
        const adguardPassword = existingItem?.config?._hasPassword ? '**********' : '';
        const adguardName = existingItem?.config?.displayName || '';

        const healthUrl = existingItem?.config?.healthUrl || '';

        // Extract maxItems for group widget
        let maxItems = '3'; // Default to 3
        if (existingItem?.type === ITEM_TYPE.GROUP_WIDGET && existingItem?.config?.maxItems) {
            // Check if it's one of the special format strings
            if (existingItem.config.maxItems === 6) {
                // Default to 6_3x2 layout for backward compatibility
                maxItems = '6_3x2';
            } else {
                // Use the exact value from config
                maxItems = String(existingItem.config.maxItems);
            }
        }

        // Special handling for dual widget - extract top and bottom widget types
        if (existingItem?.type === ITEM_TYPE.DUAL_WIDGET && existingItem?.config) {
            if (existingItem.config.topWidget?.type) {
                topWidgetType = existingItem.config.topWidget.type;
            }

            if (existingItem.config.bottomWidget?.type) {
                bottomWidgetType = existingItem.config.bottomWidget.type;
            }
        }

        // Reset the form with the existing item data
        formContext.reset({
            shortcutName: existingItem?.label || '',
            pageName: existingItem?.type === ITEM_TYPE.PAGE ? existingItem?.label || '' : '',
            itemType: initialItemType,
            url: existingItem?.url || '',
            showLabel: initialShowLabel,
            icon: existingItem?.icon
                ? {
                    path: existingItem.icon.path,
                    name: existingItem.icon.name,
                    source: existingItem.icon.source || ''
                }
                : null,
            widgetType: initialWidgetType,
            placeholderSize: initialPlaceholderSize,
            torrentClientType: existingItem?.config?.clientType || DOWNLOAD_CLIENT_TYPE.QBITTORRENT,
            temperatureUnit: temperatureUnit,
            timezone: existingItem?.config?.timezone || '',
            adminOnly: existingItem?.adminOnly || false,
            isWol: existingItem?.config?.isWol || false,
            macAddress: existingItem?.config?.macAddress || '',
            broadcastAddress: existingItem?.config?.broadcastAddress || '',
            port: existingItem?.config?.port || '',
            healthUrl: healthUrl,
            healthCheckType: (existingItem?.config?.healthCheckType || 'http') as 'http' | 'ping',
            // Add maxItems for group widget
            maxItems: maxItems,
            // Download client config
            tcHost: existingItem?.config?.host || 'localhost',
            tcPort: existingItem?.config?.port !== undefined ? String(existingItem.config.port) :
                (existingItem?.config?.clientType === DOWNLOAD_CLIENT_TYPE.DELUGE ? '8112'
                    : existingItem?.config?.clientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION ? '9091'
                        : existingItem?.config?.clientType === DOWNLOAD_CLIENT_TYPE.SABNZBD ? '8080'
                            : '8080'),
            tcSsl: existingItem?.config?.ssl || false,
            tcUsername: existingItem?.config?.username || '',
            tcPassword: existingItem?.config?._hasPassword ? '**********' : '',
            piholeHost: piholeHost,
            piholePort: piholePort,
            piholeSsl: piholeSsl,
            piholeApiToken: piholeApiToken,
            piholePassword: piholePassword,
            piholeName: piholeName,
            // AdGuard widget values
            adguardHost: adguardHost,
            adguardPort: adguardPort,
            adguardSsl: adguardSsl,
            adguardUsername: adguardUsername,
            adguardPassword: adguardPassword,
            adguardName: adguardName,
            // Media server widget values
            mediaServerType: existingItem?.config?.clientType || 'jellyfin',
            mediaServerName: existingItem?.config?.displayName || (existingItem ? '' : 'Jellyfin'),
            msHost: existingItem?.config?.host || '',
            msPort: existingItem?.config?.port || '8096',
            msSsl: existingItem?.config?.ssl || false,
            msApiKey: existingItem?.config?._hasApiKey ? '**********' : '',
            // Sonarr widget values
            sonarrName: existingItem?.type === ITEM_TYPE.SONARR_WIDGET ? (existingItem?.config?.displayName || (existingItem ? '' : 'Sonarr')) : 'Sonarr',
            sonarrHost: existingItem?.type === ITEM_TYPE.SONARR_WIDGET ? (existingItem?.config?.host || '') : '',
            sonarrPort: existingItem?.type === ITEM_TYPE.SONARR_WIDGET ? (existingItem?.config?.port || '8989') : '8989',
            sonarrSsl: existingItem?.type === ITEM_TYPE.SONARR_WIDGET ? (existingItem?.config?.ssl || false) : false,
            sonarrApiKey: existingItem?.type === ITEM_TYPE.SONARR_WIDGET ? (existingItem?.config?._hasApiKey ? '**********' : '') : '',

            // Radarr widget values
            radarrName: existingItem?.type === ITEM_TYPE.RADARR_WIDGET ? (existingItem?.config?.displayName || (existingItem ? '' : 'Radarr')) : 'Radarr',
            radarrHost: existingItem?.type === ITEM_TYPE.RADARR_WIDGET ? (existingItem?.config?.host || '') : '',
            radarrPort: existingItem?.type === ITEM_TYPE.RADARR_WIDGET ? (existingItem?.config?.port || '7878') : '7878',
            radarrSsl: existingItem?.type === ITEM_TYPE.RADARR_WIDGET ? (existingItem?.config?.ssl || false) : false,
            radarrApiKey: existingItem?.type === ITEM_TYPE.RADARR_WIDGET ? (existingItem?.config?._hasApiKey ? '**********' : '') : '',

            // Media Request Manager widget values
            mediaRequestManagerService: existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ? (existingItem?.config?.service || 'jellyseerr') : 'jellyseerr',
            mediaRequestManagerName: existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ? (existingItem?.config?.displayName || (existingItem ? '' : 'Jellyseerr')) : 'Jellyseerr',
            mediaRequestManagerHost: existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ? (existingItem?.config?.host || '') : '',
            mediaRequestManagerPort: existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ? (existingItem?.config?.port || '5055') : '5055',
            mediaRequestManagerSsl: existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ? (existingItem?.config?.ssl || false) : false,
            mediaRequestManagerApiKey: existingItem?.type === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ? (existingItem?.config?._hasApiKey ? '**********' : '') : '',

            // Notes widget values
            displayName: existingItem?.type === ITEM_TYPE.NOTES_WIDGET ? (existingItem?.config?.displayName || 'Notes') : 'Notes',
            defaultNoteFontSize: existingItem?.type === ITEM_TYPE.NOTES_WIDGET ? (existingItem?.config?.defaultNoteFontSize || '16px') : '16px',

            location: location,
            gauge1: systemMonitorGauges[0] || 'cpu',
            gauge2: systemMonitorGauges[1] || 'temp',
            gauge3: systemMonitorGauges[2] || 'ram',
            networkInterface: networkInterface,
            showDiskUsage: existingItem?.config?.showDiskUsage !== false, // Default to true
            showSystemInfo: existingItem?.config?.showSystemInfo !== false, // Default to true
            showInternetStatus: existingItem?.config?.showInternetStatus !== false, // Default to true

            // Disk monitor widget values
            selectedDisks: existingItem?.type === ITEM_TYPE.DISK_MONITOR_WIDGET ? (existingItem?.config?.selectedDisks || []) : [],
            showIcons: existingItem?.type === ITEM_TYPE.DISK_MONITOR_WIDGET ? (existingItem?.config?.showIcons !== false) : true,
            layout: existingItem?.type === ITEM_TYPE.DISK_MONITOR_WIDGET ? (existingItem?.config?.layout || '2x2') : '2x2',

            // Dual widget configuration (initialized with extracted types)
            topWidgetType: topWidgetType,
            bottomWidgetType: bottomWidgetType,
            // Dual Widget - position-specific fields will be set below
            top_temperatureUnit: 'fahrenheit',
            top_location: null,
            top_timezone: '',
            top_gauge1: 'cpu',
            top_gauge2: 'temp',
            top_gauge3: 'ram',
            top_networkInterface: '',
            top_showDiskUsage: true,
            top_showSystemInfo: true,
            top_showInternetStatus: true,
            top_selectedDisks: [],
            top_showIcons: true,
            top_layout: '2x2',
            top_piholeHost: '',
            top_piholePort: '',
            top_piholeSsl: false,
            top_piholeApiToken: '',
            top_piholePassword: '',
            top_piholeName: '',
            top_adguardHost: '',
            top_adguardPort: '80',
            top_adguardSsl: false,
            top_adguardUsername: '',
            top_adguardPassword: '',
            top_adguardName: '',
            top_showLabel: true,
            bottom_temperatureUnit: 'fahrenheit',
            bottom_location: null,
            bottom_timezone: '',
            bottom_gauge1: 'cpu',
            bottom_gauge2: 'temp',
            bottom_gauge3: 'ram',
            bottom_networkInterface: '',
            bottom_showDiskUsage: true,
            bottom_showSystemInfo: true,
            bottom_showInternetStatus: true,
            bottom_selectedDisks: [],
            bottom_showIcons: true,
            bottom_layout: '2x2',
            bottom_piholeHost: '',
            bottom_piholePort: '',
            bottom_piholeSsl: false,
            bottom_piholeApiToken: '',
            bottom_piholePassword: '',
            bottom_piholeName: '',
            bottom_adguardHost: '',
            bottom_adguardPort: '80',
            bottom_adguardSsl: false,
            bottom_adguardUsername: '',
            bottom_adguardPassword: '',
            bottom_adguardName: '',
            bottom_showLabel: true,
        });

        // Explicitly handle position-specific field loading for dual widgets
        if (existingItem?.type === ITEM_TYPE.DUAL_WIDGET) {
            // Process top widget configuration
            if (existingItem.config?.topWidget) {
                const topWidget = existingItem.config.topWidget;
                const topConfig = topWidget.config || {};

                // Load top widget type
                setTimeout(() => {
                    // Delayed setting to ensure reset is complete
                    formContext.setValue('topWidgetType', topWidget.type || '');

                    // Handle top weather widget
                    if (topWidget.type === ITEM_TYPE.WEATHER_WIDGET) {
                        formContext.setValue('top_temperatureUnit', topConfig.temperatureUnit || 'fahrenheit');
                        // Ensure location is properly structured
                        if (topConfig.location) {
                            formContext.setValue('top_location', topConfig.location);
                        }
                    }

                    // Handle top system monitor widget
                    else if (topWidget.type === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                        const topGauges = topConfig.gauges || ['cpu', 'temp', 'ram'];
                        formContext.setValue('top_temperatureUnit', topConfig.temperatureUnit || 'fahrenheit');
                        formContext.setValue('top_gauge1', topGauges[0] || 'cpu');
                        formContext.setValue('top_gauge2', topGauges[1] || 'temp');
                        formContext.setValue('top_gauge3', topGauges[2] || 'ram');
                        formContext.setValue('top_networkInterface', topConfig.networkInterface || '');
                        formContext.setValue('top_showDiskUsage', topConfig.showDiskUsage !== false);
                        formContext.setValue('top_showSystemInfo', topConfig.showSystemInfo !== false);
                        formContext.setValue('top_showInternetStatus', topConfig.showInternetStatus !== false);
                    }

                    // Handle top disk monitor widget
                    else if (topWidget.type === ITEM_TYPE.DISK_MONITOR_WIDGET) {
                        formContext.setValue('top_selectedDisks', topConfig.selectedDisks || []);
                        formContext.setValue('top_showIcons', topConfig.showIcons !== false);
                        formContext.setValue('top_layout', '2x2'); // Always force 2x2 for dual widgets
                    }

                    // Handle top pihole widget
                    else if (topWidget.type === ITEM_TYPE.PIHOLE_WIDGET) {
                        formContext.setValue('top_piholeHost', topConfig.host || '');
                        formContext.setValue('top_piholePort', topConfig.port !== undefined ? topConfig.port : '');
                        formContext.setValue('top_piholeSsl', topConfig.ssl !== undefined ? topConfig.ssl : false);
                        // Use masked values for sensitive data
                        formContext.setValue('top_piholeApiToken', topConfig._hasApiToken ? '**********' : '');
                        formContext.setValue('top_piholePassword', topConfig._hasPassword ? '**********' : '');
                        formContext.setValue('top_piholeName', topConfig.displayName || '');
                        formContext.setValue('top_showLabel', topConfig.showLabel !== undefined ? topConfig.showLabel : true);
                    }

                    // Handle top adguard widget
                    else if (topWidget.type === ITEM_TYPE.ADGUARD_WIDGET) {
                        formContext.setValue('top_adguardHost', topConfig.host || '');
                        formContext.setValue('top_adguardPort', topConfig.port !== undefined ? topConfig.port : '80');
                        formContext.setValue('top_adguardSsl', topConfig.ssl !== undefined ? topConfig.ssl : false);
                        // Use masked values for sensitive data
                        formContext.setValue('top_adguardUsername', topConfig._hasUsername ? '**********' : '');
                        formContext.setValue('top_adguardPassword', topConfig._hasPassword ? '**********' : '');
                        formContext.setValue('top_adguardName', topConfig.displayName || '');
                        formContext.setValue('top_showLabel', topConfig.showLabel !== undefined ? topConfig.showLabel : true);
                    }

                    // Handle top datetime widget
                    else if (topWidget.type === ITEM_TYPE.DATE_TIME_WIDGET) {
                        formContext.setValue('top_location', topConfig.location || null);
                        formContext.setValue('top_timezone', topConfig.timezone || '');
                    }
                }, 0);
            }

            // Process bottom widget configuration
            if (existingItem.config?.bottomWidget) {
                const bottomWidget = existingItem.config.bottomWidget;
                const bottomConfig = bottomWidget.config || {};

                // Load bottom widget type
                setTimeout(() => {
                    // Delayed setting to ensure reset is complete
                    formContext.setValue('bottomWidgetType', bottomWidget.type || '');

                    // Handle bottom weather widget
                    if (bottomWidget.type === ITEM_TYPE.WEATHER_WIDGET) {
                        formContext.setValue('bottom_temperatureUnit', bottomConfig.temperatureUnit || 'fahrenheit');
                        // Ensure location is properly structured
                        if (bottomConfig.location) {
                            formContext.setValue('bottom_location', bottomConfig.location);
                        }
                    }

                    // Handle bottom system monitor widget
                    else if (bottomWidget.type === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                        const bottomGauges = bottomConfig.gauges || ['cpu', 'temp', 'ram'];
                        formContext.setValue('bottom_temperatureUnit', bottomConfig.temperatureUnit || 'fahrenheit');
                        formContext.setValue('bottom_gauge1', bottomGauges[0] || 'cpu');
                        formContext.setValue('bottom_gauge2', bottomGauges[1] || 'temp');
                        formContext.setValue('bottom_gauge3', bottomGauges[2] || 'ram');
                        formContext.setValue('bottom_networkInterface', bottomConfig.networkInterface || '');
                        formContext.setValue('bottom_showDiskUsage', bottomConfig.showDiskUsage !== false);
                        formContext.setValue('bottom_showSystemInfo', bottomConfig.showSystemInfo !== false);
                        formContext.setValue('bottom_showInternetStatus', bottomConfig.showInternetStatus !== false);
                    }

                    // Handle bottom disk monitor widget
                    else if (bottomWidget.type === ITEM_TYPE.DISK_MONITOR_WIDGET) {
                        formContext.setValue('bottom_selectedDisks', bottomConfig.selectedDisks || []);
                        formContext.setValue('bottom_showIcons', bottomConfig.showIcons !== false);
                        formContext.setValue('bottom_layout', '2x2'); // Always force 2x2 for dual widgets
                    }

                    // Handle bottom pihole widget
                    else if (bottomWidget.type === ITEM_TYPE.PIHOLE_WIDGET) {
                        formContext.setValue('bottom_piholeHost', bottomConfig.host || '');
                        formContext.setValue('bottom_piholePort', bottomConfig.port !== undefined ? bottomConfig.port : '');
                        formContext.setValue('bottom_piholeSsl', bottomConfig.ssl !== undefined ? bottomConfig.ssl : false);
                        // Use masked values for sensitive data
                        formContext.setValue('bottom_piholeApiToken', bottomConfig._hasApiToken ? '**********' : '');
                        formContext.setValue('bottom_piholePassword', bottomConfig._hasPassword ? '**********' : '');
                        formContext.setValue('bottom_piholeName', bottomConfig.displayName || '');
                        formContext.setValue('bottom_showLabel', bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true);
                    }

                    // Handle bottom adguard widget
                    else if (bottomWidget.type === ITEM_TYPE.ADGUARD_WIDGET) {
                        formContext.setValue('bottom_adguardHost', bottomConfig.host || '');
                        formContext.setValue('bottom_adguardPort', bottomConfig.port !== undefined ? bottomConfig.port : '80');
                        formContext.setValue('bottom_adguardSsl', bottomConfig.ssl !== undefined ? bottomConfig.ssl : false);
                        // Use masked values for sensitive data
                        formContext.setValue('bottom_adguardUsername', bottomConfig._hasUsername ? '**********' : '');
                        formContext.setValue('bottom_adguardPassword', bottomConfig._hasPassword ? '**********' : '');
                        formContext.setValue('bottom_adguardName', bottomConfig.displayName || '');
                        formContext.setValue('bottom_showLabel', bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true);
                    }

                    // Handle bottom datetime widget
                    else if (bottomWidget.type === ITEM_TYPE.DATE_TIME_WIDGET) {
                        formContext.setValue('bottom_location', bottomConfig.location || null);
                        formContext.setValue('bottom_timezone', bottomConfig.timezone || '');
                    }
                }, 0);
            }
        }
    }, [existingItem, formContext, setCustomIconFile]);
};
