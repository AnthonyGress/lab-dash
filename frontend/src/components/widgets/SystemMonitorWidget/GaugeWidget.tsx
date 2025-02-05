import { Box, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import React from 'react';
import { FaMemory } from 'react-icons/fa';
import { FaServer } from 'react-icons/fa';
import { FaMicrochip } from 'react-icons/fa6';
import { FaTemperatureQuarter } from 'react-icons/fa6';


interface GaugeWidgetProps {
  value: number; // The gauge value (0-100)
  title: string;
  size: number
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({ value, title, size }) => {
    return (
        <Box position='relative' display='inline-flex'>
            {/* Gauge Chart */}
            <Gauge value={value} valueMax={100} width={size} height={size} startAngle={-150} endAngle={150} cornerRadius='50%' sx={(theme) => (
                { '& .MuiGauge-valueText': { display: 'none' },
                    [`& .${gaugeClasses.valueArc}`]: {
                        fill: '#52b202',
                    },
                    [`& .${gaugeClasses.referenceArc}`]: {
                        fill: theme.palette.text.disabled,
                    }, })
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
                <Typography variant='h6' fontWeight='bold'>
                    {value}%
                </Typography>
            </Box>
            <Box
                position='absolute'
                top='85%'
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
                <Typography variant='h6' fontWeight='bold'>
                    {title}
                </Typography>
            </Box>
        </Box>
    );
};
