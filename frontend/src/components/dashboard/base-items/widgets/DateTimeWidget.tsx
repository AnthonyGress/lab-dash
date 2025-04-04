import { Box, CardContent, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export const DateTimeWidget = () => {
    const [dateTime, setDateTime] = useState<any>(new Date());

    useEffect(()=>{
        setInterval(()=>{
            setDateTime(new Date());
        }, 60000);
    },[]);

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
