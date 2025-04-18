import { Box, Button, Grid2 as Grid, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {  CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';


import { IconSearch } from './IconSearch';
import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { DashboardItem, Icon, ITEM_TYPE, NewItem } from '../../types';

type Props = {
    handleClose: () => void
    existingItem?: DashboardItem | null;

}

const ITEM_TYPE_OPTIONS = [
    { id: 'widget', label: 'Widget' },
    { id: ITEM_TYPE.APP_SHORTCUT, label: 'App' },
    { id: ITEM_TYPE.BLANK_APP, label: 'Blank App' },
    { id: ITEM_TYPE.BLANK_WIDGET, label: 'Blank Widget' },
    { id: ITEM_TYPE.BLANK_ROW, label: 'Blank Row' },
];

const WIDGET_OPTIONS = [{ id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' }, { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' }, { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' }];

const TEMPERATURE_UNIT_OPTIONS = [
    { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
    { id: 'celsius', label: 'Celsius (°C)' }
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
};

export const AddEditForm = ({ handleClose, existingItem }: Props) => {
    const { formState: { errors } } = useForm();
    const { dashboardLayout, addItem, updateItem } = useAppContext();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [customIconFile, setCustomIconFile] = useState<File | null>(null);
    const [editingWolShortcut, setEditingWolShortcut] = useState(false);

    const formContext = useForm<FormValues>({
        defaultValues: {
            shortcutName: existingItem?.label || '',
            itemType: isWidgetType(existingItem?.type) ? 'widget' : existingItem?.type || '',
            url: existingItem?.url || '',
            showLabel: existingItem?.showLabel,
            icon: existingItem?.icon
                ? { path: existingItem.icon.path, name: existingItem.icon.name, source: existingItem.icon.source || '' }
                : null,
            widgetType: isWidgetType(existingItem?.type) ? existingItem?.type : '',
            temperatureUnit: existingItem?.config?.temperatureUnit || 'fahrenheit',
            adminOnly: existingItem?.adminOnly || false,
            isWol: existingItem?.config?.isWol || false,
            macAddress: existingItem?.config?.macAddress || '',
            broadcastAddress: existingItem?.config?.broadcastAddress || '',
            port: existingItem?.config?.port || ''
        }
    });

    // Helper function to check if a type is a widget type
    function isWidgetType(type?: string): boolean {
        if (!type) return false;
        return [
            ITEM_TYPE.WEATHER_WIDGET,
            ITEM_TYPE.DATE_TIME_WIDGET,
            ITEM_TYPE.SYSTEM_MONITOR_WIDGET
        ].includes(type as ITEM_TYPE);
    }

    const selectedItemType = formContext.watch('itemType');
    const selectedWidgetType = formContext.watch('widgetType');
    const isWol = formContext.watch('isWol', false);

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
                itemType: isWidgetType(existingItem.type) ? 'widget' : existingItem.type || '',
                url: existingItem.url || '',
                showLabel: existingItem.showLabel,
                icon: existingItem.icon
                    ? { path: existingItem.icon.path, name: existingItem.icon.name, source: existingItem.icon.source || '' }
                    : null,
                widgetType: isWidgetType(existingItem.type) ? existingItem.type : '',
                temperatureUnit: existingItem.config?.temperatureUnit || 'fahrenheit',
                adminOnly: existingItem.adminOnly || false,
                isWol: existingItem.config?.isWol || false,
                macAddress: existingItem.config?.macAddress || '',
                broadcastAddress: existingItem.config?.broadcastAddress || '',
                port: existingItem.config?.port || ''
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
                                    minWidth: isMobile ? '65vw' :'20vw'
                                }}
                                slotProps={{
                                    inputLabel:
                                        { style: { color: theme.palette.text.primary } }
                                }}
                                />
                            </Grid>

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
                                    <CheckboxElement label='Show Name' name='showLabel' sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 },  }}/>
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
                            {
                                selectedItemType === 'widget' &&
                                <Grid>
                                    <SelectElement label='Widget' name='widgetType' options={WIDGET_OPTIONS} required fullWidth sx={{
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
                                        minWidth: isMobile ? '50vw' :'20vw'
                                    }}
                                    slotProps={{
                                        inputLabel:
                                        { style: { color: theme.palette.text.primary } }
                                    }}
                                    />
                                </Grid>
                            }

                            {/* Temperature Unit Selection for Weather Widget */}
                            {selectedItemType === 'widget' && formContext.watch('widgetType') === ITEM_TYPE.WEATHER_WIDGET && (
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
                                            minWidth: isMobile ? '50vw' :'20vw'
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

                            <Button variant='contained' type='submit' sx={{ minHeight: '3rem' }}>{existingItem ? 'Update' : 'Add'}</Button>
                        </Grid>
                    </FormContainer>
                </Box>
            </Grid>
        </Grid>
    );
};
