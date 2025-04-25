import ClearIcon from '@mui/icons-material/Clear';
import { Autocomplete, Box, Button, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, TextField, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';

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
    { id: ITEM_TYPE.TORRENT_CLIENT, label: 'Torrent Client' }
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

type FormValues = {
    shortcutName?: string;
    itemType: string;
    url?: string;
    icon?: { path: string; name: string; source?: string } | null;
    showLabel?: boolean;
    widgetType?: string;
    temperatureUnit?: string;
    location?: { name: string; latitude: number; longitude: number } | null;
    adminOnly?: boolean;
    isWol?: boolean;
    macAddress?: string;
    broadcastAddress?: string;
    port?: string;
    // Torrent client common config
    torrentClientType?: string;
    tcHost?: string;
    tcPort?: string;
    tcSsl?: boolean;
    tcUsername?: string;
    tcPassword?: string;
    piholeHost?: string;
    piholePort?: string;
    piholeSsl?: boolean;
    piholeApiToken?: string;
    piholePassword?: string;
    piholeName?: string;
    gauge1?: string;
    gauge2?: string;
    gauge3?: string;
    networkInterface?: string;
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
    const [editingWolShortcut, setEditingWolShortcut] = useState(false);
    const [locationSearch, setLocationSearch] = useState('');
    const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [networkInterfaces, setNetworkInterfaces] = useState<Array<{id: string, label: string}>>([]);

    // Initialize client type from existing item or default to qBittorrent
    const [torrentClientType, setTorrentClientType] = useState<string>(
        existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE
            ? TORRENT_CLIENT_TYPE.DELUGE
            : TORRENT_CLIENT_TYPE.QBITTORRENT
    );

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

        // Initialize location state if it exists
        if (existingItem?.config?.location) {
            setSelectedLocation(existingItem.config.location as LocationOption);
            setLocationSearch(existingItem.config.location.name || '');
        } else {
            setSelectedLocation(null);
            setLocationSearch('');
        }

        // Initialize other component state
        setTorrentClientType(
            existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE
                ? TORRENT_CLIENT_TYPE.DELUGE
                : TORRENT_CLIENT_TYPE.QBITTORRENT
        );
        setCustomIconFile(null);
        setEditingWolShortcut(existingItem?.config?.isWol || false);

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
            temperatureUnit: existingItem?.config?.temperatureUnit || 'fahrenheit',
            adminOnly: existingItem?.adminOnly || false,
            isWol: existingItem?.config?.isWol || false,
            macAddress: existingItem?.config?.macAddress || '',
            broadcastAddress: existingItem?.config?.broadcastAddress || '',
            port: existingItem?.config?.port || '',
            // Torrent client config
            tcHost: existingItem?.config?.host || 'localhost',
            tcPort: existingItem?.config?.port ||
                (existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112' : '8080'),
            tcSsl: existingItem?.config?.ssl || false,
            tcUsername: existingItem?.config?.username || '',
            tcPassword: existingItem?.config?.password || '',
            piholeHost: existingItem?.config?.piholeHost || existingItem?.config?.host || '',
            piholePort: existingItem?.config?.piholePort || existingItem?.config?.port || '',
            piholeSsl: existingItem?.config?.piholeSsl !== undefined
                ? existingItem?.config?.piholeSsl
                : existingItem?.config?.ssl || false,
            piholeApiToken: existingItem?.config?.piholeApiToken || existingItem?.config?.apiToken || '',
            piholePassword: existingItem?.config?.password || '',
            piholeName: existingItem?.config?.displayName || '',
            location: existingItem?.config?.location || null,
            gauge1: existingItem?.config?.gauges?.[0] || 'cpu',
            gauge2: existingItem?.config?.gauges?.[1] || 'temp',
            gauge3: existingItem?.config?.gauges?.[2] || 'ram',
            networkInterface: existingItem?.config?.networkInterface || '',
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
            ITEM_TYPE.PIHOLE_WIDGET
        ].includes(type as ITEM_TYPE);
    }

    const selectedItemType = formContext.watch('itemType');
    const selectedWidgetType = formContext.watch('widgetType');
    const isWol = formContext.watch('isWol', false);
    const watchedTorrentClientType = formContext.watch('torrentClientType');

    // Set default showLabel based on widget type
    useEffect(() => {
        if (selectedItemType === 'widget') {
            // Only set the default if there's no existing value (to avoid overriding user choice)
            if (formContext.getValues('showLabel') === undefined || (!existingItem && (selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET || selectedWidgetType === ITEM_TYPE.TORRENT_CLIENT))) {
                if (selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET || selectedWidgetType === ITEM_TYPE.TORRENT_CLIENT) {
                    formContext.setValue('showLabel', true);
                } else {
                    formContext.setValue('showLabel', false);
                }
            }
        }
    }, [selectedItemType, selectedWidgetType, formContext, existingItem]);

    useEffect(() => {
        if (watchedTorrentClientType) {
            setTorrentClientType(watchedTorrentClientType);

            // Update the port based on torrent client type
            const defaultPort = watchedTorrentClientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112' : '8080';
            formContext.setValue('tcPort', defaultPort);
        }
    }, [watchedTorrentClientType, formContext]);

    useEffect(() => {
        // Debounce location search and fetch results
        const fetchLocations = async () => {
            if (locationSearch.length < 2) {
                setLocationOptions([]);
                return;
            }

            setIsSearching(true);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&limit=5`);
                const data = await response.json();

                // Create a Map to track seen names and ensure uniqueness
                const uniqueLocations = new Map();

                // Process each location, ensuring uniqueness
                data.forEach((item: any) => {
                    const name = item.display_name;
                    // Use a combination of place_id and name as the unique key
                    const uniqueId = `${item.place_id}_${name}`;

                    if (!uniqueLocations.has(name)) {
                        uniqueLocations.set(name, {
                            id: uniqueId,
                            name: name,
                            latitude: parseFloat(item.lat),
                            longitude: parseFloat(item.lon)
                        });
                    }
                });

                // Convert the Map values to an array
                const results = Array.from(uniqueLocations.values());

                setLocationOptions(results);
            } catch (error) {
                console.error('Error fetching locations:', error);
                setLocationOptions([]);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(() => {
            if (locationSearch) {
                fetchLocations();
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [locationSearch]);

    // When a location is selected, update the form values
    useEffect(() => {
        if (selectedLocation) {
            formContext.setValue('location', {
                name: selectedLocation.name,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude
            });
        }
    }, [selectedLocation]);

    // Fetch network interfaces for system monitor widget
    useEffect(() => {
        const fetchNetworkInterfaces = async () => {
            if (selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                try {
                    const systemInfo = await DashApi.getSystemInformation();
                    if (systemInfo && systemInfo.networkInterfaces && Array.isArray(systemInfo.networkInterfaces)) {
                        // Get only the primary network interface that backend is using
                        if (systemInfo.network?.iface) {
                            // Just show the active interface being used by the system
                            const activeInterface = {
                                id: systemInfo.network.iface,
                                label: systemInfo.network.iface
                            };

                            console.log('Active network interface:', activeInterface);
                            setNetworkInterfaces([activeInterface]);

                            // Set the form value to the active interface
                            formContext.setValue('networkInterface', activeInterface.id);
                        } else {
                            console.log('No active network interface found');
                            setNetworkInterfaces([]);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching network interfaces:', error);
                }
            }
        };

        fetchNetworkInterfaces();
    }, [
        selectedItemType,
        selectedWidgetType,
        formContext.watch('gauge1'),
        formContext.watch('gauge2'),
        formContext.watch('gauge3')
    ]);

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
        if (data.itemType === 'widget' && data.widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            config = {
                temperatureUnit: data.temperatureUnit || 'fahrenheit',
                location: data.location || undefined
            };
        } else if (data.itemType === 'widget' && data.widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            config = {
                temperatureUnit: data.temperatureUnit || 'fahrenheit',
                gauges: [data.gauge1, data.gauge2, data.gauge3]
            };

            // Add network interface to config if a network gauge is included
            if ([data.gauge1, data.gauge2, data.gauge3].includes('network') && data.networkInterface) {
                (config as any).networkInterface = data.networkInterface;
            }
        } else if (data.itemType === 'widget' && data.widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
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
        } else if (data.itemType === 'widget' && data.widgetType === ITEM_TYPE.TORRENT_CLIENT) {
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
        } else if (data.itemType === ITEM_TYPE.APP_SHORTCUT && data.isWol) {
            config = {
                isWol: true,
                macAddress: data.macAddress,
                broadcastAddress: data.broadcastAddress,
                port: data.port
            };
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

    // Function to completely reset form when closing
    const handleFormClose = () => {
        // Reset all component state
        setLocationSearch('');
        setSelectedLocation(null);
        setLocationOptions([]);
        setCustomIconFile(null);
        setEditingWolShortcut(false);

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
            tcHost: 'localhost',
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
        });

        // This ensures that when the form is reopened, the initial effect will run and set values from existingItem
        handleClose();
    };

    // Add a useEffect to clear the opposing field when one is filled
    useEffect(() => {
        const piholeApiToken = formContext.watch('piholeApiToken');
        const piholePassword = formContext.watch('piholePassword');

        // If user starts typing API token, clear password
        if (piholeApiToken && piholePassword) {
            formContext.setValue('piholePassword', '');
        }
    }, [formContext.watch('piholeApiToken')]);

    useEffect(() => {
        const piholeApiToken = formContext.watch('piholeApiToken');
        const piholePassword = formContext.watch('piholePassword');

        // If user starts typing password, clear API token
        if (piholePassword && piholeApiToken) {
            formContext.setValue('piholeApiToken', '');
        }
    }, [formContext.watch('piholePassword')]);

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

                            {/* Torrent Client Selection Type */}
                            {selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.TORRENT_CLIENT && (
                                <Grid>
                                    <Box sx={{ mb: 2, mt: 1 }}>
                                        <Typography
                                            variant='body2'
                                            sx={{
                                                color: 'white',
                                                mb: 1,
                                                ml: 1
                                            }}
                                        >
                                            Select Torrent Client:
                                        </Typography>
                                        <RadioGroup
                                            name='torrentClientType'
                                            value={torrentClientType}
                                            onChange={(e) => {
                                                setTorrentClientType(e.target.value);
                                                formContext.setValue('torrentClientType', e.target.value);
                                            }}
                                            sx={{
                                                flexDirection: 'row',
                                                ml: 1,
                                                '& .MuiFormControlLabel-label': {
                                                    color: 'white'
                                                }
                                            }}
                                        >
                                            {TORRENT_CLIENT_OPTIONS.map((option) => (
                                                <FormControlLabel
                                                    key={option.id}
                                                    value={option.id}
                                                    control={
                                                        <Radio
                                                            sx={{
                                                                color: 'white',
                                                                '&.Mui-checked': {
                                                                    color: theme.palette.primary.main
                                                                }
                                                            }}
                                                        />
                                                    }
                                                    label={option.label}
                                                />
                                            ))}
                                        </RadioGroup>
                                    </Box>
                                </Grid>
                            )}

                            {/* Weather widget configuration */}
                            {selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.WEATHER_WIDGET && (
                                <>
                                    <Grid>
                                        <SelectElement
                                            label='Temperature Unit'
                                            name='temperatureUnit'
                                            options={TEMPERATURE_UNIT_OPTIONS}
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
                                                minWidth: isMobile ? '50vw' :'20vw',
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
                                    <Grid>
                                        <Autocomplete
                                            options={locationOptions}
                                            getOptionLabel={(option) => {
                                                // Handle both string and LocationOption types
                                                if (typeof option === 'string') {
                                                    return option;
                                                }
                                                return option.name;
                                            }}
                                            inputValue={locationSearch}
                                            onInputChange={(_, newValue) => {
                                                setLocationSearch(newValue);
                                            }}
                                            onChange={(_, newValue) => {
                                                // Handle both string and LocationOption types
                                                if (typeof newValue === 'string' || !newValue) {
                                                    setSelectedLocation(null);
                                                    formContext.setValue('location', null);
                                                } else {
                                                    setSelectedLocation(newValue);
                                                }
                                            }}
                                            loading={isSearching}
                                            loadingText='Searching...'
                                            noOptionsText={locationSearch.length < 2 ? 'Type to search...' : 'No locations found'}
                                            fullWidth
                                            isOptionEqualToValue={(option, value) => option.id === value.id}
                                            clearOnBlur={false}
                                            clearOnEscape
                                            value={selectedLocation}
                                            freeSolo
                                            clearIcon={<ClearIcon style={{ color: theme.palette.text.primary }} />}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label='Search location'
                                                    variant='outlined'
                                                    sx={{
                                                        width: '100%',
                                                        mt: 2,
                                                        mb: 2,
                                                        '& .MuiOutlinedInput-root': {
                                                            '& fieldset': {
                                                                borderColor: 'text.primary',
                                                            },
                                                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                        }
                                                    }}
                                                    InputLabelProps={{
                                                        style: { color: theme.palette.text.primary }
                                                    }}
                                                />
                                            )}
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* System Monitor widget configuration */}
                            {selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET && (
                                <>
                                    <Grid>
                                        <SelectElement
                                            label='Temperature Unit'
                                            name='temperatureUnit'
                                            options={TEMPERATURE_UNIT_OPTIONS}
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
                                                minWidth: isMobile ? '50vw' :'20vw',
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
                                    <Grid sx={{ width: '100%', mt: 2, mb: 1 }}>
                                        <Typography variant='body2' sx={{ color: 'white', mb: 1, ml: 1 }}>
                                            Select gauges to display:
                                        </Typography>
                                    </Grid>
                                    <Grid>
                                        <SelectElement
                                            label='Left Gauge'
                                            name='gauge1'
                                            options={SYSTEM_MONITOR_GAUGE_OPTIONS}
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
                                                minWidth: isMobile ? '50vw' :'20vw',
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
                                    <Grid>
                                        <SelectElement
                                            label='Middle Gauge'
                                            name='gauge2'
                                            options={SYSTEM_MONITOR_GAUGE_OPTIONS}
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
                                                minWidth: isMobile ? '50vw' :'20vw',
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
                                    <Grid>
                                        <SelectElement
                                            label='Right Gauge'
                                            name='gauge3'
                                            options={SYSTEM_MONITOR_GAUGE_OPTIONS}
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
                                                minWidth: isMobile ? '50vw' :'20vw',
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
                                    <Grid>
                                        {/* Network interface selection for System Monitor widget when network gauge is selected */}
                                        {selectedItemType === 'widget' &&
                                         selectedWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET &&
                                         (formContext.watch('gauge1') === 'network' ||
                                          formContext.watch('gauge2') === 'network' ||
                                          formContext.watch('gauge3') === 'network') && (
                                            <Grid>
                                                <SelectElement
                                                    label='Network Interface'
                                                    name='networkInterface'
                                                    options={networkInterfaces.length > 0 ? networkInterfaces : [{ id: '', label: 'No network interfaces available' }]}
                                                    required
                                                    fullWidth
                                                    disabled={networkInterfaces.length === 0}
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
                                                        minWidth: isMobile ? '50vw' :'20vw',
                                                        mt: 2,
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
                                    </Grid>
                                </>
                            )}

                            {/* Admin Only checkbox for widget types */}
                            {selectedItemType === 'widget' && selectedWidgetType && (
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
                                        checked={formContext.watch('adminOnly')}
                                        helperText='When checked, this item will only be visible to admin users'
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

                            {/* Torrent Client Common Configuration */}
                            {selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.TORRENT_CLIENT && (
                                <>
                                    <Grid>
                                        <TextFieldElement
                                            name='tcHost'
                                            label='Host'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='tcPort'
                                            label='Port'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='tcUsername'
                                            label='Username'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required={torrentClientType === TORRENT_CLIENT_TYPE.QBITTORRENT}
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='tcPassword'
                                            label='Password'
                                            type='password'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <CheckboxElement
                                            label='Use SSL'
                                            name='tcSsl'
                                            checked={formContext.watch('tcSsl')}
                                            sx={{
                                                ml: 1,
                                                color: 'white',
                                                '& .MuiSvgIcon-root': { fontSize: 30 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <CheckboxElement
                                            label='Show Name'
                                            name='showLabel'
                                            checked={formContext.watch('showLabel')}
                                            sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* Pi-hole widget configuration */}
                            {selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET && (
                                <>
                                    <Grid>
                                        <TextFieldElement
                                            name='piholeHost'
                                            label='Pi-hole Host'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='piholePort'
                                            label='Port'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='piholeName'
                                            label='Display Name'
                                            variant='outlined'
                                            placeholder='Pi-hole'
                                            fullWidth
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } }
                                            }}
                                        />
                                    </Grid>
                                    <Typography
                                        variant='body2'
                                        sx={{
                                            my: 1,
                                            color: 'white',
                                            fontWeight: 'medium',
                                            px: 1,
                                            width: '100%',
                                            textAlign: 'center'
                                        }}
                                    >
                                        Enter either an API Token (Pi-hole v5) OR a Password (Pi-hole v6)
                                    </Typography>
                                    <Grid>
                                        <TextFieldElement
                                            name='piholeApiToken'
                                            label='API Token (Pi-hole v5)'
                                            type='password'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required={!formContext.watch('piholePassword')}
                                            disabled={!!formContext.watch('piholePassword')}
                                            helperText={formContext.watch('piholePassword') ? 'Password already provided' : 'Enter the API token from Pi-hole Settings > API/Web interface'}
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } },
                                                formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='piholePassword'
                                            label='Password (Pi-hole v6)'
                                            type='password'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
                                            required={!formContext.watch('piholeApiToken')}
                                            disabled={!!formContext.watch('piholeApiToken')}
                                            helperText={formContext.watch('piholeApiToken') ? 'API Token already provided' : 'Enter your Pi-hole admin password'}
                                            sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: 'text.primary',
                                                    },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: { style: { color: theme.palette.text.primary } },
                                                formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <CheckboxElement
                                            label='Use SSL'
                                            name='piholeSsl'
                                            checked={formContext.watch('piholeSsl')}
                                            sx={{
                                                ml: 1,
                                                color: 'white',
                                                '& .MuiSvgIcon-root': { fontSize: 30 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <CheckboxElement
                                            label='Show Name'
                                            name='showLabel'
                                            checked={formContext.watch('showLabel')}
                                            sx={{
                                                ml: 1,
                                                color: 'white',
                                                '& .MuiSvgIcon-root': { fontSize: 30 }
                                            }}
                                        />
                                    </Grid>
                                </>
                            )}

                            {selectedItemType === ITEM_TYPE.APP_SHORTCUT &&
                            <>
                                <Grid>
                                    <TextFieldElement name='shortcutName' label='Shortcut Name' required variant='outlined' sx={{
                                        width: '100%',
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'text.primary',
                                            },
                                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                        },
                                    }}
                                    autoComplete='off'
                                    slotProps={{
                                        inputLabel:
                            { style: { color: theme.palette.text.primary } }
                                    }}
                                    />
                                </Grid>
                                <Grid>
                                    <CheckboxElement
                                        label='Wake-on-LAN'
                                        name='isWol'
                                        checked={formContext.watch('isWol')}
                                        helperText='Enable to create a Wake-on-LAN shortcut'
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

                                {!isWol && (
                                    <Grid>
                                        <TextFieldElement name='url' label='URL' required variant='outlined' sx={{
                                            width: '100%',
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: 'text.primary',
                                                },
                                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                            },
                                        }}
                                        rules={{
                                            validate: (value) =>
                                                value.includes('://') || 'Invalid url. Ex "http://192.168.x.x" or "unifi-network://"',
                                        }}
                                        autoComplete='off'
                                        slotProps={{
                                            inputLabel:
                                { style: { color: theme.palette.text.primary } },
                                            formHelperText: { sx: {
                                                whiteSpace: 'normal',
                                                maxWidth: '16vw',
                                            }, }
                                        }}
                                        />
                                    </Grid>
                                )}

                                {(isWol || editingWolShortcut) && (
                                    <>
                                        <Grid>
                                            <TextFieldElement
                                                name='macAddress'
                                                label='MAC Address'
                                                required
                                                variant='outlined'
                                                rules={{
                                                    pattern: {
                                                        value: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
                                                        message: 'Invalid MAC address format. Expected format: xx:xx:xx:xx:xx:xx or xx-xx-xx-xx-xx-xx'
                                                    }
                                                }}
                                                helperText='Format: xx:xx:xx:xx:xx:xx'
                                                sx={{
                                                    width: '100%',
                                                    '& .MuiOutlinedInput-root': {
                                                        '& fieldset': {
                                                            borderColor: 'text.primary',
                                                        },
                                                        '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                    },
                                                }}
                                                autoComplete='off'
                                                slotProps={{
                                                    inputLabel: { style: { color: theme.palette.text.primary } },
                                                    formHelperText: { sx: {
                                                        whiteSpace: 'normal',
                                                        maxWidth: '16vw',
                                                    } }
                                                }}
                                            />
                                        </Grid>
                                        <Grid>
                                            <TextFieldElement
                                                name='broadcastAddress'
                                                label='Broadcast Address (Optional)'
                                                variant='outlined'
                                                helperText='The broadcast address for your network'
                                                rules={{
                                                    pattern: {
                                                        value: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                                                        message: 'Invalid IP address format. Expected format: xxx.xxx.xxx.xxx'
                                                    }
                                                }}
                                                sx={{
                                                    width: '100%',
                                                    '& .MuiOutlinedInput-root': {
                                                        '& fieldset': {
                                                            borderColor: 'text.primary',
                                                        },
                                                        '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                    },
                                                }}
                                                autoComplete='off'
                                                slotProps={{
                                                    inputLabel: { style: { color: theme.palette.text.primary } },
                                                    formHelperText: { sx: {
                                                        whiteSpace: 'normal',
                                                        maxWidth: '16vw',
                                                    } }
                                                }}
                                            />
                                        </Grid>
                                        <Grid>
                                            <TextFieldElement
                                                name='port'
                                                label='Port (Optional)'
                                                variant='outlined'
                                                helperText='Default: 9'
                                                rules={{
                                                    pattern: {
                                                        value: /^[0-9]*$/,
                                                        message: 'Port must be a number'
                                                    }
                                                }}
                                                sx={{
                                                    width: '100%',
                                                    '& .MuiOutlinedInput-root': {
                                                        '& fieldset': {
                                                            borderColor: 'text.primary',
                                                        },
                                                        '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                                    },
                                                }}
                                                autoComplete='off'
                                                slotProps={{
                                                    inputLabel: { style: { color: theme.palette.text.primary } },
                                                    formHelperText: { sx: {
                                                        whiteSpace: 'normal',
                                                        maxWidth: '16vw',
                                                    } }
                                                }}
                                            />
                                        </Grid>
                                    </>
                                )}

                                <Grid>
                                    <IconSearch
                                        control={formContext.control}
                                        errors={errors}
                                        onCustomIconSelect={handleCustomIconSelect}
                                    />
                                </Grid>
                                <Grid>
                                    <CheckboxElement label='Show Name' name='showLabel' sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}/>
                                </Grid>
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
                                        checked={formContext.watch('adminOnly')}
                                        helperText='When checked, this item will only be visible to admin users'
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
                            }

                            {(selectedItemType === ITEM_TYPE.BLANK_WIDGET || selectedItemType === ITEM_TYPE.BLANK_ROW || selectedItemType === ITEM_TYPE.BLANK_APP) && (
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
                                        checked={formContext.watch('adminOnly')}
                                        helperText='When checked, this item will only be visible to admin users'
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
