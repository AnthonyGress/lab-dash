import { Box, Divider, Typography, useMediaQuery } from '@mui/material';
import React from 'react';

import { DateTimeWidget } from './DateTimeWidget';
import { DualWidgetContainer } from './DualWidgetContainer';
import { PiholeWidget } from './PiholeWidget/PiholeWidget';
import { SystemMonitorWidget } from './SystemMonitorWidget/SystemMonitorWidget';
import { WeatherWidget } from './WeatherWidget';
import { DUAL_WIDGET_SECTION_HEIGHT } from '../../../../constants/widget-dimensions';
import { COLORS } from '../../../../theme/styles';
import { theme } from '../../../../theme/theme';
import { ITEM_TYPE } from '../../../../types';

type DualWidgetProps = {
    config?: {
        topWidget?: {
            type: string;
            config?: any;
        };
        bottomWidget?: {
            type: string;
            config?: any;
        };
    };
    editMode?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    url?: string;
};

export const DualWidget: React.FC<DualWidgetProps> = ({
    config,
    editMode = false,
    onEdit,
    onDelete,
    url
}) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const renderWidget = (widgetConfig: { type: string; config?: any } | undefined, position: 'top' | 'bottom') => {
        if (!widgetConfig || !widgetConfig.type) {
            return (
                <Box
                    sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2
                    }}
                >
                    <Typography variant='body2' color='text.secondary'>
                        Widget not configured
                    </Typography>
                </Box>
            );
        }

        try {
            switch (widgetConfig.type) {
            case ITEM_TYPE.WEATHER_WIDGET:
                return <WeatherWidget config={widgetConfig.config} />;
            case ITEM_TYPE.DATE_TIME_WIDGET:
                return <DateTimeWidget />;
            case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                return <SystemMonitorWidget config={{
                    ...widgetConfig.config,
                    dualWidgetPosition: position
                }} />;
            case ITEM_TYPE.PIHOLE_WIDGET:
                return <PiholeWidget config={widgetConfig.config} />;
            default:
                return (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Typography variant='body2' color='text.secondary'>
                            Unknown widget type: {widgetConfig.type}
                        </Typography>
                    </Box>
                );
            }
        } catch (error) {
            console.error(`Error rendering widget of type ${widgetConfig.type}:`, error);
            return (
                <Box
                    sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2
                    }}
                >
                    <Typography variant='body2' color='text.secondary'>
                        Error rendering widget
                    </Typography>
                </Box>
            );
        }
    };

    return (
        <DualWidgetContainer
            editMode={editMode}
            onEdit={onEdit}
            onDelete={onDelete}
            url={url}
        >
            <Box
                sx={{
                    flex: isMobile ? '1 1 50%' : 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    mb: 0.5,
                    justifyContent: 'center',
                    position: 'relative',
                    minHeight: isMobile ? DUAL_WIDGET_SECTION_HEIGHT.xs : DUAL_WIDGET_SECTION_HEIGHT.sm,
                    maxHeight: isMobile ? 'unset' : DUAL_WIDGET_SECTION_HEIGHT.sm,
                    height: isMobile ? DUAL_WIDGET_SECTION_HEIGHT.xs : DUAL_WIDGET_SECTION_HEIGHT.sm
                }}
            >
                {renderWidget(config?.topWidget, 'top')}
            </Box>

            <Divider
                sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    width: '100%',
                    my: 0.25,
                    height: '1px'
                }}
            />

            <Box
                sx={{
                    flex: isMobile ? '1 1 50%' : 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    mt: 0.5,
                    justifyContent: 'center',
                    position: 'relative',
                    minHeight: isMobile ? DUAL_WIDGET_SECTION_HEIGHT.xs : DUAL_WIDGET_SECTION_HEIGHT.sm,
                    maxHeight: isMobile ? 'unset' : DUAL_WIDGET_SECTION_HEIGHT.sm,
                    height: isMobile ? DUAL_WIDGET_SECTION_HEIGHT.xs : DUAL_WIDGET_SECTION_HEIGHT.sm
                }}
            >
                {renderWidget(config?.bottomWidget, 'bottom')}
            </Box>
        </DualWidgetContainer>
    );
};
