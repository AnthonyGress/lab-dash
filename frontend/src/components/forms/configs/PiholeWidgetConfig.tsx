import { Grid2 as Grid, Typography } from '@mui/material';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm';

interface PiholeWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const PiholeWidgetConfig = ({ formContext }: PiholeWidgetConfigProps) => {
    const textFieldSx = {
        width: '100%',
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
        },
    };

    useEffect(() => {
        const piholeApiToken = formContext.watch('piholeApiToken');
        const piholePassword = formContext.watch('piholePassword');

        if (piholeApiToken && piholePassword) {
            formContext.setValue('piholePassword', '');
        }
    }, [formContext.watch('piholeApiToken')]);

    useEffect(() => {
        const piholeApiToken = formContext.watch('piholeApiToken');
        const piholePassword = formContext.watch('piholePassword');

        if (piholePassword && piholeApiToken) {
            formContext.setValue('piholeApiToken', '');
        }
    }, [formContext.watch('piholePassword')]);

    return (
        <>
            <Grid sx={{ width: '100%' }}>
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
            <Grid sx={{ width: '100%' }}>
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
            <Grid sx={{ width: '100%' }}>
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
            <Grid sx={{ width: '100%' }}>
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
                    sx={textFieldSx}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                    }}
                />
            </Grid>
            <Grid sx={{ width: '100%' }}>
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
