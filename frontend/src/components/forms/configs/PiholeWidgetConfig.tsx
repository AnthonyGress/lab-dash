import { Grid2 as Grid, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';


interface PiholeWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    existingItem?: any; // Pass existing item to check for security flags
}

const MASKED_VALUE = '**********'; // 10 asterisks for masked values

export const PiholeWidgetConfig = ({ formContext, existingItem }: PiholeWidgetConfigProps) => {
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
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
        },
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
    const handleApiTokenChange = (value: string) => {


        if (value && value !== MASKED_VALUE) {
            formContext.setValue('piholePassword', '');
        }
    };

    // Handle password changes
    const handlePasswordChange = (value: string) => {

        // Clear API token if password is being set
        if (value && value !== MASKED_VALUE) {
            formContext.setValue('piholeApiToken', '');
        }
    };

    // Watch for form value changes
    useEffect(() => {
        const subscription = formContext.watch((value, { name }) => {
            if (name === 'piholeApiToken') {
                handleApiTokenChange(value.piholeApiToken || '');
            } else if (name === 'piholePassword') {
                handlePasswordChange(value.piholePassword || '');
            }
        });

        return () => subscription.unsubscribe();
    }, [formContext, hasExistingApiToken, hasExistingPassword]);

    // Mutual exclusivity effect for new values
    useEffect(() => {
        const piholeApiToken = formContext.watch('piholeApiToken');
        const piholePassword = formContext.watch('piholePassword');

        // Only enforce mutual exclusivity for non-masked values
        if (piholeApiToken && piholeApiToken !== MASKED_VALUE && piholePassword && piholePassword !== MASKED_VALUE) {
            formContext.setValue('piholePassword', '');
        }
    }, [formContext.watch('piholeApiToken')]);

    useEffect(() => {
        const piholeApiToken = formContext.watch('piholeApiToken');
        const piholePassword = formContext.watch('piholePassword');

        // Only enforce mutual exclusivity for non-masked values
        if (piholePassword && piholePassword !== MASKED_VALUE && piholeApiToken && piholeApiToken !== MASKED_VALUE) {
            formContext.setValue('piholeApiToken', '');
        }
    }, [formContext.watch('piholePassword')]);

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
        if (password && password !== MASKED_VALUE) {
            return 'Password already provided';
        }
        return 'Enter the API token from Pi-hole Settings > API/Web interface';
    };

    const getPasswordHelperText = () => {
        const apiToken = formContext.watch('piholeApiToken');
        if (apiToken && apiToken !== MASKED_VALUE) {
            return 'API Token already provided';
        }
        return 'Enter your Pi-hole admin password';
    };

    return (
        <>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='piholeHost'
                    label='Pi-hole Host'
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
                    label='Port'
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
                    label='Display Name'
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
                <TextFieldElement
                    name='piholeApiToken'
                    label='API Token (Pi-hole v5)'
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={isApiTokenRequired()}
                    disabled={isApiTokenDisabled()}
                    helperText={getApiTokenHelperText()}
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='piholePassword'
                    label='Password (Pi-hole v6)'
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={isPasswordRequired()}
                    disabled={isPasswordDisabled()}
                    helperText={getPasswordHelperText()}
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%' }}>
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
            <Grid sx={{ width: '100%' }}>
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
    );
};
