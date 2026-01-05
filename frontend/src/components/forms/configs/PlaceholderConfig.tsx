import { Grid2 as Grid } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface PlaceholderConfigProps {
    formContext: UseFormReturn<FormValues>;
}

const PLACEHOLDER_SIZE_OPTIONS = [
    { id: 'app', label: 'App Shortcut' },
    { id: 'widget', label: 'Widget' },
    { id: 'row', label: 'Full Row' },
];

export const PlaceholderConfig = ({ formContext }: PlaceholderConfigProps) => {
    const isMobile = useIsMobile();

    return (
        <>
            <Grid>
                <SelectElement
                    label='Placeholder Size'
                    name='placeholderSize'
                    options={PLACEHOLDER_SIZE_OPTIONS}
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
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                        width: '100%',
                        minWidth: isMobile ? '65vw' : '20vw',
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
