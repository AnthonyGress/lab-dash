import ClearIcon from '@mui/icons-material/Clear';
import { Autocomplete, Box, Button, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, TextField, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { AppShortcutConfig, WidgetConfig } from './configs';
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
}

const ITEM_TYPE_OPTIONS = [
    { id: ITEM_TYPE.APP_SHORTCUT, label: 'Shortcut' },
    { id: 'widget', label: 'Widget' },
    { id: ITEM_TYPE.BLANK_APP, label: 'Placeholder Shortcut' },
    { id: ITEM_TYPE.BLANK_WIDGET, label: 'Placeholder Widget' },
    { id: ITEM_TYPE.BLANK_ROW, label: 'Placeholder Row' },
];

const WIDGET_OPTIONS = [
    { id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' },
    { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' },
    { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' },
    { id: ITEM_TYPE.PIHOLE_WIDGET, label: 'Pi-hole' },
    { id: ITEM_TYPE.TORRENT_CLIENT, label: 'Torrent Client' },
    { id: ITEM_TYPE.DUAL_WIDGET, label: 'Dual Widget' }
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
    itemType: string;
    url?: string;
    healthUrl?: string;
    healthCheckType?: 'http' | 'ping';
    icon?: { path: string; name: string; source?: string } | null;
    showLabel?: boolean;
    widgetType?: string;
    // Weather widget
    temperatureUnit?: string;
    location?: { name: string; latitude: number; longitude: number } | null;
    // System monitor widget
    gauge1?: string;
    gauge2?: string;
    gauge3?: string;
    networkInterface?: string;
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
    // Other fields
    adminOnly?: boolean;
    isWol?: boolean;
    macAddress?: string;
    broadcastAddress?: string;
    port?: string;
};

interface LocationOption {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

export const AddEditForm = ({ handleClose, existingItem }: Props) => {
    const { formState: { errors } } = useForm();
    const { dashboardLayout, addItem, updateItem } = useAppContext();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [customIconFile, setCustomIconFile] = useState<File | null>(null);

    // Removed location-related state, now handled in WeatherWidgetConfig

    // Removed torrent client type state, now handled in TorrentClientWidgetConfig

    // Removed app shortcut config, now handled in AppShortcutConfig

    const formContext = useForm<FormValues>();

    // Reset and initialize form when existingItem changes or when component mounts
    useEffect(() => {
        // Determine initial values based on existingItem
        const initialItemType = isWidgetType(existingItem?.type)
            ? 'widget'
            : (existingItem?.type === ITEM_TYPE.BLANK_WIDGET || existingItem?.type === ITEM_TYPE.BLANK_ROW)
                ? existingItem?.type
                : existingItem?.type || '';

        const initialWidgetType = isWidgetType(existingItem?.type)
            ? existingItem?.type
            : '';

        const initialShowLabel = existingItem?.type === ITEM_TYPE.PIHOLE_WIDGET
            ? (existingItem.showLabel !== undefined ? existingItem.showLabel : true)
            : (existingItem?.showLabel !== undefined ? existingItem.showLabel : false);

        // Initialize other component state
        setCustomIconFile(null);

        // Initialize dual widget values if editing a dual widget
        let topWidgetType = '';
        let bottomWidgetType = '';
        let temperatureUnit = existingItem?.config?.temperatureUnit || 'fahrenheit';
        let location = existingItem?.config?.location || null;
        let gauges = existingItem?.config?.gauges || ['cpu', 'temp', 'ram'];
        let networkInterface = existingItem?.config?.networkInterface || '';
        let piholeHost = existingItem?.config?.piholeHost || existingItem?.config?.host || '';
        let piholePort = existingItem?.config?.piholePort || existingItem?.config?.port || '';
        let piholeSsl = existingItem?.config?.piholeSsl !== undefined
            ? existingItem?.config?.piholeSsl
            : existingItem?.config?.ssl || false;
        let piholeApiToken = existingItem?.config?.piholeApiToken || existingItem?.config?.apiToken || '';
        let piholePassword = existingItem?.config?.password || '';
        let piholeName = existingItem?.config?.displayName || '';
        const healthUrl = existingItem?.config?.healthUrl || '';

        if (existingItem?.type === ITEM_TYPE.DUAL_WIDGET) {
            topWidgetType = existingItem?.config?.topWidget?.type || '';
            bottomWidgetType = existingItem?.config?.bottomWidget?.type || '';

            // If the top widget is a weather widget, use its config
            if (topWidgetType === ITEM_TYPE.WEATHER_WIDGET && existingItem?.config?.topWidget?.config) {
                temperatureUnit = existingItem.config.topWidget.config.temperatureUnit || temperatureUnit;
                location = existingItem.config.topWidget.config.location || location;
            }
            // If the top widget is a system monitor widget, use its config
            else if (topWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET && existingItem?.config?.topWidget?.config) {
                temperatureUnit = existingItem.config.topWidget.config.temperatureUnit || temperatureUnit;
                gauges = existingItem.config.topWidget.config.gauges || gauges;
                networkInterface = existingItem.config.topWidget.config.networkInterface || networkInterface;
            }
            // If the top widget is a Pi-hole widget, use its config
            else if (topWidgetType === ITEM_TYPE.PIHOLE_WIDGET && existingItem?.config?.topWidget?.config) {
                piholeHost = existingItem.config.topWidget.config.host || piholeHost;
                piholePort = existingItem.config.topWidget.config.port || piholePort;
                piholeSsl = existingItem.config.topWidget.config.ssl !== undefined ? existingItem.config.topWidget.config.ssl : piholeSsl;
                piholeApiToken = existingItem.config.topWidget.config.apiToken || piholeApiToken;
                piholePassword = existingItem.config.topWidget.config.password || piholePassword;
                piholeName = existingItem.config.topWidget.config.displayName || piholeName;
            }

            // Do the same for bottom widget - weather
            if (bottomWidgetType === ITEM_TYPE.WEATHER_WIDGET && existingItem?.config?.bottomWidget?.config) {
                // Only override if top widget is not the same type to avoid conflicts
                if (topWidgetType !== ITEM_TYPE.WEATHER_WIDGET) {
                    temperatureUnit = existingItem.config.bottomWidget.config.temperatureUnit || temperatureUnit;
                    location = existingItem.config.bottomWidget.config.location || location;
                }
            }
            // System monitor
            else if (bottomWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET && existingItem?.config?.bottomWidget?.config) {
                if (topWidgetType !== ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                    temperatureUnit = existingItem.config.bottomWidget.config.temperatureUnit || temperatureUnit;
                    gauges = existingItem.config.bottomWidget.config.gauges || gauges;
                    networkInterface = existingItem.config.bottomWidget.config.networkInterface || networkInterface;
                }
            }
            // Pi-hole
            else if (bottomWidgetType === ITEM_TYPE.PIHOLE_WIDGET && existingItem?.config?.bottomWidget?.config) {
                if (topWidgetType !== ITEM_TYPE.PIHOLE_WIDGET) {
                    piholeHost = existingItem.config.bottomWidget.config.host || piholeHost;
                    piholePort = existingItem.config.bottomWidget.config.port || piholePort;
                    piholeSsl = existingItem.config.bottomWidget.config.ssl !== undefined ? existingItem.config.bottomWidget.config.ssl : piholeSsl;
                    piholeApiToken = existingItem.config.bottomWidget.config.apiToken || piholeApiToken;
                    piholePassword = existingItem.config.bottomWidget.config.password || piholePassword;
                    piholeName = existingItem.config.bottomWidget.config.displayName || piholeName;
                }
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
            torrentClientType: existingItem?.config?.clientType || TORRENT_CLIENT_TYPE.QBITTORRENT,
            temperatureUnit: temperatureUnit,
            adminOnly: existingItem?.adminOnly || false,
            isWol: existingItem?.config?.isWol || false,
            macAddress: existingItem?.config?.macAddress || '',
            broadcastAddress: existingItem?.config?.broadcastAddress || '',
            port: existingItem?.config?.port || '',
            healthUrl: healthUrl,
            healthCheckType: (existingItem?.config?.healthCheckType || 'http') as 'http' | 'ping',
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
            gauge1: gauges[0] || 'cpu',
            gauge2: gauges[1] || 'temp',
            gauge3: gauges[2] || 'ram',
            networkInterface: networkInterface,
            // Dual widget configuration
            topWidgetType,
            bottomWidgetType
        });
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

                const topConfig = await createWidgetConfig(data.topWidgetType || '', data);
                const bottomConfig = await createWidgetConfig(data.bottomWidgetType || '', data);

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
            : data.url;

        const updatedItem: NewItem = {
            label: data.shortcutName || '',
            icon: iconData ? {
                path: iconData.path,
                name: iconData.name,
                source: iconData.source
            } : undefined,
            url,
            type: data.itemType === 'widget' && data.widgetType ? data.widgetType : data.itemType,
            showLabel: data.showLabel,
            config: config,
            adminOnly: data.adminOnly
        };

        try {
            if (existingItem) {
                updateItem(existingItem.id, updatedItem);
            } else {
                await addItem(updatedItem);
            }

            formContext.reset();
            handleFormClose();
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    // Helper function to create widget configuration based on widget type
    const createWidgetConfig = async (widgetType: string, data: FormValues) => {
        if (widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            return {
                temperatureUnit: data.temperatureUnit || 'fahrenheit',
                location: data.location || undefined
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
            torrentClientType: TORRENT_CLIENT_TYPE.QBITTORRENT,
            temperatureUnit: 'fahrenheit',
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
        });

        // This ensures that when the form is reopened, the initial effect will run and set values from existingItem
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
