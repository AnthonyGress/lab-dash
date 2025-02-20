import { Box, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import React from 'react';

import { theme } from '../../../theme/theme';


interface GaugeWidgetProps {
  value: number; // The gauge value (0-100)
  title: string;
  size?: number;
  temperature?: boolean;
  total?: number;
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({ value, title, size, temperature, total }) => {

    return (
        <Box position='relative' display='inline-flex'>
            {/* Gauge Chart */}
            <Gauge value={value} valueMax={total ? total : 100} startAngle={-150} endAngle={150} cornerRadius='50%' sx={
                { '& .MuiGauge-valueText': { display: 'none' },
                    [`& .${gaugeClasses.valueArc}`]: {
                        fill: 'primary.main',
                    },
                    [`& .${gaugeClasses.referenceArc}`]: {
                        fill: theme.palette.text.disabled,
                    },
                    width: { xs: 108, sm: 80, md: 108, xl: 135 },
                    height: { xs: 135, sm: 120, md: 130, xl: 135 },
                    pointerEvents: 'none', // Allows scrolling through the SVG
                    touchAction: 'none',
                }
            } />
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
                <Typography fontSize={{ xs: 20, sm: 17, md: 22, lg: 20 }} fontWeight='bold'>
                    {value}{temperature ? '°C': '%'}
                </Typography>
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
                {/* <FaMicrochip size={24} color='white' /> */}
                <Typography fontSize={15} fontWeight='bold'>
                    {title}
                </Typography>
            </Box>
        </Box>
    );
};
