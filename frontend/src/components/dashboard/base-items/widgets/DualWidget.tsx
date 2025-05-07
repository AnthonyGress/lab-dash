import { Box, Divider, Typography } from '@mui/material';
import React from 'react';

import { DateTimeWidget } from './DateTimeWidget';
import { DualWidgetContainer } from './DualWidgetContainer';
import { PiholeWidget } from './PiholeWidget/PiholeWidget';
import { SystemMonitorWidget } from './SystemMonitorWidget/SystemMonitorWidget';
import { WeatherWidget } from './WeatherWidget';
import { COLORS } from '../../../../theme/styles';
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
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    mb: 0.5,
                    justifyContent: 'center',
                    position: 'relative'
                }}
            >
                {renderWidget(config?.topWidget, 'top')}
            </Box>

            <Divider
                sx={{
                    borderColor: COLORS.BORDER,
                    my: 0.25
                }}
            />

            <Box
                sx={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    mt: 0.5,
                    justifyContent: 'center',
                    position: 'relative'
                }}
            >
                {renderWidget(config?.bottomWidget, 'bottom')}
            </Box>
        </DualWidgetContainer>
    );
};
