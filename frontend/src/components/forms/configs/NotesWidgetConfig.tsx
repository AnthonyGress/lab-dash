import { Grid2 as Grid } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';

import { FONT_SIZE_SELECT_OPTIONS } from '../../../constants/font-sizes';
import { FormValues } from '../AddEditForm/types';

interface NotesWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const NotesWidgetConfig = ({ formContext }: NotesWidgetConfigProps) => {
    const { t } = useTranslation();

    return (
        <Grid container spacing={2} direction='column'>
            <Grid>
                <TextFieldElement
                    name='displayName'
                    label={t('widgets.notes.config.displayName')}
                    placeholder={t('widgets.titles.notes')}
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
            <Grid>
                <SelectElement
                    name='defaultNoteFontSize'
                    label={t('widgets.notes.config.defaultFontSize')}
                    options={FONT_SIZE_SELECT_OPTIONS}
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
                        '& .MuiSelect-icon': {
                            color: 'white',
                        },
                        '& .MuiMenuItem-root': {
                            color: 'black',
                        },
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label={t('widgets.notes.config.showLabel')}
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