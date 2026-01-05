import { Grid2 as Grid } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';
import { IconSearch } from '../IconSearch';

const HEALTH_CHECK_TYPES = [
    { id: 'http', label: 'HTTP Request' },
    { id: 'ping', label: 'Ping Host' }
];

interface AppShortcutConfigProps {
    formContext: UseFormReturn<FormValues>;
    onCustomIconSelect: (file: File | null) => void;
}

export const AppShortcutConfig = ({ formContext, onCustomIconSelect }: AppShortcutConfigProps) => {
    const [editingWolShortcut, setEditingWolShortcut] = useState(false);
    const [previousHealthUrl, setPreviousHealthUrl] = useState('');
    const [previousHealthCheckType, setPreviousHealthCheckType] = useState<'http' | 'ping'>('http');
    const isWol = formContext.watch('isWol', false);
    const healthUrl = formContext.watch('healthUrl', '');
    const healthCheckType = formContext.watch('healthCheckType', 'http') as 'http' | 'ping';

    // Clear URL validation errors when health URL is provided
    useEffect(() => {
        if (healthUrl && formContext.formState.errors.url) {
            formContext.clearErrors('url');

            // If URL field is empty, set it to empty string to avoid required validation
            if (!formContext.getValues('url')) {
                formContext.setValue('url', '');
            }
        }
    }, [healthUrl, formContext]);

    // Initialize WOL editing state when the component mounts or isWol changes
    useEffect(() => {
        setEditingWolShortcut(isWol || false);
    }, [isWol]);

    // Update URL field validation requirements whenever health URL changes
    useEffect(() => {
        const currentUrl = formContext.getValues('url');
        if (healthUrl && !currentUrl) {
            // If health URL is filled but URL is empty, clear the URL field validation errors
            formContext.clearErrors('url');
        }
    }, [healthUrl, formContext]);

    // When switching to WOL mode, save the health URL and type
    useEffect(() => {
        if (isWol) {
            // When switching to WOL mode, store current health URL and type
            setPreviousHealthUrl(healthUrl || '');
            setPreviousHealthCheckType(healthCheckType);
            // Clear the health URL and type in the form
            formContext.setValue('healthUrl', '');
            formContext.setValue('healthCheckType', 'http' as 'http' | 'ping');
        } else if (editingWolShortcut && !isWol) {
            // When switching back from WOL mode, restore previous health URL and type
            formContext.setValue('healthUrl', previousHealthUrl);
            formContext.setValue('healthCheckType', previousHealthCheckType);
        }
    }, [isWol, editingWolShortcut, healthUrl, healthCheckType, formContext, previousHealthUrl, previousHealthCheckType]);

    return (
        <>
            <Grid>
                <TextFieldElement
                    name='shortcutName'
                    label='Shortcut Name'
                    required
                    variant='outlined'
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    autoComplete='off'
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Wake-on-LAN'
                    name='isWol'
                    checked={formContext.watch('isWol')}

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
                <>
                    <Grid>
                        <TextFieldElement
                            name='url'
                            label='URL'
                            required={!healthUrl}
                            variant='outlined'
                            sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'text.primary',
                                    },
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                                },
                            }}
                            rules={{
                                required: {
                                    value: !healthUrl,
                                    message: 'This field is required'
                                },
                                validate: (value: any) => {
                                    // If health URL is provided, URL is optional
                                    if (healthUrl && (!value || value.trim() === '')) {
                                        return true;
                                    }

                                    // If there's a value, validate the URL format
                                    if (value && !value.includes('://')) {
                                        return 'Invalid url. Ex "http://192.168.x.x" or "unifi-network://"';
                                    }

                                    return true;
                                }
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
                        <SelectElement
                            label='Health Check Type'
                            name='healthCheckType'
                            options={HEALTH_CHECK_TYPES}
                            sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'text.primary',
                                    },
                                    '.MuiSvgIcon-root ': {
                                        fill: theme.palette.text.primary,
                                    },
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                                },
                                '& .MuiMenuItem-root:hover': {
                                    backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                                },
                                '& .MuiMenuItem-root.Mui-selected': {
                                    backgroundColor: `${'primary.main'} !important`,
                                    color: 'white',
                                },
                                '& .MuiMenuItem-root.Mui-selected:hover': {
                                    backgroundColor: `${'primary.main'} !important`,
                                    color: 'white',
                                }
                            }}
                            slotProps={{
                                inputLabel: { style: { color: theme.palette.text.primary } }
                            }}
                        />
                    </Grid>
                    <Grid>
                        <TextFieldElement
                            name='healthUrl'
                            label={healthCheckType === 'http' ? 'Health Check URL' : 'Hostname or IP Address'}
                            helperText={'Optional'}
                            variant='outlined'
                            sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'text.primary',
                                    },
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                                },
                            }}
                            rules={{
                                validate: (value) => {
                                    if (!value) return true;
                                    if (healthCheckType === 'http') {
                                        return value.includes('://') || 'Invalid URL. Ex: "http://192.168.x.x/health"';
                                    }
                                    return true; // No validation for ping hostnames
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
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
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
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
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
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
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
                    errors={formContext.formState.errors}
                    onCustomIconSelect={onCustomIconSelect}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Show Name'
                    name='showLabel'
                    sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}
                />
            </Grid>
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
    );
};
