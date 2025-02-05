import { Box, Grid2 as Grid } from '@mui/material';

import { GaugeWidget } from './GaugeWidget';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { styles } from '../../../theme/styles';

export const SystemMonitorWidget = () => {
    const isMobile = useIsMobile();

    return (
        <Grid container sx={{ ...styles.widgetContainer, height: isMobile ? '100%' : styles.widgetContainer.height }} p={4} justifyContent={'center'} gap={2} width={isMobile ? '90%' : '30%'}>
            <Grid>
                <GaugeWidget title='CPU' value={40} size={145}/>
            </Grid>
            <Grid>
                <GaugeWidget title='RAM' value={20} size={145}/>
            </Grid>
            <Grid>
                <GaugeWidget title='DISK' value={80} size={145}/>
            </Grid>
        </Grid>
    );
};
