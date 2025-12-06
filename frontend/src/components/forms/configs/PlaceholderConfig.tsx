import { Grid2 as Grid } from '@mui/material';
import { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface PlaceholderConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const PlaceholderConfig = ({ formContext }: PlaceholderConfigProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    // Memoize options to allow translation
    const PLACEHOLDER_SIZE_OPTIONS = useMemo(() => [
        { id: 'app', label: t('forms.addEdit.placeholderConfig.appShortcut') },
        { id: 'widget', label: t('forms.addEdit.placeholderConfig.widget') },
        { id: 'row', label: t('forms.addEdit.placeholderConfig.fullRow') },
    ], [t]);

    return (
        <>
            <Grid>
                <SelectElement
                    label={t('forms.addEdit.placeholderConfig.placeholderSize')}
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
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label={t('forms.addEdit.fields.adminOnly')}
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