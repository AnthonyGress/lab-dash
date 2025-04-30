import { Box, CardContent, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { useAppContext } from '../../../../context/useAppContext';

export const DateTimeWidget = () => {
    const [dateTime, setDateTime] = useState<Date>(new Date());
    const { refreshCounter } = useAppContext();

    useEffect(() => {
        // Set initial time
        setDateTime(new Date());

        // Create interval to update time every minute
        const intervalId = setInterval(() => {
            setDateTime(new Date());
        }, 60000);

        // Clean up interval on component unmount
        return () => {
            clearInterval(intervalId);
        };
    }, []);

    // Force an immediate refresh when dashboard is refreshed
    useEffect(() => {
        // Update time immediately when dashboard refreshes
        setDateTime(new Date());
    }, [refreshCounter]);

    return (
        <CardContent>
            <Box height={'100%'}>
                <Typography fontSize={'3rem'} align={'center'} fontWeight={600}>{dateTime && dateTime.toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' })}</Typography>
                <Typography fontSize={'1.5rem'} align={'center'}>{dateTime && dateTime.toLocaleDateString([], {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                })}</Typography>
            </Box>
        </CardContent>
    );
};
