import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';

import icon from '../public/jellyfin.svg';
import { Footer } from './components/Footer';
import { LinkButton } from './components/LinkButton';
import { styles } from './theme/styles';
import './theme/App.css';

declare global {
    interface Window {
        env?: any;
    }
}

function App() {
    // Passed in via docker-compose .env file via entrypoint.sh at runtime
    const localIp = window.env?.VITE_HOST_IP || 'localhost';
    console.log('local ip:', localIp);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
        }}
        >
            <Box sx={{ backgroundColor: 'primary.main' }} pt={2} pb={2}>
                <img src={icon} alt={'icon'} width={'75w'}/>
                <Typography align='center' fontWeight={100} fontSize={'2.5rem'}>Jellyfin Console</Typography>
            </Box>
            <Box sx={[styles.center]} component='main' mt={'10vh'}>
                <Box>
                    <Grid container spacing={3} sx={styles.center} size={12}>
                        <LinkButton url={`http://${localIp}:8096`} app='Jellyfin'/>
                        <LinkButton url={`http://${localIp}:5055`} app='Jellyseer'/>
                        <LinkButton url={`http://${localIp}:8080`} app='qBittorrent'/>
                    </Grid>
                    <Grid container spacing={3} sx={styles.center} size={12} mt={8}>
                        <LinkButton url={`http://${localIp}:7878`} app='Radarr'/>
                        <LinkButton url={`http://${localIp}:8989`} app='Sonarr'/>
                        <LinkButton url={`http://${localIp}:9696`} app='Prowlarr'/>
                    </Grid>
                </Box>
            </Box>
            <Footer />
        </Box>
    );
}

export default App;
