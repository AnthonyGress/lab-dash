import { Box, Card, CardContent, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { styles } from '../../theme/styles';

export const DateTimeWidget = () => {
    const [dateTime, setDateTime] = useState<any>(new Date());

    useEffect(()=>{
        setInterval(()=>{
            setDateTime(new Date());
        }, 60000);
    },[]);

    return (
        <Card sx={{ ...styles.widgetContainer, ...styles.vcenter }}>
            <CardContent>
                <Box p={4} height={'100%'}>
                    <Typography fontSize={'3rem'} fontWeight={600}>{dateTime && dateTime.toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' })}</Typography>
                    <Typography fontSize={'1.5rem'}>{dateTime && dateTime.toLocaleDateString([], {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                    })}</Typography>
                </Box>
            </CardContent>
        </Card>
    );
};
