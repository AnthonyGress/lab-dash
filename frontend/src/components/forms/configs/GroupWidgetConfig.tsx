import { Grid2 as Grid } from '@mui/material';
import { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';

import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface GroupWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const GroupWidgetConfig = ({ formContext }: GroupWidgetConfigProps) => {
    const { t } = useTranslation();

    const maxItemsOptions = useMemo(() => [
        { id: '3', label: t('widgets.group.config.items3') },
        { id: '6_2x3', label: t('widgets.group.config.items6_2x3') },
        { id: '6_3x2', label: t('widgets.group.config.items6_3x2') },
        { id: '8_4x2', label: t('widgets.group.config.items8_4x2') }
    ], [t]);

    return (
        <>
            <Grid>
                <TextFieldElement
                    name='shortcutName'
                    label={t('widgets.group.config.groupName')}
                    required
                    fullWidth
                    rules={{
                        required: t('widgets.group.config.nameRequired')
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
                        label={t('widgets.group.config.layout')}
                        options={maxItemsOptions}
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
                        label={t('widgets.group.config.showName')}
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