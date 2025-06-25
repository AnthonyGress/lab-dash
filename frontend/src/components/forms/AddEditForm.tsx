import { Box, Button, Grid2 as Grid, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { useNavigate } from 'react-router-dom';

import { AppShortcutConfig, PlaceholderConfig, WidgetConfig } from './configs';
import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { DashboardItem, DOWNLOAD_CLIENT_TYPE, ITEM_TYPE, NewItem, Page, TORRENT_CLIENT_TYPE } from '../../types';
import { isEncrypted } from '../../utils/utils';

type Props = {
    handleClose: () => void
    existingItem?: DashboardItem | null;
    onSubmit?: (item: DashboardItem) => void;
}

const ITEM_TYPE_OPTIONS = [
    { id: ITEM_TYPE.APP_SHORTCUT, label: 'Shortcut' },
    { id: 'widget', label: 'Widget' },
    { id: ITEM_TYPE.PLACEHOLDER, label: 'Placeholder' },
    { id: ITEM_TYPE.PAGE, label: 'Page' },
];

const WIDGET_OPTIONS = [
    { id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' },
    { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' },
    { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' },
    { id: ITEM_TYPE.PIHOLE_WIDGET, label: 'Pi-hole' },
    { id: ITEM_TYPE.ADGUARD_WIDGET, label: 'AdGuard Home' },
    { id: ITEM_TYPE.DOWNLOAD_CLIENT, label: 'Download Client' },
    { id: ITEM_TYPE.MEDIA_SERVER_WIDGET, label: 'Media Server' },
    { id: ITEM_TYPE.SONARR_WIDGET, label: 'Sonarr' },
    { id: ITEM_TYPE.RADARR_WIDGET, label: 'Radarr' },
    { id: ITEM_TYPE.DUAL_WIDGET, label: 'Dual Widget' },
    { id: ITEM_TYPE.GROUP_WIDGET, label: 'Group' }
];

export type FormValues = {
    shortcutName?: string;
    pageName?: string;
    itemType: string;
    url?: string;
    healthUrl?: string;
    healthCheckType?: 'http' | 'ping';
    icon?: { path: string; name: string; source?: string } | null;
    showLabel?: boolean;
    widgetType?: string;
    placeholderSize?: string;
    // Weather widget
    temperatureUnit?: string;
    location?: { name: string; latitude: number; longitude: number } | null;
    // System monitor widget
    gauge1?: string;
    gauge2?: string;
    gauge3?: string;
    networkInterface?: string;
    // DateTime widget
    timezone?: string;
    // Pihole widget
    piholeUrl?: string;
    piholeApiKey?: string;
    piholeHost?: string;
    piholePort?: string;
    piholeSsl?: boolean;
    piholeApiToken?: string;
    piholePassword?: string;
    piholeName?: string;
    // AdGuard widget
    adguardHost?: string;
    adguardPort?: string;
    adguardSsl?: boolean;
    adguardUsername?: string;
    adguardPassword?: string;
    adguardName?: string;
    // Media server widget
    mediaServerType?: string;
    mediaServerName?: string;
    msHost?: string;
    msPort?: string;
    msSsl?: boolean;
    msApiKey?: string;
    // Sonarr widget
    sonarrName?: string;
    sonarrHost?: string;
    sonarrPort?: string;
    sonarrSsl?: boolean;
    sonarrApiKey?: string;

    // Radarr widget
    radarrName?: string;
    radarrHost?: string;
    radarrPort?: string;
    radarrSsl?: boolean;
    radarrApiKey?: string;

    // Torrent client widget
    torrentClient?: string;
    torrentUrl?: string;
    torrentUsername?: string;
    torrentPassword?: string;
    torrentClientType?: string;
    tcHost?: string;
    tcPort?: string;
    tcSsl?: boolean;
    tcUsername?: string;
    tcPassword?: string;

    // Dual Widget
    topWidgetType?: string;
    bottomWidgetType?: string;
    // Dual Widget - position-specific fields for top widget
    top_temperatureUnit?: string;
    top_location?: { name: string; latitude: number; longitude: number } | null;
    top_timezone?: string;
    top_gauge1?: string;
    top_gauge2?: string;
    top_gauge3?: string;
    top_networkInterface?: string;
    top_piholeHost?: string;
    top_piholePort?: string;
    top_piholeSsl?: boolean;
    top_piholeApiToken?: string;
    top_piholePassword?: string;
    top_piholeName?: string;
    top_adguardHost?: string;
    top_adguardPort?: string;
    top_adguardSsl?: boolean;
    top_adguardUsername?: string;
    top_adguardPassword?: string;
    top_adguardName?: string;
    top_showLabel?: boolean;
    // Dual Widget - position-specific fields for bottom widget
    bottom_temperatureUnit?: string;
    bottom_location?: { name: string; latitude: number; longitude: number } | null;
    bottom_timezone?: string;
    bottom_gauge1?: string;
    bottom_gauge2?: string;
    bottom_gauge3?: string;
    bottom_networkInterface?: string;
    bottom_piholeHost?: string;
    bottom_piholePort?: string;
    bottom_piholeSsl?: boolean;
    bottom_piholeApiToken?: string;
    bottom_piholePassword?: string;
    bottom_piholeName?: string;
    bottom_adguardHost?: string;
    bottom_adguardPort?: string;
    bottom_adguardSsl?: boolean;
    bottom_adguardUsername?: string;
    bottom_adguardPassword?: string;
    bottom_adguardName?: string;
    bottom_showLabel?: boolean;
    // Other fields
    adminOnly?: boolean;
    isWol?: boolean;
    macAddress?: string;
    broadcastAddress?: string;
    port?: string;
    maxItems?: string;
};

interface LocationOption {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

export const AddEditForm = ({ handleClose, existingItem, onSubmit }: Props) => {
    const { formState: { errors } } = useForm();
    const { dashboardLayout, addItem, updateItem, addPage, refreshDashboard, pageNameToSlug, pages } = useAppContext();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const [customIconFile, setCustomIconFile] = useState<File | null>(null);

    // Removed location-related state, now handled in WeatherWidgetConfig

    // Removed torrent client type state, now handled in DownloadClientWidgetConfig

    // Removed app shortcut config, now handled in AppShortcutConfig

    const formContext = useForm<FormValues>();

    // Reset and initialize form when existingItem changes or when component mounts
    useEffect(() => {
        // Determine initial values based on existingItem
        const initialItemType = existingItem?.type === ITEM_TYPE.WEATHER_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DATE_TIME_WIDGET ||
                               existingItem?.type === ITEM_TYPE.SYSTEM_MONITOR_WIDGET ||
                               existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET ||
                               existingItem?.type === ITEM_TYPE.ADGUARD_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT ||
                               existingItem?.type === ITEM_TYPE.TORRENT_CLIENT || // Legacy support
                               existingItem?.type === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
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
                                  existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.ADGUARD_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT ||
                                  existingItem?.type === ITEM_TYPE.TORRENT_CLIENT || // Legacy support - map to DOWNLOAD_CLIENT
                                  existingItem?.type === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
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
                                  existingItem?.type === ITEM_TYPE.SONARR_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.RADARR_WIDGET)
            ? (existingItem?.showLabel !== undefined ? existingItem.showLabel : true)
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

            location: location,
            gauge1: systemMonitorGauges[0] || 'cpu',
            gauge2: systemMonitorGauges[1] || 'temp',
            gauge3: systemMonitorGauges[2] || 'ram',
            networkInterface: networkInterface,
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
            top_piholeHost: '',
            top_piholePort: '',
            top_piholeSsl: false,
            top_piholeApiToken: '',
            top_piholePassword: '',
            top_piholeName: '',
            top_showLabel: true,
            bottom_temperatureUnit: 'fahrenheit',
            bottom_location: null,
            bottom_timezone: '',
            bottom_gauge1: 'cpu',
            bottom_gauge2: 'temp',
            bottom_gauge3: 'ram',
            bottom_networkInterface: '',
            bottom_piholeHost: '',
            bottom_piholePort: '',
            bottom_piholeSsl: false,
            bottom_piholeApiToken: '',
            bottom_piholePassword: '',
            bottom_piholeName: '',
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
    }, [existingItem, formContext]);

    const selectedItemType = formContext.watch('itemType');
    const selectedWidgetType = formContext.watch('widgetType');

    // Set default showLabel based on widget type
    useEffect(() => {
        if (selectedItemType === 'widget') {
            // Only set the default if there's no existing value (to avoid overriding user choice)
            if (formContext.getValues('showLabel') === undefined || (!existingItem && (
                selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET ||
                selectedWidgetType === ITEM_TYPE.ADGUARD_WIDGET ||
                selectedWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                selectedWidgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                selectedWidgetType === ITEM_TYPE.SONARR_WIDGET ||
                selectedWidgetType === ITEM_TYPE.RADARR_WIDGET ||
                selectedWidgetType === ITEM_TYPE.DUAL_WIDGET
            ))) {
                if (selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.ADGUARD_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                    selectedWidgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.SONARR_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.RADARR_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.DUAL_WIDGET) {
                    formContext.setValue('showLabel', true);
                } else {
                    formContext.setValue('showLabel', false);
                }
            }
        }
    }, [selectedItemType, selectedWidgetType, formContext, existingItem]);

    // Automatically set shortcutName to "Group" for new group widgets
    useEffect(() => {
        if (!existingItem && selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.GROUP_WIDGET) {
            formContext.setValue('shortcutName', 'Group');
        }
    }, [selectedItemType, selectedWidgetType, existingItem, formContext]);

    // Removed location search and update useEffects, now handled in WeatherWidgetConfig

    const handleCustomIconSelect = (file: File | null) => {
        setCustomIconFile(file);
    };

    const handleSubmit = async (data: FormValues) => {
        // Handle page creation/editing
        if (data.itemType === ITEM_TYPE.PAGE) {
            if (data.pageName) {
                try {
                    if (existingItem && onSubmit) {
                        // This is editing an existing page
                        const updatedPageItem = {
                            ...existingItem,
                            label: data.pageName,
                            adminOnly: data.adminOnly
                        };
                        onSubmit(updatedPageItem as DashboardItem);
                        handleFormClose();
                    } else {
                        // This is creating a new page
                        const newPageId = await addPage(data.pageName, data.adminOnly);
                        handleFormClose();

                        if (newPageId) {
                            // Wait a brief moment for state to update, then navigate to the newly created page
                            setTimeout(() => {
                                const pageSlug = pageNameToSlug(data.pageName!);
                                navigate(`/${pageSlug}`);
                            }, 100);
                        }
                    }
                } catch (error) {
                    console.error('Error with page operation:', error);
                    // Set form error for the pageName field
                    formContext.setError('pageName', {
                        type: 'manual',
                        message: error instanceof Error ? error.message : 'Failed to save page'
                    });
                }
            }
            return;
        }

        let iconData = data.icon;

        if (customIconFile && data.icon?.source === 'custom-pending') {
            try {
                const uploadedIcon = await DashApi.uploadAppIcon(customIconFile);

                if (uploadedIcon) {
                    iconData = uploadedIcon;
                } else {
                    console.error('Failed to get a valid response from upload');
                }
            } catch (error) {
                console.error('Error uploading custom icon:', error);
            }
        }

        let config: any = undefined;
        if (data.itemType === 'widget') {
            if (data.widgetType === ITEM_TYPE.WEATHER_WIDGET) {
                config = {
                    temperatureUnit: data.temperatureUnit || 'fahrenheit',
                    location: data.location || undefined
                };
            } else if (data.widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
                config = {
                    location: data.location || undefined,
                    timezone: data.timezone || null
                };
            } else if (data.widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                config = {
                    temperatureUnit: data.temperatureUnit || 'fahrenheit',
                    gauges: [data.gauge1, data.gauge2, data.gauge3]
                };

                // Add network interface to config if a network gauge is included
                if ([data.gauge1, data.gauge2, data.gauge3].includes('network') && data.networkInterface) {
                    (config as any).networkInterface = data.networkInterface;
                }
            } else if (data.widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
                // Handle masked values - only encrypt if not masked
                let encryptedToken = '';
                let encryptedPassword = '';
                let hasExistingApiToken = false;
                let hasExistingPassword = false;

                // Check if we're editing an existing item with sensitive data
                if (existingItem?.config) {
                    hasExistingApiToken = !!existingItem.config._hasApiToken;
                    hasExistingPassword = !!existingItem.config._hasPassword;
                }

                // Only process API token if it's not the masked value
                if (data.piholeApiToken && data.piholeApiToken !== '**********') {
                    if (!isEncrypted(data.piholeApiToken)) {
                        try {
                            encryptedToken = await DashApi.encryptPiholeToken(data.piholeApiToken);
                        } catch (error) {
                            console.error('Error encrypting Pi-hole API token:', error);
                        }
                    } else {
                        encryptedToken = data.piholeApiToken;
                    }
                }

                // Only process password if it's not the masked value
                if (data.piholePassword && data.piholePassword !== '**********') {
                    if (!isEncrypted(data.piholePassword)) {
                        try {
                            encryptedPassword = await DashApi.encryptPiholePassword(data.piholePassword);
                        } catch (error) {
                            console.error('Error encrypting Pi-hole password:', error);
                        }
                    } else {
                        encryptedPassword = data.piholePassword;
                    }
                }

                const baseConfig = {
                    host: data.piholeHost,
                    port: data.piholePort,
                    ssl: data.piholeSsl,
                    showLabel: data.showLabel,
                    displayName: data.piholeName || 'Pi-hole'
                };

                // Include sensitive fields if they were actually changed (not masked)
                if (encryptedToken) {
                    config = { ...baseConfig, apiToken: encryptedToken };
                } else if (hasExistingApiToken) {
                    // If we have an existing API token but no new token provided, set the flag
                    config = { ...baseConfig, _hasApiToken: true };
                } else {
                    config = baseConfig;
                }

                // Include password if it was actually changed (not masked)
                if (encryptedPassword) {
                    config = { ...config, password: encryptedPassword };
                } else if (hasExistingPassword) {
                    // If we have an existing password but no new password provided, set the flag
                    config = { ...config, _hasPassword: true };
                }
            } else if (data.widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
                // Handle masked values - only encrypt if not masked
                let encryptedUsername = '';
                let encryptedPassword = '';
                let hasExistingUsername = false;
                let hasExistingPassword = false;

                // Check if we're editing an existing item with sensitive data
                if (existingItem?.config) {
                    hasExistingUsername = !!existingItem.config._hasUsername;
                    hasExistingPassword = !!existingItem.config._hasPassword;
                }

                // Only process username if it's not the masked value
                if (data.adguardUsername && data.adguardUsername !== '**********') {
                    if (!isEncrypted(data.adguardUsername)) {
                        try {
                            encryptedUsername = await DashApi.encryptAdGuardUsername(data.adguardUsername);
                        } catch (error) {
                            console.error('Error encrypting AdGuard username:', error);
                        }
                    } else {
                        encryptedUsername = data.adguardUsername;
                    }
                }

                // Only process password if it's not the masked value
                if (data.adguardPassword && data.adguardPassword !== '**********') {
                    if (!isEncrypted(data.adguardPassword)) {
                        try {
                            encryptedPassword = await DashApi.encryptAdGuardPassword(data.adguardPassword);
                        } catch (error) {
                            console.error('Error encrypting AdGuard password:', error);
                        }
                    } else {
                        encryptedPassword = data.adguardPassword;
                    }
                }

                const baseConfig = {
                    host: data.adguardHost,
                    port: data.adguardPort,
                    ssl: data.adguardSsl,
                    showLabel: data.showLabel,
                    displayName: data.adguardName || 'AdGuard Home'
                };

                // Include sensitive fields if they were actually changed (not masked)
                if (encryptedUsername && encryptedPassword) {
                    config = {
                        ...baseConfig,
                        username: encryptedUsername,
                        password: encryptedPassword
                    };
                } else {
                    config = baseConfig;
                    // If we have existing credentials but no new ones provided, set the flags
                    if (hasExistingUsername) {
                        config = { ...config, _hasUsername: true };
                    }
                    if (hasExistingPassword) {
                        config = { ...config, _hasPassword: true };
                    }
                }
            } else if (data.widgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                // Download client widget - use tc* fields for all client types
                let encryptedPassword = '';
                let hasExistingPassword = false;

                // Check if we're editing an existing item with a password
                if ((existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT || existingItem?.type === ITEM_TYPE.TORRENT_CLIENT) && existingItem?.id) {
                    hasExistingPassword = true;
                }

                // Only process password if it's not the masked value
                if (data.tcPassword && data.tcPassword !== '**********') {
                    if (!isEncrypted(data.tcPassword)) {
                        try {
                            if (data.torrentClientType === DOWNLOAD_CLIENT_TYPE.SABNZBD) {
                                encryptedPassword = await DashApi.encryptSabnzbdPassword(data.tcPassword);
                            } else {
                                encryptedPassword = await DashApi.encryptPassword(data.tcPassword);
                            }
                        } catch (error) {
                            console.error('Error encrypting download client password:', error);
                        }
                    } else {
                        encryptedPassword = data.tcPassword;
                    }
                }

                const baseConfig: any = {
                    clientType: data.torrentClientType,
                    host: data.tcHost,
                    port: data.tcPort,
                    ssl: data.tcSsl,
                    showLabel: data.showLabel
                };

                // Include username for clients that need it (not SABnzbd)
                if (data.torrentClientType !== DOWNLOAD_CLIENT_TYPE.SABNZBD && data.tcUsername) {
                    baseConfig.username = data.tcUsername;
                }

                // Include password if it was actually changed (not masked)
                if (encryptedPassword) {
                    baseConfig.password = encryptedPassword;
                } else if (hasExistingPassword) {
                    // If we have an existing password but no new password provided, set the flag
                    baseConfig._hasPassword = true;
                }

                config = baseConfig;
            } else if (data.widgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET) {
                // Media server widget - use ms* fields for all server types
                config = {
                    clientType: data.mediaServerType || 'jellyfin',
                    displayName: data.mediaServerName || '',
                    host: data.msHost || '',
                    port: data.msPort || '8096',
                    ssl: data.msSsl || false,
                    showLabel: data.showLabel !== undefined ? data.showLabel : true
                };

                // Handle API key - if masked, set flag for backend to preserve existing key
                if (data.msApiKey === '**********') {
                    // API key is masked - tell backend to preserve existing key
                    config._hasApiKey = true;
                } else if (data.msApiKey && data.msApiKey.trim() !== '') {
                    // API key was changed - encrypt and include it
                    if (!isEncrypted(data.msApiKey)) {
                        try {
                            const encryptedApiKey = await DashApi.encryptPassword(data.msApiKey);
                            config.apiKey = encryptedApiKey;
                        } catch (error) {
                            console.error('Error encrypting media server API key:', error);
                        }
                    } else {
                        config.apiKey = data.msApiKey;
                    }
                }
            } else if (data.widgetType === ITEM_TYPE.SONARR_WIDGET) {
                // Sonarr widget configuration
                config = await createWidgetConfig(ITEM_TYPE.SONARR_WIDGET, data);
            } else if (data.widgetType === ITEM_TYPE.RADARR_WIDGET) {
                // Radarr widget configuration
                config = await createWidgetConfig(ITEM_TYPE.RADARR_WIDGET, data);
            } else if (data.widgetType === ITEM_TYPE.DUAL_WIDGET) {
                // Check if DualWidgetConfig component has already built the config
                const existingConfig = (formContext as any).getValues('config');

                if (existingConfig && existingConfig.topWidget && existingConfig.bottomWidget) {
                    // Use the config built by DualWidgetConfig component (preserves sensitive data flags)
                    config = existingConfig;
                } else {
                    // Fallback to building config from form data (for backwards compatibility)

                    // Ensure neither widget type is DOWNLOAD_CLIENT
                    if (data.topWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                        data.bottomWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                        console.error('DOWNLOAD_CLIENT widget is not supported in Dual Widget');
                        // Replace DOWNLOAD_CLIENT with DATE_TIME_WIDGET as a fallback
                        if (data.topWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                            data.topWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                        }
                        if (data.bottomWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                            data.bottomWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                        }
                    }

                    // Create custom data objects for top and bottom widgets with proper field mapping
                    const topWidgetData = {
                        ...data,
                        // Map position-specific fields to standard fields for the createWidgetConfig function
                        temperatureUnit: data.top_temperatureUnit,
                        location: data.top_location,
                        timezone: data.top_timezone,
                        gauge1: data.top_gauge1,
                        gauge2: data.top_gauge2,
                        gauge3: data.top_gauge3,
                        networkInterface: data.top_networkInterface,
                        piholeHost: data.top_piholeHost,
                        piholePort: data.top_piholePort,
                        piholeSsl: data.top_piholeSsl,
                        piholeApiToken: data.top_piholeApiToken,
                        piholePassword: data.top_piholePassword,
                        piholeName: data.top_piholeName,
                        adguardHost: data.top_adguardHost,
                        adguardPort: data.top_adguardPort,
                        adguardSsl: data.top_adguardSsl,
                        adguardUsername: data.top_adguardUsername,
                        adguardPassword: data.top_adguardPassword,
                        adguardName: data.top_adguardName,
                        showLabel: data.top_showLabel
                    };

                    const bottomWidgetData = {
                        ...data,
                        // Map position-specific fields to standard fields for the createWidgetConfig function
                        temperatureUnit: data.bottom_temperatureUnit,
                        location: data.bottom_location,
                        timezone: data.bottom_timezone,
                        gauge1: data.bottom_gauge1,
                        gauge2: data.bottom_gauge2,
                        gauge3: data.bottom_gauge3,
                        networkInterface: data.bottom_networkInterface,
                        piholeHost: data.bottom_piholeHost,
                        piholePort: data.bottom_piholePort,
                        piholeSsl: data.bottom_piholeSsl,
                        piholeApiToken: data.bottom_piholeApiToken,
                        piholePassword: data.bottom_piholePassword,
                        piholeName: data.bottom_piholeName,
                        adguardHost: data.bottom_adguardHost,
                        adguardPort: data.bottom_adguardPort,
                        adguardSsl: data.bottom_adguardSsl,
                        adguardUsername: data.bottom_adguardUsername,
                        adguardPassword: data.bottom_adguardPassword,
                        adguardName: data.bottom_adguardName,
                        showLabel: data.bottom_showLabel
                    };

                    const topConfig: any = await createWidgetConfig(data.topWidgetType || '', topWidgetData);
                    const bottomConfig: any = await createWidgetConfig(data.bottomWidgetType || '', bottomWidgetData);

                    config = {
                        topWidget: {
                            type: data.topWidgetType,
                            config: topConfig
                        },
                        bottomWidget: {
                            type: data.bottomWidgetType,
                            config: bottomConfig
                        }
                    };
                }
            }
        } else if (data.itemType === ITEM_TYPE.APP_SHORTCUT) {
            config = {};

            // Add Wake-on-LAN config if enabled
            if (data.isWol) {
                config = {
                    ...config,
                    isWol: true,
                    macAddress: data.macAddress,
                    broadcastAddress: data.broadcastAddress,
                    port: data.port
                };
            }

            // Add health URL if provided
            if (data.healthUrl) {
                config = {
                    ...config,
                    healthUrl: data.healthUrl,
                    healthCheckType: data.healthCheckType || 'http'
                };
            }

            // If no config options were added, set config to undefined
            if (Object.keys(config).length === 0) {
                config = undefined;
            }
        }

        const url = (data.itemType === ITEM_TYPE.APP_SHORTCUT && data.isWol)
            ? (data.url || '#')
            : data.url; // Allow URL to be undefined when health URL is provided but no URL is set

        // Determine the actual item type based on form data
        let actualItemType = data.itemType;
        if (data.itemType === 'widget' && data.widgetType) {
            actualItemType = data.widgetType;
        } else if (data.itemType === ITEM_TYPE.PLACEHOLDER && data.placeholderSize) {
            // Map placeholder size to legacy types for backward compatibility
            switch (data.placeholderSize) {
            case 'app':
                actualItemType = ITEM_TYPE.BLANK_APP;
                break;
            case 'widget':
                actualItemType = ITEM_TYPE.BLANK_WIDGET;
                break;
            case 'row':
                actualItemType = ITEM_TYPE.BLANK_ROW;
                break;
            default:
                actualItemType = ITEM_TYPE.BLANK_APP;
            }
        }

        // Generate label for DOWNLOAD_CLIENT widgets if not provided
        let itemLabel = data.shortcutName || '';
        if (actualItemType === ITEM_TYPE.DOWNLOAD_CLIENT && !itemLabel) {
            const clientType = data.torrentClientType || DOWNLOAD_CLIENT_TYPE.QBITTORRENT;
            const clientName = clientType === DOWNLOAD_CLIENT_TYPE.DELUGE ? 'Deluge'
                : clientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION ? 'Transmission'
                    : clientType === DOWNLOAD_CLIENT_TYPE.SABNZBD ? 'SABnzbd'
                        : 'qBittorrent';
            itemLabel = `${clientName} Client`;
        }

        const updatedItem: NewItem = {
            label: itemLabel,
            icon: iconData ? {
                path: iconData.path,
                name: iconData.name,
                source: iconData.source
            } : undefined,
            url,
            type: actualItemType,
            showLabel: data.showLabel,
            config: config,
            adminOnly: data.adminOnly
        };

        try {
            if (existingItem) {
                // If onSubmit prop is provided, we're editing within a group context
                // This is more reliable than trying to detect group items by their absence from dashboardLayout
                if (onSubmit) {
                    // This is an item being edited within a group widget
                    const updated = {
                        ...existingItem,
                        ...updatedItem
                    };
                    onSubmit(updated as DashboardItem);

                    // Don't call refreshDashboard() for group items as it can cause duplication
                    // The group widget's updateGroupItem function handles the state updates properly
                } else {
                    // This is a regular dashboard item
                    await updateItem(existingItem.id, updatedItem);

                    // Refresh the dashboard to ensure all widgets are updated with latest data
                    await refreshDashboard();
                }
            } else {
                await addItem(updatedItem);

                // Refresh the dashboard to ensure all widgets are updated with latest data
                await refreshDashboard();
            }

            formContext.reset();
            handleFormClose();
        } catch (error) {
            console.error('Error submitting form:', error);
            // Still close the form even if there's an error
            formContext.reset();
            handleFormClose();
        }
    };

    // Helper function to create widget configuration based on widget type
    const createWidgetConfig = async (widgetType: string, data: FormValues): Promise<any> => {
        if (widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            // Get the location data and ensure it's properly structured
            const location = data.location || null;

            // Ensure location has the correct structure with all properties
            let processedLocation = null;
            if (location) {
                processedLocation = {
                    name: location.name || '',
                    latitude: typeof location.latitude === 'number' ? location.latitude : parseFloat(location.latitude as any) || 0,
                    longitude: typeof location.longitude === 'number' ? location.longitude : parseFloat(location.longitude as any) || 0
                };
            }

            return {
                temperatureUnit: data.temperatureUnit || 'fahrenheit',
                location: processedLocation
            };
        } else if (widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
            // Get the location data and ensure it's properly structured
            const location = data.location || null;

            // Ensure location has the correct structure with all properties
            let processedLocation = null;
            if (location) {
                processedLocation = {
                    name: location.name || '',
                    latitude: typeof location.latitude === 'number' ? location.latitude : parseFloat(location.latitude as any) || 0,
                    longitude: typeof location.longitude === 'number' ? location.longitude : parseFloat(location.longitude as any) || 0
                };
            }

            // Ensure timezone is always a string, never null
            const timezone = data.timezone || '';

            return {
                location: processedLocation,
                timezone: timezone // This is guaranteed to be a string
            };
        } else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            const config = {
                temperatureUnit: data.temperatureUnit || 'fahrenheit',
                gauges: [data.gauge1, data.gauge2, data.gauge3]
            };

            // Add network interface to config if a network gauge is included
            if ([data.gauge1, data.gauge2, data.gauge3].includes('network') && data.networkInterface) {
                (config as any).networkInterface = data.networkInterface;
            }

            return config;
        } else if (widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
            // Handle masked values - only encrypt if not masked
            let encryptedToken = '';
            let encryptedPassword = '';
            let hasExistingApiToken = false;
            let hasExistingPassword = false;

            // Check if we're editing an existing item with sensitive data
            if (existingItem?.config) {
                hasExistingApiToken = !!existingItem.config._hasApiToken;
                hasExistingPassword = !!existingItem.config._hasPassword;
            }

            // Only process API token if it's not the masked value
            if (data.piholeApiToken && data.piholeApiToken !== '**********') {
                if (!isEncrypted(data.piholeApiToken)) {
                    try {
                        encryptedToken = await DashApi.encryptPiholeToken(data.piholeApiToken);
                    } catch (error) {
                        console.error('Error encrypting Pi-hole API token:', error);
                    }
                } else {
                    encryptedToken = data.piholeApiToken;
                }
            }

            // Only process password if it's not the masked value
            if (data.piholePassword && data.piholePassword !== '**********') {
                if (!isEncrypted(data.piholePassword)) {
                    try {
                        encryptedPassword = await DashApi.encryptPiholePassword(data.piholePassword);
                    } catch (error) {
                        console.error('Error encrypting Pi-hole password:', error);
                    }
                } else {
                    encryptedPassword = data.piholePassword;
                }
            }

            const baseConfig = {
                host: data.piholeHost,
                port: data.piholePort,
                ssl: data.piholeSsl,
                showLabel: data.showLabel,
                displayName: data.piholeName || 'Pi-hole'
            };

            // Include sensitive fields if they were actually changed (not masked)
            if (encryptedToken) {
                return { ...baseConfig, apiToken: encryptedToken };
            } else if (encryptedPassword) {
                return { ...baseConfig, password: encryptedPassword };
            } else {
                // If no new sensitive data provided, include security flags for existing data
                const config: any = { ...baseConfig };
                if (hasExistingApiToken) {
                    config._hasApiToken = true;
                }
                if (hasExistingPassword) {
                    config._hasPassword = true;
                }
                return config;
            }
        } else if (widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
            // Handle masked values - only encrypt if not masked
            let encryptedUsername = '';
            let encryptedPassword = '';
            let hasExistingUsername = false;
            let hasExistingPassword = false;

            // Check if we're editing an existing item with sensitive data
            if (existingItem?.config) {
                hasExistingUsername = !!existingItem.config._hasUsername;
                hasExistingPassword = !!existingItem.config._hasPassword;
            }

            // Only process username if it's not the masked value
            if (data.adguardUsername && data.adguardUsername !== '**********') {
                if (!isEncrypted(data.adguardUsername)) {
                    try {
                        encryptedUsername = await DashApi.encryptAdGuardUsername(data.adguardUsername);
                    } catch (error) {
                        console.error('Error encrypting AdGuard username:', error);
                    }
                } else {
                    encryptedUsername = data.adguardUsername;
                }
            }

            // Only process password if it's not the masked value
            if (data.adguardPassword && data.adguardPassword !== '**********') {
                if (!isEncrypted(data.adguardPassword)) {
                    try {
                        encryptedPassword = await DashApi.encryptAdGuardPassword(data.adguardPassword);
                    } catch (error) {
                        console.error('Error encrypting AdGuard password:', error);
                    }
                } else {
                    encryptedPassword = data.adguardPassword;
                }
            }

            const baseConfig = {
                host: data.adguardHost,
                port: data.adguardPort,
                ssl: data.adguardSsl,
                showLabel: data.showLabel,
                displayName: data.adguardName || 'AdGuard Home'
            };

            // Include sensitive fields if they were actually changed (not masked)
            if (encryptedUsername && encryptedPassword) {
                return {
                    ...baseConfig,
                    username: encryptedUsername,
                    password: encryptedPassword
                };
            } else {
                const config: any = { ...baseConfig };
                // If we have existing credentials but no new ones provided, set the flags
                if (hasExistingUsername) {
                    config._hasUsername = true;
                }
                if (hasExistingPassword) {
                    config._hasPassword = true;
                }
                return config;
            }
        } else if (widgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
            // Download client widget - use tc* fields for all client types
            let encryptedPassword = '';
            let hasExistingPassword = false;

            // Check if we're editing an existing item with a password
            if (existingItem?.config) {
                hasExistingPassword = !!existingItem.config._hasPassword;
            }

            // Only process password if it's not the masked value
            if (data.tcPassword && data.tcPassword !== '**********') {
                if (!isEncrypted(data.tcPassword)) {
                    try {
                        if (data.torrentClientType === DOWNLOAD_CLIENT_TYPE.SABNZBD) {
                            encryptedPassword = await DashApi.encryptSabnzbdPassword(data.tcPassword);
                        } else {
                            encryptedPassword = await DashApi.encryptPassword(data.tcPassword);
                        }
                    } catch (error) {
                        console.error('Error encrypting download client password:', error);
                    }
                } else {
                    encryptedPassword = data.tcPassword;
                }
            }

            const config: any = {
                clientType: data.torrentClientType,
                host: data.tcHost,
                port: data.tcPort,
                ssl: data.tcSsl,
                showLabel: data.showLabel
            };

            // Include username for clients that need it (not SABnzbd)
            if (data.torrentClientType !== DOWNLOAD_CLIENT_TYPE.SABNZBD && data.tcUsername) {
                config.username = data.tcUsername;
            }

            // Include password if it was actually changed (not masked)
            if (encryptedPassword) {
                config.password = encryptedPassword;
            } else if (hasExistingPassword) {
                // If we have an existing password but no new password provided, set the flag
                config._hasPassword = true;
            }

            return config;
        } else if (widgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET) {
            // Media server widget - use ms* fields for all server types
            const config: any = {
                clientType: data.mediaServerType || 'jellyfin',
                displayName: data.mediaServerName || '',
                host: data.msHost || '',
                port: data.msPort || '8096',
                ssl: data.msSsl || false,
                showLabel: data.showLabel !== undefined ? data.showLabel : true
            };

            // Handle API key - if masked, set flag for backend to preserve existing key
            if (data.msApiKey === '**********') {
                // API key is masked - tell backend to preserve existing key
                config._hasApiKey = true;
            } else if (data.msApiKey && data.msApiKey.trim() !== '') {
                // API key was changed - encrypt and include it
                if (!isEncrypted(data.msApiKey)) {
                    try {
                        const encryptedApiKey = await DashApi.encryptPassword(data.msApiKey);
                        config.apiKey = encryptedApiKey;
                    } catch (error) {
                        console.error('Error encrypting media server API key:', error);
                    }
                } else {
                    config.apiKey = data.msApiKey;
                }
            }

            return config;
        } else if (widgetType === ITEM_TYPE.SONARR_WIDGET) {
            // Sonarr widget configuration
            const config: any = {
                displayName: data.sonarrName || 'Sonarr',
                host: data.sonarrHost || '',
                port: data.sonarrPort || '8989',
                ssl: data.sonarrSsl || false,
                showLabel: data.showLabel !== undefined ? data.showLabel : true,

            };

            // Handle API key - if masked, set flag for backend to preserve existing key
            if (data.sonarrApiKey === '**********') {
                // API key is masked - tell backend to preserve existing key
                config._hasApiKey = true;
            } else if (data.sonarrApiKey && data.sonarrApiKey.trim() !== '') {
                // API key was changed - encrypt and include it
                if (!isEncrypted(data.sonarrApiKey)) {
                    try {
                        const encryptedApiKey = await DashApi.encryptPassword(data.sonarrApiKey);
                        config.apiKey = encryptedApiKey;
                    } catch (error) {
                        console.error('Error encrypting Sonarr API key:', error);
                    }
                } else {
                    config.apiKey = data.sonarrApiKey;
                }
            }

            return config;
        } else if (widgetType === ITEM_TYPE.RADARR_WIDGET) {
            // Radarr widget configuration
            const config: any = {
                displayName: data.radarrName || 'Radarr',
                host: data.radarrHost || '',
                port: data.radarrPort || '7878',
                ssl: data.radarrSsl || false,
                showLabel: data.showLabel !== undefined ? data.showLabel : true,

            };

            // Handle API key - if masked, set flag for backend to preserve existing key
            if (data.radarrApiKey === '**********') {
                // API key is masked - tell backend to preserve existing key
                config._hasApiKey = true;
            } else if (data.radarrApiKey && data.radarrApiKey.trim() !== '') {
                // API key was changed - encrypt and include it
                if (!isEncrypted(data.radarrApiKey)) {
                    try {
                        const encryptedApiKey = await DashApi.encryptPassword(data.radarrApiKey);
                        config.apiKey = encryptedApiKey;
                    } catch (error) {
                        console.error('Error encrypting Radarr API key:', error);
                    }
                } else {
                    config.apiKey = data.radarrApiKey;
                }
            }

            return config;
        } else if (widgetType === ITEM_TYPE.DUAL_WIDGET) {
            // Check if DualWidgetConfig component has already built the config
            const existingConfig = (formContext as any).getValues('config');

            if (existingConfig && existingConfig.topWidget && existingConfig.bottomWidget) {
                // Use the config built by DualWidgetConfig component (preserves sensitive data flags)
                return existingConfig;
            } else {
                // Fallback to building config from form data (for backwards compatibility)

                // Ensure neither widget type is DOWNLOAD_CLIENT
                if (data.topWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                    data.bottomWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                    console.error('DOWNLOAD_CLIENT widget is not supported in Dual Widget');
                    // Replace DOWNLOAD_CLIENT with DATE_TIME_WIDGET as a fallback
                    if (data.topWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                        data.topWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                    }
                    if (data.bottomWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                        data.bottomWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                    }
                }

                // Create custom data objects for top and bottom widgets with proper field mapping
                const topWidgetData = {
                    ...data,
                    // Map position-specific fields to standard fields for the createWidgetConfig function
                    temperatureUnit: data.top_temperatureUnit,
                    location: data.top_location,
                    timezone: data.top_timezone,
                    gauge1: data.top_gauge1,
                    gauge2: data.top_gauge2,
                    gauge3: data.top_gauge3,
                    networkInterface: data.top_networkInterface,
                    piholeHost: data.top_piholeHost,
                    piholePort: data.top_piholePort,
                    piholeSsl: data.top_piholeSsl,
                    piholeApiToken: data.top_piholeApiToken,
                    piholePassword: data.top_piholePassword,
                    piholeName: data.top_piholeName,
                    adguardHost: data.top_adguardHost,
                    adguardPort: data.top_adguardPort,
                    adguardSsl: data.top_adguardSsl,
                    adguardUsername: data.top_adguardUsername,
                    adguardPassword: data.top_adguardPassword,
                    adguardName: data.top_adguardName,
                    showLabel: data.top_showLabel
                };

                const bottomWidgetData = {
                    ...data,
                    // Map position-specific fields to standard fields for the createWidgetConfig function
                    temperatureUnit: data.bottom_temperatureUnit,
                    location: data.bottom_location,
                    timezone: data.bottom_timezone,
                    gauge1: data.bottom_gauge1,
                    gauge2: data.bottom_gauge2,
                    gauge3: data.bottom_gauge3,
                    networkInterface: data.bottom_networkInterface,
                    piholeHost: data.bottom_piholeHost,
                    piholePort: data.bottom_piholePort,
                    piholeSsl: data.bottom_piholeSsl,
                    piholeApiToken: data.bottom_piholeApiToken,
                    piholePassword: data.bottom_piholePassword,
                    piholeName: data.bottom_piholeName,
                    adguardHost: data.bottom_adguardHost,
                    adguardPort: data.bottom_adguardPort,
                    adguardSsl: data.bottom_adguardSsl,
                    adguardUsername: data.bottom_adguardUsername,
                    adguardPassword: data.bottom_adguardPassword,
                    adguardName: data.bottom_adguardName,
                    showLabel: data.bottom_showLabel
                };

                const topConfig: any = await createWidgetConfig(data.topWidgetType || '', topWidgetData);
                const bottomConfig: any = await createWidgetConfig(data.bottomWidgetType || '', bottomWidgetData);

                return {
                    topWidget: {
                        type: data.topWidgetType,
                        config: topConfig
                    },
                    bottomWidget: {
                        type: data.bottomWidgetType,
                        config: bottomConfig
                    }
                };
            }
        }

        return {};
    };

    // Function to completely reset form when closing
    const handleFormClose = () => {
        // Reset all component state
        setCustomIconFile(null);

        // Reset form values to empty/default values
        formContext.reset({
            shortcutName: '',
            pageName: '',
            itemType: '',
            url: '',
            showLabel: false,
            icon: null,
            widgetType: '',
            placeholderSize: 'app',
            torrentClientType: TORRENT_CLIENT_TYPE.QBITTORRENT,
            temperatureUnit: 'fahrenheit',
            timezone: '',
            adminOnly: false,
            isWol: false,
            macAddress: '',
            broadcastAddress: '',
            port: '',
            healthUrl: '',
            healthCheckType: 'http' as 'http' | 'ping',
            tcHost: '',
            tcPort: '8080',
            tcSsl: false,
            tcUsername: '',
            tcPassword: '',
            piholeHost: '',
            piholePort: '',
            piholeSsl: false,
            piholeApiToken: '',
            piholePassword: '',
            piholeName: '',
            // AdGuard widget fields
            adguardHost: '',
            adguardPort: '80', // AdGuard Home default web interface port
            adguardSsl: false,
            adguardUsername: '',
            adguardPassword: '',
            adguardName: '',
            // Media server widget fields
            mediaServerType: 'jellyfin',
            mediaServerName: 'Jellyfin',
            msHost: '',
            msPort: '8096',
            msSsl: false,
            msApiKey: '',
            location: null,
            gauge1: 'cpu',
            gauge2: 'temp',
            gauge3: 'ram',
            networkInterface: '',
            // Reset dual widget fields
            topWidgetType: '',
            bottomWidgetType: '',
            // Dual Widget - position-specific fields for top widget
            top_temperatureUnit: '',
            top_location: null,
            top_timezone: '',
            top_gauge1: '',
            top_gauge2: '',
            top_gauge3: '',
            top_networkInterface: '',
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
            top_showLabel: false,
            // Dual Widget - position-specific fields for bottom widget
            bottom_temperatureUnit: '',
            bottom_location: null,
            bottom_timezone: '',
            bottom_gauge1: '',
            bottom_gauge2: '',
            bottom_gauge3: '',
            bottom_networkInterface: '',
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
            bottom_showLabel: false,
        });

        // Call the handleClose prop to close the modal
        handleClose();
    };

    return (
        <Grid
            container
            justifyContent='center'
            alignItems='center'
            key={existingItem ? `item-${existingItem.id}` : 'new-item'}
        >
            <Grid>
                <Box
                    sx={{
                        p: 3,
                        borderRadius: '8px',
                        boxShadow: 3,
                        backgroundColor: COLORS.GRAY,
                        width: { xs: '80vw', sm: '60vw', md: '40vw', lg: '25vw' }
                    }}
                >
                    <FormContainer
                        onSuccess={handleSubmit}
                        formContext={formContext}
                        key={existingItem ? `form-${existingItem.id}` : 'new-form'}
                    >
                        <Grid container spacing={2} sx={styles.vcenter}>
                            <Grid>
                                <SelectElement label='Item Type' name='itemType' options={ITEM_TYPE_OPTIONS} required fullWidth sx={{
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': {
                                            borderColor: 'text.primary',
                                        },
                                        '.MuiSvgIcon-root ': {
                                            fill: theme.palette.text.primary,
                                        },
                                        '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                    },
                                    width: '100%',
                                    minWidth: isMobile ? '65vw' :'20vw',
                                    '& .MuiMenuItem-root:hover': {
                                        backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                                    },
                                    '& .MuiMenuItem-root.Mui-selected': {
                                        backgroundColor: `${theme.palette.primary.main} !important`,
                                        color: 'white',
                                    },
                                    '& .MuiMenuItem-root.Mui-selected:hover': {
                                        backgroundColor: `${theme.palette.primary.main} !important`,
                                        color: 'white',
                                    }
                                }}
                                slotProps={{
                                    inputLabel:
                                        { style: { color: theme.palette.text.primary } }
                                }}
                                />
                            </Grid>

                            {selectedItemType === 'widget' && (
                                <Grid>
                                    <SelectElement
                                        label='Widget Type'
                                        name='widgetType'
                                        options={WIDGET_OPTIONS}
                                        required
                                        fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: 'text.primary',
                                                },
                                                '.MuiSvgIcon-root ': {
                                                    fill: theme.palette.text.primary,
                                                },
                                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                            },
                                            width: '100%',
                                            minWidth: isMobile ? '65vw' :'20vw',
                                            '& .MuiMenuItem-root:hover': {
                                                backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                                            },
                                            '& .MuiMenuItem-root.Mui-selected': {
                                                backgroundColor: `${theme.palette.primary.main} !important`,
                                                color: 'white',
                                            },
                                            '& .MuiMenuItem-root.Mui-selected:hover': {
                                                backgroundColor: `${theme.palette.primary.main} !important`,
                                                color: 'white',
                                            }
                                        }}
                                        slotProps={{
                                            inputLabel: { style: { color: theme.palette.text.primary } }
                                        }}
                                    />
                                </Grid>
                            )}

                            {selectedItemType === ITEM_TYPE.PAGE && (
                                <Grid>
                                    <TextFieldElement
                                        label='Page Name'
                                        name='pageName'
                                        required
                                        fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: 'text.primary',
                                                },
                                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                                            },
                                            width: '100%',
                                            minWidth: isMobile ? '65vw' : '20vw'
                                        }}
                                        helperText='Pages are added to the navigation menu'
                                        slotProps={{
                                            inputLabel: { style: { color: theme.palette.text.primary } }
                                        }}
                                        rules={{
                                            required: 'Page name is required',
                                            validate: (value: string) => {
                                                if (!value) return 'Page name is required';

                                                // Check if it contains only alphanumeric characters and spaces
                                                const allowedCharsRegex = /^[a-zA-Z0-9\s]+$/;
                                                if (!allowedCharsRegex.test(value)) {
                                                    return 'Page name can only contain letters, numbers, and spaces';
                                                }

                                                // Check if it's the word "settings" (case-insensitive)
                                                if (value.toLowerCase() === 'settings') {
                                                    return 'Page name cannot be "settings"';
                                                }

                                                // Check for duplicate page names (case-insensitive)
                                                const existingPages = pages || [];
                                                const isDuplicate = existingPages.some((page: Page) =>
                                                    page.name.toLowerCase() === value.toLowerCase() &&
                                                    page.id !== existingItem?.id
                                                );
                                                if (isDuplicate) {
                                                    return `A page named "${value}" already exists. Please choose a different name.`;
                                                }

                                                return true;
                                            }
                                        }}
                                    />
                                </Grid>
                            )}

                            {selectedItemType === ITEM_TYPE.PAGE && (
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
                                        checked={formContext.watch('adminOnly')}
                                        sx={{
                                            ml: 1,
                                            color: 'white',
                                            '& .MuiSvgIcon-root': { fontSize: 30 },
                                            '& .MuiFormHelperText-root': {
                                                marginLeft: 1,
                                                fontSize: '0.75rem',
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        }}
                                    />
                                </Grid>
                            )}

                            {/* Widget specific configurations */}
                            {selectedItemType === 'widget' && selectedWidgetType && (
                                <>
                                    <WidgetConfig formContext={formContext} widgetType={selectedWidgetType} existingItem={existingItem} />

                                    {/* Admin Only checkbox for widget types - keep this outside the WidgetConfig component */}
                                    <Grid>
                                        <CheckboxElement
                                            label='Admin Only'
                                            name='adminOnly'
                                            checked={formContext.watch('adminOnly')}

                                            sx={{
                                                ml: 1,
                                                color: 'white',
                                                '& .MuiSvgIcon-root': { fontSize: 30 },
                                                '& .MuiFormHelperText-root': {
                                                    marginLeft: 1,
                                                    fontSize: '0.75rem',
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }
                                            }}
                                        />
                                    </Grid>
                                </>
                            )}

                            {selectedItemType === ITEM_TYPE.APP_SHORTCUT && (
                                <AppShortcutConfig formContext={formContext} onCustomIconSelect={handleCustomIconSelect} />
                            )}

                            {selectedItemType === ITEM_TYPE.PLACEHOLDER && (
                                <PlaceholderConfig formContext={formContext} />
                            )}

                            {(selectedItemType === ITEM_TYPE.BLANK_WIDGET || selectedItemType === ITEM_TYPE.BLANK_ROW || selectedItemType === ITEM_TYPE.BLANK_APP) && (
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
                                        checked={formContext.watch('adminOnly')}
                                        sx={{
                                            ml: 1,
                                            color: 'white',
                                            '& .MuiSvgIcon-root': { fontSize: 30 },
                                            '& .MuiFormHelperText-root': {
                                                marginLeft: 1,
                                                fontSize: '0.75rem',
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        }}
                                    />
                                </Grid>
                            )}

                            <Grid sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 2 }}>
                                <Button variant='contained' type='submit' sx={{ minHeight: '3rem' }} fullWidth>
                                    {existingItem ? 'Update' : 'Add'}
                                </Button>
                            </Grid>
                        </Grid>
                    </FormContainer>
                </Box>
            </Grid>
        </Grid>
    );
};
