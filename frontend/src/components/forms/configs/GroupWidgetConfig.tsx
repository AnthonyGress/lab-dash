import { Grid2 as Grid, Typography } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface GroupWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

const MAX_ITEMS_OPTIONS = [
    { id: '3', label: '3 Items (3x1)' },
    { id: '6_2x3', label: '6 Items (2x3)' },
    { id: '6_3x2', label: '6 Items (3x2)' },
    { id: '8_4x2', label: '8 Items (4x2)' }
];

export const GroupWidgetConfig = ({ formContext }: GroupWidgetConfigProps) => {
    return (
        <>
            <Grid>
                <TextFieldElement
                    name='shortcutName'
                    label='Group Name'
                    required
                    fullWidth
                    rules={{
                        required: 'Title is required'
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                        '& .MuiFormLabel-root': {
                            color: 'text.primary',
                        },
                    }}
                />
            </Grid>

            <Grid container spacing={2} alignItems='center'>
                <Grid size={{ xs: 12, sm: 12, md: 12 }}>
                    <SelectElement
                        name='maxItems'
                        label='Layout'
                        options={MAX_ITEMS_OPTIONS}
                        defaultValue='3'
                        fullWidth
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                                '.MuiSvgIcon-root ': {
                                    fill: theme.palette.text.primary,
                                },
                            },
                            '& .MuiFormLabel-root': {
                                color: 'text.primary',
                            },
                        }}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 12, md: 12 }}>
                    <CheckboxElement
                        label='Show Name'
                        name='showLabel'
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
            </Grid>
        </>
    );
};
