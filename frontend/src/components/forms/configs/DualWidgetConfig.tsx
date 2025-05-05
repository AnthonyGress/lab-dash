import { Box, Grid2 as Grid, Typography } from '@mui/material';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { SelectElement } from 'react-hook-form-mui';

import { PiholeWidgetConfig } from './PiholeWidgetConfig';
import { SystemMonitorWidgetConfig } from './SystemMonitorWidgetConfig';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm';
import { WeatherWidgetConfig } from './WeatherWidgetConfig';
import { ITEM_TYPE } from '../../../types';

const WIDGET_OPTIONS = [
    { id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' },
    { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' },
    { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' },
    { id: ITEM_TYPE.PIHOLE_WIDGET, label: 'Pi-hole' }
];

interface DualWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const DualWidgetConfig = ({ formContext }: DualWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const selectStyling = {
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
        minWidth: isMobile ? '50vw' : '20vw',
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
    };

    // Update field validation based on selected widget types
    useEffect(() => {
        const topWidgetType = formContext.watch('topWidgetType');
        const bottomWidgetType = formContext.watch('bottomWidgetType');

        formContext.trigger();
    }, [formContext.watch('topWidgetType'), formContext.watch('bottomWidgetType'), formContext]);

    const renderWidgetConfig = (widgetType: string | undefined, position: 'top' | 'bottom') => {
        if (!widgetType) return null;

        switch (widgetType) {
        case ITEM_TYPE.DATE_TIME_WIDGET:
            // Date & Time widget doesn't need additional configuration
            return null;
        case ITEM_TYPE.WEATHER_WIDGET:
            return <WeatherWidgetConfig formContext={formContext} />;
        case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
            return <SystemMonitorWidgetConfig formContext={formContext} />;
        case ITEM_TYPE.PIHOLE_WIDGET:
            return (
                <Box sx={{
                    width: isMobile ? '100%' : selectStyling.minWidth,
                    paddingLeft: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <PiholeWidgetConfig formContext={formContext} />
                </Box>
            );
        default:
            return null;
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%'
        }}>
            <Grid container spacing={2} sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
            }}>
                <Grid style={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Typography variant='h6' color='text.primary'>
                            Top Widget Configuration
                        </Typography>
                    </Box>
                </Grid>

                <Grid style={{ width: '100%' }}>
                    <SelectElement
                        label='Top Widget Type'
                        name='topWidgetType'
                        options={WIDGET_OPTIONS}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />
                </Grid>

                {formContext.watch('topWidgetType') && (
                    <Grid container sx={{
                        marginTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%'
                    }}>
                        {renderWidgetConfig(formContext.watch('topWidgetType'), 'top')}
                    </Grid>
                )}

                <Grid style={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 2 }}>
                        <Typography variant='h6' color='text.primary'>
                            Bottom Widget Configuration
                        </Typography>
                    </Box>
                </Grid>

                <Grid style={{ width: '100%' }}>
                    <SelectElement
                        label='Bottom Widget Type'
                        name='bottomWidgetType'
                        options={WIDGET_OPTIONS}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />
                </Grid>

                {formContext.watch('bottomWidgetType') && (
                    <Grid container sx={{
                        marginTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%'
                    }}>
                        {renderWidgetConfig(formContext.watch('bottomWidgetType'), 'bottom')}
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};
