import { Grid2 as Grid } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { FormValues } from '../AddEditForm';

interface NotesWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const NotesWidgetConfig = ({ formContext }: NotesWidgetConfigProps) => {
    return (
        <Grid container spacing={2}>
            <Grid xs={12}>
                <TextFieldElement
                    name='displayName'
                    label='Widget Title'
                    placeholder='Notes'
                    fullWidth
                    sx={{
                        '& .MuiInputLabel-root': {
                            color: 'white',
                        },
                        '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': {
                                borderColor: 'rgba(255, 255, 255, 0.23)',
                            },
                            '&:hover fieldset': {
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: 'primary.main',
                            },
                        },
                    }}
                />
            </Grid>
            <Grid xs={12}>
                <CheckboxElement
                    label='Show Widget Label'
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
    );
};
