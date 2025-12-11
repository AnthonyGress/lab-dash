import { Box, Grid2 as Grid, Typography } from '@mui/material';
import { Dispatch, SetStateAction } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next'; // Import hook

import { WIDGET_OPTIONS } from './constants';
import { FormValues } from './types';
import { COLORS } from '../../../theme/styles';
import { ITEM_TYPE } from '../../../types';

type Props = {
    formContext: UseFormReturn<FormValues>
    setCurrentStep: Dispatch<SetStateAction<'select' | 'widget-select' | 'configure'>>;
}

export const WidgetSelector = ({ formContext, setCurrentStep }: Props) => {
    const { t } = useTranslation(); // Initialize hook

    const handleWidgetTypeSelect = (widgetTypeId: string) => {
        formContext.setValue('widgetType', widgetTypeId);
        setCurrentStep('configure');
    };

    // Map widget ID to translation key suffix
    const getWidgetTranslationKey = (id: string) => {
        switch (id) {
            case ITEM_TYPE.ADGUARD_WIDGET: return 'adguard';
            case ITEM_TYPE.DATE_TIME_WIDGET: return 'dateTime';
            case ITEM_TYPE.DISK_MONITOR_WIDGET: return 'diskMonitor';
            case ITEM_TYPE.DOWNLOAD_CLIENT: return 'downloadClient';
            case ITEM_TYPE.DUAL_WIDGET: return 'dual';
            case ITEM_TYPE.GROUP_WIDGET: return 'group';
            case ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET: return 'mediaRequest';
            case ITEM_TYPE.MEDIA_SERVER_WIDGET: return 'mediaServer';
            case ITEM_TYPE.NOTES_WIDGET: return 'notes';
            case ITEM_TYPE.PIHOLE_WIDGET: return 'pihole';
            case ITEM_TYPE.RADARR_WIDGET: return 'radarr';
            case ITEM_TYPE.SONARR_WIDGET: return 'sonarr';
            case ITEM_TYPE.SYSTEM_MONITOR_WIDGET: return 'system';
            case ITEM_TYPE.WEATHER_WIDGET: return 'weather';
            default: return null;
        }
    };

    return (
        <Box sx={{ mb: 2 }}>
            <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
                {WIDGET_OPTIONS.map((option) => {
                    const IconComponent = option.icon;
                    const translationKey = getWidgetTranslationKey(option.id);
                    
                    // Get translations if key exists, otherwise fallback to option text
                    const label = translationKey ? t(`widgets.titles.${translationKey}`) : option.label;
                    const description = translationKey ? t(`widgets.descriptions.${translationKey}`) : option.description;

                    return (
                        <Grid
                            key={option.id}
                            size={{ xs: 6, sm: 6, md: 3 }}
                        >
                            <Box
                                onClick={() => handleWidgetTypeSelect(option.id)}
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
                                    size={option.iconSize || 32}
                                    style={{
                                        color: 'inherit',
                                        marginBottom: '8px'
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
                                        {label}
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
                                        {description}
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