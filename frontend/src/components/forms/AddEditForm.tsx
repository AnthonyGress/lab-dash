import { Box, Button, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, Typography, useMediaQuery } from '@mui/material';
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
    { id: ITEM_TYPE.BLANK_APP, label: 'Blank App' },
    { id: ITEM_TYPE.BLANK_WIDGET, label: 'Blank Widget' },
    { id: ITEM_TYPE.BLANK_ROW, label: 'Blank Row' },
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
    tcMaxDisplayedTorrents?: number;
    piholeHost?: string;
    piholePort?: string;
    piholeSsl?: boolean;
    piholeApiToken?: string;
};

export const AddEditForm = ({ handleClose, existingItem }: Props) => {
    const { formState: { errors } } = useForm();
    const { dashboardLayout, addItem, updateItem } = useAppContext();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [customIconFile, setCustomIconFile] = useState<File | null>(null);
    const [editingWolShortcut, setEditingWolShortcut] = useState(false);

    // Initialize client type from existing item or default to qBittorrent
    const [torrentClientType, setTorrentClientType] = useState<string>(
        existingItem?.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE
            ? TORRENT_CLIENT_TYPE.DELUGE
            : TORRENT_CLIENT_TYPE.QBITTORRENT
    );

    const formContext = useForm<FormValues>({
        defaultValues: {
            shortcutName: existingItem?.label || '',
            itemType: isWidgetType(existingItem?.type) ? 'widget' :
                (existingItem?.type === ITEM_TYPE.BLANK_WIDGET ||
                       existingItem?.type === ITEM_TYPE.BLANK_ROW) ? existingItem?.type : existingItem?.type || '',
            url: existingItem?.url || '',
            showLabel: undefined,
            icon: existingItem?.icon
                ? { path: existingItem.icon.path, name: existingItem.icon.name, source: existingItem.icon.source || '' }
                : null,
            widgetType: isWidgetType(existingItem?.type) ? existingItem?.type : '',
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
            tcMaxDisplayedTorrents: existingItem?.config?.maxDisplayedTorrents || 5,
            piholeHost: existingItem?.config?.piholeHost || existingItem?.config?.host || '',
            piholePort: existingItem?.config?.piholePort || existingItem?.config?.port || '',
            piholeSsl: existingItem?.config?.piholeSsl !== undefined ? existingItem?.config?.piholeSsl : existingItem?.config?.ssl || false,
            piholeApiToken: existingItem?.config?.piholeApiToken || existingItem?.config?.apiToken || '',
        }
    });

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
            if (formContext.getValues('showLabel') === undefined || (!existingItem && selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET)) {
                if (selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET) {
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
                temperatureUnit: data.temperatureUnit || 'fahrenheit'
            };
        } else if (data.itemType === 'widget' && data.widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
            // Encrypt the API token if needed
            let encryptedToken = data.piholeApiToken || '';

            if (encryptedToken && !isEncrypted(encryptedToken)) {
                try {
                    encryptedToken = await DashApi.encryptPiholeToken(encryptedToken);
                } catch (error) {
                    console.error('Error encrypting Pi-hole API token:', error);
                }
            }

            config = {
                host: data.piholeHost,
                port: data.piholePort,
                ssl: data.piholeSsl,
                apiToken: encryptedToken,
                refreshInterval: 10000, // 10 seconds default
                showLabel: data.showLabel
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
                maxDisplayedTorrents: data.tcMaxDisplayedTorrents,
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
            handleClose();
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    useEffect(() => {
        if (existingItem) {
            formContext.reset({
                shortcutName: existingItem.label || '',
                itemType: isWidgetType(existingItem.type) ? 'widget' :
                    (existingItem.type === ITEM_TYPE.BLANK_WIDGET ||
                           existingItem.type === ITEM_TYPE.BLANK_ROW) ? existingItem.type : existingItem.type || '',
                url: existingItem.url || '',
                showLabel: existingItem.type === ITEM_TYPE.PIHOLE_WIDGET ?
                    (existingItem.showLabel !== undefined ? existingItem.showLabel : true) :
                    (existingItem.showLabel !== undefined ? existingItem.showLabel : false),
                icon: existingItem.icon
                    ? { path: existingItem.icon.path, name: existingItem.icon.name, source: existingItem.icon.source || '' }
                    : null,
                widgetType: isWidgetType(existingItem.type) ? existingItem.type : '',
                torrentClientType: existingItem.config?.clientType || TORRENT_CLIENT_TYPE.QBITTORRENT,
                temperatureUnit: existingItem.config?.temperatureUnit || 'fahrenheit',
                adminOnly: existingItem.adminOnly || false,
                isWol: existingItem.config?.isWol || false,
                macAddress: existingItem.config?.macAddress || '',
                broadcastAddress: existingItem.config?.broadcastAddress || '',
                port: existingItem.config?.port || '',
                // Torrent client config
                tcHost: existingItem.config?.host || 'localhost',
                tcPort: existingItem.config?.port ||
                    (existingItem.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112' : '8080'),
                tcSsl: existingItem.config?.ssl || false,
                tcUsername: existingItem.config?.username || '',
                tcPassword: existingItem.config?.password || '',
                tcMaxDisplayedTorrents: existingItem.config?.maxDisplayedTorrents || 5,
                piholeHost: existingItem.config?.piholeHost || existingItem.config?.host || '',
                piholePort: existingItem.config?.piholePort || existingItem.config?.port || '',
                piholeSsl: existingItem.config?.piholeSsl !== undefined ? existingItem.config?.piholeSsl : existingItem.config?.ssl || false,
                piholeApiToken: existingItem.config?.piholeApiToken || existingItem.config?.apiToken || '',
            });
        }
    }, [existingItem, formContext]);

    return (
        <Grid
            container
            justifyContent='center'
            alignItems='center'
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
                    <FormContainer onSuccess={handleSubmit} formContext={formContext}>
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
                            )}

                            {/* Admin Only checkbox for widget types */}
                            {selectedItemType === 'widget' && selectedWidgetType && (
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
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
                                            sx={{
                                                ml: 1,
                                                color: 'white',
                                                '& .MuiSvgIcon-root': { fontSize: 30 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid>
                                        <TextFieldElement
                                            name='tcMaxDisplayedTorrents'
                                            label='Max Displayed Torrents'
                                            type='number'
                                            variant='outlined'
                                            fullWidth
                                            autoComplete='off'
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
                                        <CheckboxElement label='Show Name' name='showLabel' defaultChecked={false} sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}/>
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
                                            name='piholeApiToken'
                                            label='API Token'
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
                                            name='piholeSsl'
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
                                            defaultChecked={true}
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
                                    <CheckboxElement label='Show Name' name='showLabel' defaultChecked={false} sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 },  }}/>
                                </Grid>
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
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

                            {(selectedItemType === ITEM_TYPE.BLANK_WIDGET || selectedItemType === ITEM_TYPE.BLANK_ROW) && (
                                <Grid>
                                    <TextFieldElement name='shortcutName' label='Widget Name (Optional)' variant='outlined' sx={{
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
                            )}

                            {(selectedItemType === ITEM_TYPE.BLANK_WIDGET || selectedItemType === ITEM_TYPE.BLANK_ROW) && (
                                <Grid>
                                    <CheckboxElement
                                        label='Admin Only'
                                        name='adminOnly'
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
