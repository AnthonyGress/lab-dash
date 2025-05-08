import { Box, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import React, { ReactNode } from 'react';

import { useIsMobile } from '../../../../../hooks/useIsMobile';
import { theme } from '../../../../../theme/theme';

interface GaugeWidgetProps {
  value: number; // The gauge value
  title: string;
  size?: number;
  temperature?: boolean;
  isFahrenheit?: boolean;
  total?: number;
  suffix?: string;
  customContent?: ReactNode;
  isDualWidget?: boolean;
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({
    value,
    title,
    size,
    temperature,
    isFahrenheit,
    total,
    suffix,
    customContent,
    isDualWidget
}) => {
    const isMobile = useIsMobile();

    // Calculate the maximum value for temperature gauge based on the unit
    const maxValue = temperature
        ? (isFahrenheit ? 212 : 100) // Max temp: 212°F or 100°C
        : (total ? total : 100);     // Default max for non-temperature gauges

    // Determine the suffix to display
    const displaySuffix = (): string => {
        if (suffix) return suffix;
        if (temperature) return isFahrenheit ? '°F' : '°C';
        return '%';
    };

    // Define responsive width and height for the gauge
    // Make gauges smaller on mobile and even smaller in dual widgets
    const gaugeSizing = {
        // Width is smaller in xs (mobile) and even smaller if in dual widget
        width: {
            xs: isDualWidget ? 90 : 108,
            sm: 100,
            md: 108,
            xl: 135
        },
        // Height follows similar pattern as width
        height: {
            xs: isDualWidget ? 110 : 135,
            sm: 120,
            md: 130,
            xl: 135
        }
    };

    return (
        <Box position='relative' display='inline-flex'>
            {/* Gauge Chart */}
            <Gauge
                value={value}
                valueMax={maxValue}
                startAngle={-150}
                endAngle={150}
                cornerRadius='50%'
                sx={
                    { '& .MuiGauge-valueText': { display: 'none' },
                        [`& .${gaugeClasses.valueArc}`]: {
                            fill: 'primary.main',
                        },
                        [`& .${gaugeClasses.referenceArc}`]: {
                            fill: theme.palette.text.disabled,
                        },
                        ...gaugeSizing,
                        pointerEvents: 'none',
                        touchAction: 'none',
                    }
                }
            />
            {/* Center Content */}
            <Box
                position='absolute'
                top='50%'
                left='50%'
                sx={{
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                }}
            >
                {customContent ? (
                    customContent
                ) : (
                    <Typography
                        fontSize={{
                            xs: isDualWidget ? 18 : 20,
                            sm: 17,
                            md: 22,
                            lg: 20
                        }}
                        fontWeight='bold'
                    >
                        {value}{displaySuffix()}
                    </Typography>
                )}
            </Box>
            <Box
                position='absolute'
                top='86%'
                left='50%'
                sx={{
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                }}
            >
                <Typography
                    fontSize={isDualWidget && isMobile ? 13 : 15}
                    fontWeight='bold'
                >
                    {title}
                </Typography>
            </Box>
        </Box>
    );
};
