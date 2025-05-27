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
import { DashboardItem, ITEM_TYPE, NewItem, Page, TORRENT_CLIENT_TYPE } from '../../types';
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
    { id: ITEM_TYPE.TORRENT_CLIENT, label: 'Torrent Client' },
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

    // Removed torrent client type state, now handled in TorrentClientWidgetConfig

    // Removed app shortcut config, now handled in AppShortcutConfig

    const formContext = useForm<FormValues>();

    // Reset and initialize form when existingItem changes or when component mounts
    useEffect(() => {
        // Determine initial values based on existingItem
        const initialItemType = existingItem?.type === ITEM_TYPE.WEATHER_WIDGET ||
                               existingItem?.type === ITEM_TYPE.DATE_TIME_WIDGET ||
                               existingItem?.type === ITEM_TYPE.SYSTEM_MONITOR_WIDGET ||
                               existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET ||
                               existingItem?.type === ITEM_TYPE.TORRENT_CLIENT ||
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
                                  existingItem?.type === ITEM_TYPE.TORRENT_CLIENT ||
                                  existingItem?.type === ITEM_TYPE.DUAL_WIDGET ||
                                  existingItem?.type === ITEM_TYPE.GROUP_WIDGET
            ? existingItem?.type
            : '';

        const initialShowLabel = existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET
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
            console.log('Loaded maxItems from config:', maxItems);
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
            torrentClientType: existingItem?.config?.clientType || TORRENT_CLIENT_TYPE.QBITTORRENT,
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
            // Torrent client config
            tcHost: existingItem?.config?.host || 'localhost',
            tcPort: existingItem?.config?.port ||
                (existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112'
                    : existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.TRANSMISSION ? '9091'
                        : '8080'),
            tcSsl: existingItem?.config?.ssl || false,
            tcUsername: existingItem?.config?.username || '',
            tcPassword: (existingItem?.type === ITEM_TYPE.TORRENT_CLIENT && existingItem?.id) ? '**********' : '',
            piholeHost: piholeHost,
            piholePort: piholePort,
            piholeSsl: piholeSsl,
            piholeApiToken: piholeApiToken,
            piholePassword: piholePassword,
            piholeName: piholeName,
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
                        formContext.setValue('top_piholePort', topConfig.port || '');
                        formContext.setValue('top_piholeSsl', topConfig.ssl !== undefined ? topConfig.ssl : false);
                        // Use masked values for sensitive data
                        formContext.setValue('top_piholeApiToken', topConfig._hasApiToken ? '**********' : '');
                        formContext.setValue('top_piholePassword', topConfig._hasPassword ? '**********' : '');
                        formContext.setValue('top_piholeName', topConfig.displayName || '');
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
                        formContext.setValue('bottom_piholePort', bottomConfig.port || '');
                        formContext.setValue('bottom_piholeSsl', bottomConfig.ssl !== undefined ? bottomConfig.ssl : false);
                        // Use masked values for sensitive data
                        formContext.setValue('bottom_piholeApiToken', bottomConfig._hasApiToken ? '**********' : '');
                        formContext.setValue('bottom_piholePassword', bottomConfig._hasPassword ? '**********' : '');
                        formContext.setValue('bottom_piholeName', bottomConfig.displayName || '');
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

    // Helper function to check if a type is a widget type
    function isWidgetType(type?: string): boolean {
        if (!type) return false;
        return [
            ITEM_TYPE.WEATHER_WIDGET,
            ITEM_TYPE.DATE_TIME_WIDGET,
            ITEM_TYPE.SYSTEM_MONITOR_WIDGET,
            ITEM_TYPE.TORRENT_CLIENT,
            ITEM_TYPE.PIHOLE_WIDGET,
            ITEM_TYPE.DUAL_WIDGET
        ].includes(type as ITEM_TYPE);
    }

    const selectedItemType = formContext.watch('itemType');
    const selectedWidgetType = formContext.watch('widgetType');

    // Set default showLabel based on widget type
    useEffect(() => {
        if (selectedItemType === 'widget') {
            // Only set the default if there's no existing value (to avoid overriding user choice)
            if (formContext.getValues('showLabel') === undefined || (!existingItem && (
                selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET ||
                selectedWidgetType === ITEM_TYPE.TORRENT_CLIENT ||
                selectedWidgetType === ITEM_TYPE.DUAL_WIDGET
            ))) {
                if (selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.TORRENT_CLIENT ||
                    selectedWidgetType === ITEM_TYPE.DUAL_WIDGET) {
                    formContext.setValue('showLabel', true);
                } else {
                    formContext.setValue('showLabel', false);
                }
            }
        }
    }, [selectedItemType, selectedWidgetType, formContext, existingItem]);

    // Removed location search and update useEffects, now handled in WeatherWidgetConfig

    const handleCustomIconSelect = (file: File | null) => {
        setCustomIconFile(file);
    };

    const handleSubmit = async (data: FormValues) => {
        console.log('Form submitted with data:', data);

        // Handle page creation
        if (data.itemType === ITEM_TYPE.PAGE) {
            if (data.pageName) {
                try {
                    const newPageId = await addPage(data.pageName);
                    handleFormClose();

                    if (newPageId) {
                        // Wait a brief moment for state to update, then navigate to the newly created page
                        setTimeout(() => {
                            const pageSlug = pageNameToSlug(data.pageName!);
                            navigate(`/${pageSlug}`);
                        }, 100);
                    }
                } catch (error) {
                    console.error('Error creating page:', error);
                    // Set form error for the pageName field
                    formContext.setError('pageName', {
                        type: 'manual',
                        message: error instanceof Error ? error.message : 'Failed to create page'
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

        let config = undefined;
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
            } else if (data.widgetType === ITEM_TYPE.TORRENT_CLIENT) {
                // Handle masked password - only encrypt if not masked
                let encryptedPassword = '';
                let hasExistingPassword = false;

                // Check if we're editing an existing item with a password
                // Since existingItem may not have _hasPassword flag (filtered data),
                // assume existing torrent client items have passwords
                if (existingItem?.type === ITEM_TYPE.TORRENT_CLIENT && existingItem?.id) {
                    hasExistingPassword = true;
                }

                // Only process password if it's not the masked value
                if (data.tcPassword && data.tcPassword !== '**********') {
                    if (!isEncrypted(data.tcPassword)) {
                        try {
                            encryptedPassword = await DashApi.encryptPassword(data.tcPassword);
                        } catch (error) {
                            console.error('Error encrypting password:', error);
                        }
                    } else {
                        encryptedPassword = data.tcPassword;
                    }
                }

                const baseConfig = {
                    clientType: data.torrentClientType,
                    host: data.tcHost,
                    port: data.tcPort,
                    ssl: data.tcSsl,
                    username: data.tcUsername,
                    showLabel: data.showLabel
                };

                // Include password if it was actually changed (not masked)
                if (encryptedPassword) {
                    config = { ...baseConfig, password: encryptedPassword };
                } else if (hasExistingPassword) {
                    // If we have an existing password but no new password provided, set the flag
                    config = { ...baseConfig, _hasPassword: true };
                } else {
                    config = baseConfig;
                }
            } else if (data.widgetType === ITEM_TYPE.GROUP_WIDGET) {
                // For group widget, use the exact maxItems value from the form
                // This preserves the layout format (e.g., "6_2x3" or "6_3x2")
                const maxItems = data.maxItems || '3';
                console.log('Setting maxItems in GROUP_WIDGET_SMALL:', maxItems);

                config = {
                    title: data.shortcutName,
                    items: existingItem?.config?.items || [],  // Preserve existing items when updating
                    showLabel: data.showLabel,
                    maxItems: maxItems  // Store the original string value to preserve layout information
                };
            } else if (data.widgetType === ITEM_TYPE.DUAL_WIDGET) {
                // Check if DualWidgetConfig component has already built the config
                const existingConfig = (formContext as any).getValues('config');

                if (existingConfig && existingConfig.topWidget && existingConfig.bottomWidget) {
                    // Use the config built by DualWidgetConfig component (preserves sensitive data flags)
                    config = existingConfig;
                } else {
                    // Fallback to building config from form data (for backwards compatibility)

                    // Ensure neither widget type is TorrentClient
                    if (data.topWidgetType === ITEM_TYPE.TORRENT_CLIENT ||
                        data.bottomWidgetType === ITEM_TYPE.TORRENT_CLIENT) {
                        console.error('TorrentClient widget is not supported in Dual Widget');
                        // Replace TorrentClient with DateTimeWidget as a fallback
                        if (data.topWidgetType === ITEM_TYPE.TORRENT_CLIENT) {
                            data.topWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                        }
                        if (data.bottomWidgetType === ITEM_TYPE.TORRENT_CLIENT) {
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
                        showLabel: data.bottom_showLabel
                    };

                    const topConfig = await createWidgetConfig(data.topWidgetType || '', topWidgetData);
                    const bottomConfig = await createWidgetConfig(data.bottomWidgetType || '', bottomWidgetData);

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

        // Generate label for torrent client widgets if not provided
        let itemLabel = data.shortcutName || '';
        if (actualItemType === ITEM_TYPE.TORRENT_CLIENT && !itemLabel) {
            const clientType = data.torrentClientType || TORRENT_CLIENT_TYPE.QBITTORRENT;
            const clientName = clientType === TORRENT_CLIENT_TYPE.DELUGE ? 'Deluge'
                : clientType === TORRENT_CLIENT_TYPE.TRANSMISSION ? 'Transmission'
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
                // Check if this is an item in a group widget
                const isGroupItem = existingItem.type === ITEM_TYPE.APP_SHORTCUT &&
                                   dashboardLayout.findIndex(item => item.id === existingItem.id) === -1;

                // If this is an item in a group, call onSubmit with the updated item
                if (isGroupItem && onSubmit) {
                    const updated = {
                        ...existingItem,
                        ...updatedItem
                    };
                    onSubmit(updated as DashboardItem);
                } else {
                    // Otherwise update normally
                    await updateItem(existingItem.id, updatedItem);
                }
            } else {
                await addItem(updatedItem);
            }

            // Refresh the dashboard to ensure all widgets are updated with latest data
            await refreshDashboard();

            console.log('Form submission complete, resetting form');
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
    const createWidgetConfig = async (widgetType: string, data: FormValues) => {
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
        } else if (widgetType === ITEM_TYPE.TORRENT_CLIENT) {
            // Handle masked password - only encrypt if not masked
            let encryptedPassword = '';
            let hasExistingPassword = false;

            // Check if we're editing an existing item with a password
            // Since existingItem may not have _hasPassword flag (filtered data),
            // assume existing torrent client items have passwords
            if (existingItem?.type === ITEM_TYPE.TORRENT_CLIENT && existingItem?.id) {
                hasExistingPassword = true;
            }

            // Only process password if it's not the masked value
            if (data.tcPassword && data.tcPassword !== '**********') {
                if (!isEncrypted(data.tcPassword)) {
                    try {
                        encryptedPassword = await DashApi.encryptPassword(data.tcPassword);
                    } catch (error) {
                        console.error('Error encrypting password:', error);
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
                username: data.tcUsername,
                showLabel: data.showLabel
            };

            // Include password if it was actually changed (not masked)
            if (encryptedPassword) {
                config.password = encryptedPassword;
            } else if (hasExistingPassword) {
                // If we have an existing password but no new password provided, set the flag
                config._hasPassword = true;
            }

            return config;
        }

        return {};
    };

    // Function to completely reset form when closing
    const handleFormClose = () => {
        console.log('Closing form');

        // Reset all component state
        setCustomIconFile(null);

        // Reset form values to empty/default values
        formContext.reset({
            shortcutName: '',
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

                                                // Check if it's only alphanumeric characters
                                                const alphanumericRegex = /^[a-zA-Z0-9]+$/;
                                                if (!alphanumericRegex.test(value)) {
                                                    return 'Page name can only contain letters and numbers';
                                                }

                                                // Check if it's the word "settings" (case-insensitive)
                                                if (value.toLowerCase() === 'settings') {
                                                    return 'Page name cannot be "settings"';
                                                }

                                                // Check for duplicate page names (case-insensitive)
                                                const existingPages = pages || [];
                                                const isDuplicate = existingPages.some((page: Page) =>
                                                    page.name.toLowerCase() === value.toLowerCase()
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
