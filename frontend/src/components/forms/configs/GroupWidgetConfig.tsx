import { Grid2 as Grid, Typography } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { FormValues } from '../AddEditForm';

interface GroupWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const GroupWidgetConfig = ({ formContext }: GroupWidgetConfigProps) => {
    return (
        <>
            <Grid>
                <TextFieldElement
                    name='shortcutName'
                    label='Group Title'
                    required
                    fullWidth
                    parse={(value) => value?.trim()}
                    validation={{
                        required: 'Title is required'
                    }}
                    sx={{
                        pb: 2,
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

            <Grid>
                <Typography variant='body2' sx={{ mb: 1, mt: 1 }}>
                    Group Options
                </Typography>
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show Label'
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
        </>
    );
};
