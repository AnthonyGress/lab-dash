import { Box, Grid2 as Grid } from '@mui/material';

import { GaugeWidget } from './GaugeWidget';
import { useIsMobile } from '../../../hooks/useIsMobile';

export const SystemMonitorWidget = () => {
    const isMobile = useIsMobile();

    return (
        <Grid container justifyContent={'center'} gap={2} sx={{ display: 'flex', width: '100%', flexDirection: isMobile ? 'column' : 'row' }}>
            <Grid>
                <GaugeWidget title='CPU' value={40} size={135}/>
            </Grid>
            <Grid>
                <GaugeWidget title='RAM' value={20} size={135}/>
            </Grid>
            <Grid>
                <GaugeWidget title='DISK' value={80} size={135}/>
            </Grid>
        </Grid>
    );
};
