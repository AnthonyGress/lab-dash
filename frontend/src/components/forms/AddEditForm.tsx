import ClearIcon from '@mui/icons-material/Clear';
import { Autocomplete, Box, Button, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, TextField, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { AppShortcutConfig, PlaceholderConfig, WidgetConfig } from './configs';
import { IconSearch } from './IconSearch';
import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { DashboardItem, Icon, ITEM_TYPE, NewItem, TORRENT_CLIENT_TYPE } from '../../types';
import { isEncrypted } from '../../utils/utils';

type Props = {
    handleClose: () => void
    existingItem?: DashboardItem | null;
    onSubmit?: (item: DashboardItem) => void;
}

const ITEM_TYPE_OPTIONS = [
    { id: ITEM_TYPE.APP_SHORTCUT, label: 'Shortcut' },
    { id: 'widget', label: 'Widget' },
    { id: ITEM_TYPE.PAGE, label: 'Page' },
    { id: ITEM_TYPE.PLACEHOLDER, label: 'Placeholder' },
];

const WIDGET_OPTIONS = [
    { id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' },
    { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' },
    { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' },
    { id: ITEM_TYPE.PIHOLE_WIDGET, label: 'Pi-hole' },
    { id: ITEM_TYPE.TORRENT_CLIENT, label: 'Torrent Client' },
    { id: ITEM_TYPE.DUAL_WIDGET, label: 'Dual Widget' },
    { id: ITEM_TYPE.GROUP_WIDGET, label: 'Group Widget' }
];

const TEMPERATURE_UNIT_OPTIONS = [
    { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
    { id: 'celsius', label: 'Celsius (°C)' }
];

const SYSTEM_MONITOR_GAUGE_OPTIONS = [
    { id: 'cpu', label: 'CPU Usage' },
    { id: 'temp', label: 'CPU Temperature' },
    { id: 'ram', label: 'RAM Usage' },
    { id: 'network', label: 'Network' },
    { id: 'none', label: 'None' }
];

const TORRENT_CLIENT_OPTIONS = [
    { id: TORRENT_CLIENT_TYPE.QBITTORRENT, label: 'qBittorrent' },
    { id: TORRENT_CLIENT_TYPE.DELUGE, label: 'Deluge' }
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
    const { dashboardLayout, addItem, updateItem, addPage } = useAppContext();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
        const piholeApiToken = existingItem?.config?.piholeApiToken || existingItem?.config?.apiToken || '';
        const piholePassword = existingItem?.config?.password || '';
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
                (existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112' : '8080'),
            tcSsl: existingItem?.config?.ssl || false,
            tcUsername: existingItem?.config?.username || '',
            tcPassword: existingItem?.config?.password || '',
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
                        formContext.setValue('top_piholeApiToken', topConfig.apiToken || '');
                        formContext.setValue('top_piholePassword', topConfig.password || '');
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
                        formContext.setValue('bottom_piholeApiToken', bottomConfig.apiToken || '');
                        formContext.setValue('bottom_piholePassword', bottomConfig.password || '');
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
                    await addPage(data.pageName);
                    handleFormClose();
                } catch (error) {
                    console.error('Error creating page:', error);
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
                // Encrypt the API token if needed
                let encryptedToken = data.piholeApiToken || '';
                let encryptedPassword = data.piholePassword || '';

                if (encryptedToken && !isEncrypted(encryptedToken)) {
                    try {
                        encryptedToken = await DashApi.encryptPiholeToken(encryptedToken);
                    } catch (error) {
                        console.error('Error encrypting Pi-hole API token:', error);
                    }
                }

                if (encryptedPassword && !isEncrypted(encryptedPassword)) {
                    try {
                        encryptedPassword = await DashApi.encryptPiholePassword(encryptedPassword);
                    } catch (error) {
                        console.error('Error encrypting Pi-hole password:', error);
                    }
                }

                config = {
                    host: data.piholeHost,
                    port: data.piholePort,
                    ssl: data.piholeSsl,
                    apiToken: encryptedToken,
                    password: encryptedPassword,
                    showLabel: data.showLabel,
                    displayName: data.piholeName || 'Pi-hole'
                };
            } else if (data.widgetType === ITEM_TYPE.TORRENT_CLIENT) {
                // Encrypt password using backend API
                let encryptedPassword = data.tcPassword || '';

                if (encryptedPassword && !isEncrypted(encryptedPassword)) {
                    try {
                        encryptedPassword = await DashApi.encryptPassword(encryptedPassword);
                    } catch (error) {
                        console.error('Error encrypting password:', error);
                    }
                }

                config = {
                    clientType: data.torrentClientType,
                    host: data.tcHost,
                    port: data.tcPort,
                    ssl: data.tcSsl,
                    username: data.tcUsername,
                    password: encryptedPassword,
                    showLabel: data.showLabel
                };
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
                // Create a dual widget configuration with both top and bottom widget configs
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
            const clientName = clientType === TORRENT_CLIENT_TYPE.DELUGE ? 'Deluge' : 'qBittorrent';
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
                    updateItem(existingItem.id, updatedItem);
                }
            } else {
                await addItem(updatedItem);
            }

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
            // Encrypt the API token if needed
            let encryptedToken = data.piholeApiToken || '';
            let encryptedPassword = data.piholePassword || '';

            if (encryptedToken && !isEncrypted(encryptedToken)) {
                try {
                    encryptedToken = await DashApi.encryptPiholeToken(encryptedToken);
                } catch (error) {
                    console.error('Error encrypting Pi-hole API token:', error);
                }
            }

            if (encryptedPassword && !isEncrypted(encryptedPassword)) {
                try {
                    encryptedPassword = await DashApi.encryptPiholePassword(encryptedPassword);
                } catch (error) {
                    console.error('Error encrypting Pi-hole password:', error);
                }
            }

            return {
                host: data.piholeHost,
                port: data.piholePort,
                ssl: data.piholeSsl,
                apiToken: encryptedToken,
                password: encryptedPassword,
                showLabel: data.showLabel,
                displayName: data.piholeName || 'Pi-hole'
            };
        } else if (widgetType === ITEM_TYPE.TORRENT_CLIENT) {
            // Encrypt password using backend API
            let encryptedPassword = data.tcPassword || '';

            if (encryptedPassword && !isEncrypted(encryptedPassword)) {
                try {
                    encryptedPassword = await DashApi.encryptPassword(encryptedPassword);
                } catch (error) {
                    console.error('Error encrypting password:', error);
                }
            }

            return {
                clientType: data.torrentClientType,
                host: data.tcHost,
                port: data.tcPort,
                ssl: data.tcSsl,
                username: data.tcUsername,
                password: encryptedPassword,
                showLabel: data.showLabel
            };
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

                                                return true;
                                            }
                                        }}
                                    />
                                </Grid>
                            )}

                            {/* Widget specific configurations */}
                            {selectedItemType === 'widget' && selectedWidgetType && (
                                <>
                                    <WidgetConfig formContext={formContext} widgetType={selectedWidgetType} />

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
