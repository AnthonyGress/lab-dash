import { Grid2 as Grid } from '@mui/material';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

const REFRESH_INTERVAL_OPTIONS = [
    { id: 10000, label: '10 seconds' },
    { id: 30000, label: '30 seconds' },
    { id: 60000, label: '1 minute' },
    { id: 300000, label: '5 minutes' }
];

interface NetworkInfoWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const NetworkInfoWidgetConfig = ({ formContext }: NetworkInfoWidgetConfigProps) => {
    const isMobile = useIsMobile();

    // Initialize default values
    useEffect(() => {
        const currentTargetHost = formContext.getValues('targetHost');
        const currentRefreshInterval = formContext.getValues('refreshInterval');
        const currentShowLabel = formContext.getValues('showLabel');
        const currentShowTargetHost = formContext.getValues('showTargetHost');

        if (!currentTargetHost) {
            formContext.setValue('targetHost', '8.8.8.8');
        }
        if (!currentRefreshInterval) {
            formContext.setValue('refreshInterval', 30000);
        }
        if (currentShowLabel === undefined) {
            formContext.setValue('showLabel', true);
        }
        if (currentShowTargetHost === undefined) {
            formContext.setValue('showTargetHost', true);
        }
    }, [formContext]);

    const inputStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
        },
        width: '100%',
        minWidth: isMobile ? '65vw' : '20vw',
    };

    const selectStyling = {
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
        minWidth: isMobile ? '65vw' : '20vw',
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
    };

    return (
        <Grid container spacing={2} direction='column'>
            <Grid>
                <TextFieldElement
                    label='Target Host'
                    name='targetHost'
                    required
                    fullWidth
                    helperText='Hostname or IP address to ping (e.g., google.com, 8.8.8.8)'
                    sx={inputStyling}
                />
            </Grid>

            <Grid>
                <SelectElement
                    label='Refresh Interval'
                    name='refreshInterval'
                    options={REFRESH_INTERVAL_OPTIONS}
                    required
                    fullWidth
                    sx={selectStyling}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    label='Display Name'
                    name='displayName'
                    fullWidth
                    helperText='Custom name for the widget header (optional)'
                    sx={inputStyling}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show Label'
                    name='showLabel'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show Target Host'
                    name='showTargetHost'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>
        </Grid>
    );
};
