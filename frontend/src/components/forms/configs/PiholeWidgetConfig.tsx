import { Grid2 as Grid } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement, TextField } from 'react-hook-form-mui'; // Added TextField import (though we use standard MUI TextField for logic, keeping consistent imports)
import { TextField as MuiTextField } from '@mui/material'; // Import MuiTextField explicitly for controlled inputs
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';


interface PiholeWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    existingItem?: any; // Pass existing item to check for security flags
}

const MASKED_VALUE = '**********'; // 10 asterisks for masked values

export const PiholeWidgetConfig = ({ formContext, existingItem }: PiholeWidgetConfigProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    // Track if we're editing an existing item with sensitive data
    const [hasExistingApiToken, setHasExistingApiToken] = useState(false);
    const [hasExistingPassword, setHasExistingPassword] = useState(false);

    const textFieldSx = {
        width: '100%',
        minWidth: isMobile ? '65vw' : '20vw',
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
        },
        '& .MuiFormHelperText-root': {
            color: 'rgba(255, 255, 255, 0.7)'
        }
    };

    // Initialize masked values for existing items
    useEffect(() => {
        if (existingItem?.config) {
            const config = existingItem.config;

            // Check if existing item has sensitive data using security flags
            if (config._hasApiToken) {
                setHasExistingApiToken(true);
                // Set masked value in form if not already set
                if (!formContext.getValues('piholeApiToken')) {
                    formContext.setValue('piholeApiToken', MASKED_VALUE);
                }
            }

            if (config._hasPassword) {
                setHasExistingPassword(true);
                // Set masked value in form if not already set
                if (!formContext.getValues('piholePassword')) {
                    formContext.setValue('piholePassword', MASKED_VALUE);
                }
            }
        }
    }, [existingItem, formContext]);

    // Handle API token changes
    const handleApiTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        formContext.setValue('piholeApiToken', value, { shouldValidate: true, shouldDirty: true });
        
        if (value && value !== MASKED_VALUE) {
            formContext.setValue('piholePassword', '');
        }
    };

    // Handle password changes
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        formContext.setValue('piholePassword', value, { shouldValidate: true, shouldDirty: true });

        // Clear API token if password is being set
        if (value && value !== MASKED_VALUE) {
            formContext.setValue('piholeApiToken', '');
        }
    };

    // Helper function to determine if field should be required
    const isApiTokenRequired = () => {
        const password = formContext.watch('piholePassword');
        // API token is required only if there's no password AND no existing password (not masked)
        // If password is masked, it means there's an existing password, so API token is not required
        return !password && !hasExistingPassword;
    };

    const isPasswordRequired = () => {
        const apiToken = formContext.watch('piholeApiToken');
        // Password is required only if there's no API token AND no existing API token (not masked)
        // If API token is masked, it means there's an existing API token, so password is not required
        return !apiToken && !hasExistingApiToken;
    };

    // Helper function to determine if field should be disabled
    const isApiTokenDisabled = () => {
        const password = formContext.watch('piholePassword');
        // API token is disabled if password has a real (non-masked) value
        return Boolean(password && password !== MASKED_VALUE);
    };

    const isPasswordDisabled = () => {
        const apiToken = formContext.watch('piholeApiToken');
        // Password is disabled if API token has a real (non-masked) value
        return Boolean(apiToken && apiToken !== MASKED_VALUE);
    };

    // Helper function to get helper text
    const getApiTokenHelperText = () => {
        const password = formContext.watch('piholePassword');
        const apiToken = formContext.watch('piholeApiToken');

        if (password && password !== MASKED_VALUE) {
            return t('widgets.pihole.config.passwordProvided');
        }
        
        if (hasExistingApiToken && apiToken === MASKED_VALUE) {
            return t('widgets.pihole.config.tokenSet');
        }
        
        if (!apiToken && !password && !hasExistingApiToken && !hasExistingPassword) {
            return t('widgets.pihole.config.tokenOrPassword');
        }

        return t('widgets.pihole.config.tokenHelper');
    };

    const getPasswordHelperText = () => {
        const apiToken = formContext.watch('piholeApiToken');
        const password = formContext.watch('piholePassword');

        if (apiToken && apiToken !== MASKED_VALUE) {
            return t('widgets.pihole.config.tokenProvided');
        }

        if (hasExistingPassword && password === MASKED_VALUE) {
            return t('widgets.pihole.config.passwordSet');
        }

        if (!apiToken && !password && !hasExistingApiToken && !hasExistingPassword) {
            return t('widgets.pihole.config.passwordOrToken');
        }

        return t('widgets.pihole.config.passwordHelper');
    };

    return (
        <>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='piholeHost'
                    label={t('widgets.pihole.config.host')}
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='piholePort'
                    label={t('forms.addEdit.fields.port')}
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='piholeName'
                    label={t('forms.addEdit.fields.displayName')}
                    variant='outlined'
                    placeholder='Pi-hole'
                    fullWidth
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                {/* Use controlled MuiTextField for better control over value changes */}
                <MuiTextField
                    name='piholeApiToken'
                    label={t('widgets.pihole.config.apiTokenV5')}
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={isApiTokenRequired()}
                    disabled={isApiTokenDisabled()}
                    value={formContext.watch('piholeApiToken') || ''}
                    onChange={handleApiTokenChange}
                    helperText={getApiTokenHelperText()}
                    error={isApiTokenRequired() && !formContext.watch('piholeApiToken')}
                    sx={textFieldSx}
                    InputLabelProps={{
                        style: { color: theme.palette.text.primary }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <MuiTextField
                    name='piholePassword'
                    label={t('widgets.pihole.config.passwordV6')}
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={isPasswordRequired()}
                    disabled={isPasswordDisabled()}
                    value={formContext.watch('piholePassword') || ''}
                    onChange={handlePasswordChange}
                    helperText={getPasswordHelperText()}
                    error={isPasswordRequired() && !formContext.watch('piholePassword')}
                    sx={textFieldSx}
                    InputLabelProps={{
                        style: { color: theme.palette.text.primary }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%' }}>
                <CheckboxElement
                    label={t('forms.addEdit.fields.useSsl')}
                    name='piholeSsl'
                    checked={formContext.watch('piholeSsl')}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%' }}>
                <CheckboxElement
                    label={t('forms.addEdit.fields.showLabel')}
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
    );
};