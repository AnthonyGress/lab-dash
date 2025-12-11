import { Box, Grid2 as Grid, Typography } from '@mui/material';
import { Dispatch, SetStateAction } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next'; // Import hook

import { ITEM_TYPE_OPTIONS } from './constants';
import { FormValues } from './types';
import { COLORS } from '../../../theme/styles';
import { ITEM_TYPE } from '../../../types'; // Import types for matching

type Props = {
    formContext: UseFormReturn<FormValues>
    setCurrentStep: Dispatch<SetStateAction<'select' | 'widget-select' | 'configure'>>;
}

export const ItemTypeSelector = ({ formContext, setCurrentStep }: Props) => {
    const { t } = useTranslation(); // Initialize hook

    const handleItemTypeSelect = (itemTypeId: string) => {
        formContext.setValue('itemType', itemTypeId);
        if (itemTypeId === 'widget') {
            setCurrentStep('widget-select');
        } else {
            setCurrentStep('configure');
        }
    };

    // Helper to get translation keys based on item ID
    const getItemTranslation = (id: string) => {
        switch (id) {
            case ITEM_TYPE.APP_SHORTCUT:
                return { label: t('forms.addEdit.types.shortcut'), desc: t('forms.addEdit.types.shortcutDesc') };
            case 'widget':
                return { label: t('forms.addEdit.types.widget'), desc: t('forms.addEdit.types.widgetDesc') };
            case ITEM_TYPE.PLACEHOLDER:
                return { label: t('forms.addEdit.types.placeholder'), desc: t('forms.addEdit.types.placeholderDesc') };
            case ITEM_TYPE.PAGE:
                return { label: t('forms.addEdit.types.page'), desc: t('forms.addEdit.types.pageDesc') };
            default:
                return { label: '', desc: '' };
        }
    };

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant='body2' sx={{ color: 'text.primary', mb: 2, fontSize: '0.875rem' }}>
                {t('forms.addEdit.selectType')} {/* Translated label */}
            </Typography>
            <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
                {ITEM_TYPE_OPTIONS.map((option) => {
                    const IconComponent = option.icon;
                    const { label, desc } = getItemTranslation(option.id); // Get translated text

                    return (
                        <Grid
                            key={option.id}
                            size={{ xs: 6, sm: 6, md: 3 }}
                        >
                            <Box
                                onClick={() => handleItemTypeSelect(option.id)}
                                sx={{
                                    py: 2.5,
                                    px: .25,
                                    height: { xs: '180px', sm: '160px' },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    backgroundColor: COLORS.GRAY,
                                    borderRadius: '8px',
                                    border: `1px solid ${COLORS.LIGHT_GRAY_TRANSPARENT}`,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.2s ease',
                                    // Hover effects for mouse users
                                    '@media (pointer: fine)': {
                                        '&:hover': {
                                            backgroundColor: COLORS.LIGHT_GRAY_HOVER,
                                            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                                        },
                                    },
                                }}
                            >
                                <IconComponent
                                    sx={{
                                        fontSize: 36,
                                        color: 'text.primary',
                                        mb: 1
                                    }}
                                />
                                <Box sx={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography
                                        variant='subtitle2'
                                        sx={{
                                            color: 'text.primary',
                                            fontWeight: 600,
                                            mb: 0.5,
                                            lineHeight: 1.2
                                        }}
                                    >
                                        {label || option.label} {/* Use translation or fallback */}
                                    </Typography>
                                    <Typography
                                        variant='caption'
                                        sx={{
                                            fontSize: '0.7rem',
                                            lineHeight: 1.1,
                                            px: 0.5,
                                            display: '-webkit-box',
                                            WebkitLineClamp: { xs: 4, sm: 3 },
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {desc || option.description} {/* Use translation or fallback */}
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
};