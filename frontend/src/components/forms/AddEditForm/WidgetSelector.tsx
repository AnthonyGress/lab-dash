import { Box, Grid2 as Grid, Typography } from '@mui/material';
import { Dispatch, SetStateAction } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { WIDGET_OPTIONS } from './constants';
import { FormValues } from './types';
import { COLORS } from '../../../theme/styles';

type Props = {
    formContext: UseFormReturn<FormValues>
    setCurrentStep: Dispatch<SetStateAction<'select' | 'widget-select' | 'configure'>>;
}

export const WidgetSelector = ({ formContext, setCurrentStep }: Props) => {
    const handleWidgetTypeSelect = (widgetTypeId: string) => {
        formContext.setValue('widgetType', widgetTypeId);
        setCurrentStep('configure');
    };

    return (
        <Box sx={{ mb: 2 }}>
            <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
                {WIDGET_OPTIONS.map((option) => {
                    const IconComponent = option.icon;

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
                                        {option.label}
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
                                        {option.description}
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
