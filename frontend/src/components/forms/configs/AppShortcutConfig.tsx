import { Grid2 as Grid } from '@mui/material';
import { useEffect, useState, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';
import { IconSearch } from '../IconSearch';

interface AppShortcutConfigProps {
    formContext: UseFormReturn<FormValues>;
    onCustomIconSelect: (file: File | null) => void;
}

export const AppShortcutConfig = ({ formContext, onCustomIconSelect }: AppShortcutConfigProps) => {
    const { t } = useTranslation();
    const [editingWolShortcut, setEditingWolShortcut] = useState(false);
    const [previousHealthUrl, setPreviousHealthUrl] = useState('');
    const [previousHealthCheckType, setPreviousHealthCheckType] = useState<'http' | 'ping'>('http');
    const isWol = formContext.watch('isWol', false);
    const healthUrl = formContext.watch('healthUrl', '');
    const healthCheckType = formContext.watch('healthCheckType', 'http') as 'http' | 'ping';

    // Memoize options to allow translation to update when language changes
    const healthCheckTypes = useMemo(() => [
        { id: 'http', label: t('forms.addEdit.healthCheck.http') },
        { id: 'ping', label: t('forms.addEdit.healthCheck.ping') }
    ], [t]);

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
                    label={t('forms.addEdit.fields.displayName')}
                    required
                    variant='outlined'
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
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label={t('widgets.common.wol.title') || 'Wake-on-LAN'} // Fallback string or add key to translations
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
                            label={t('forms.addEdit.fields.url')}
                            required={!healthUrl}
                            variant='outlined'
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
                            rules={{
                                required: {
                                    value: !healthUrl,
                                    message: t('forms.addEdit.validation.required')
                                },
                                validate: (value: any) => {
                                    // If health URL is provided, URL is optional
                                    if (healthUrl && (!value || value.trim() === '')) {
                                        return true;
                                    }

                                    // If there's a value, validate the URL format
                                    if (value && !value.includes('://')) {
                                        return t('forms.addEdit.validation.invalidUrlExample');
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
                            label={t('widgets.common.healthCheckType')}
                            name='healthCheckType'
                            options={healthCheckTypes}
                            sx={{
                                width: '100%',
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
                        <TextFieldElement
                            name='healthUrl'
                            label={healthCheckType === 'http' 
                                ? t('widgets.common.healthCheckUrl') 
                                : t('widgets.common.hostnameIp')
                            }
                            helperText={t('forms.addEdit.helpers.optional')}
                            variant='outlined'
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
                            rules={{
                                validate: (value) => {
                                    if (!value) return true;
                                    if (healthCheckType === 'http') {
                                        return value.includes('://') || t('forms.addEdit.validation.invalidUrlExample');
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
                            label={t('widgets.common.macAddress')}
                            required
                            variant='outlined'
                            rules={{
                                pattern: {
                                    value: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
                                    message: t('forms.addEdit.validation.invalidMac')
                                }
                            }}
                            helperText={t('forms.addEdit.helpers.macFormat')}
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
                            label={t('widgets.common.broadcastAddress')}
                            variant='outlined'
                            helperText={t('forms.addEdit.helpers.broadcastDesc')}
                            rules={{
                                pattern: {
                                    value: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                                    message: t('forms.addEdit.validation.invalidIp')
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
                            label={t('widgets.common.portOptional')}
                            variant='outlined'
                            helperText={t('forms.addEdit.helpers.defaultPort')}
                            rules={{
                                pattern: {
                                    value: /^[0-9]*$/,
                                    message: t('forms.addEdit.validation.portNumber')
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
                    errors={formContext.formState.errors}
                    onCustomIconSelect={onCustomIconSelect}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label={t('forms.addEdit.fields.showLabel')}
                    name='showLabel'
                    sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label={t('forms.addEdit.fields.adminOnly')}
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