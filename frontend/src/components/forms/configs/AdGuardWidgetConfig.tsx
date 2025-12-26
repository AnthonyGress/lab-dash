import { Grid2 as Grid } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface AdGuardWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    existingItem?: any; // Pass existing item to check for security flags
}

const MASKED_VALUE = '**********'; // 10 asterisks for masked values

export const AdGuardWidgetConfig = ({ formContext, existingItem }: AdGuardWidgetConfigProps) => {
    const isMobile = useIsMobile();

    // Track if we're editing an existing item with sensitive data
    const [hasExistingUsername, setHasExistingUsername] = useState(false);
    const [hasExistingPassword, setHasExistingPassword] = useState(false);

    const textFieldSx = {
        width: '100%',
        minWidth: isMobile ? '65vw' : '20vw',
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
        },
    };

    // Initialize masked values for existing items
    useEffect(() => {
        if (existingItem?.config) {
            const config = existingItem.config;

            // Check if existing item has sensitive data using security flags
            if (config._hasUsername) {
                setHasExistingUsername(true);
                // Set masked value in form if not already set
                if (!formContext.getValues('adguardUsername')) {
                    formContext.setValue('adguardUsername', MASKED_VALUE);
                }
            }

            if (config._hasPassword) {
                setHasExistingPassword(true);
                // Set masked value in form if not already set
                if (!formContext.getValues('adguardPassword')) {
                    formContext.setValue('adguardPassword', MASKED_VALUE);
                }
            }
        }
    }, [existingItem, formContext]);

    // Helper function to determine if field should be required
    const isUsernameRequired = () => {
        const password = formContext.watch('adguardPassword');
        // Username is required if password is provided (both are needed for Basic Auth)
        return Boolean(password && password !== MASKED_VALUE) || hasExistingPassword;
    };

    const isPasswordRequired = () => {
        const username = formContext.watch('adguardUsername');
        // Password is required if username is provided (both are needed for Basic Auth)
        return Boolean(username && username !== MASKED_VALUE) || hasExistingUsername;
    };

    return (
        <>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='adguardHost'
                    label='AdGuard Home Host'
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
                    name='adguardPort'
                    label='Port'
                    variant='outlined'
                    placeholder='3000'
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
                    name='adguardName'
                    label='Display Name'
                    variant='outlined'
                    placeholder='AdGuard Home'
                    fullWidth
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='adguardUsername'
                    label='Username'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={isUsernameRequired()}
                    helperText='Enter your AdGuard Home admin username'
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%', mb: 2 }}>
                <TextFieldElement
                    name='adguardPassword'
                    label='Password'
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={isPasswordRequired()}
                    helperText='Enter your AdGuard Home admin password'
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
                    name='adguardSsl'
                    checked={formContext.watch('adguardSsl')}
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
