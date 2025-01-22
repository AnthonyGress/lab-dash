import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';

import { LinkButton } from './LinkButton';
import { styles } from './styles';
import './App.css';

declare global {
    interface Window {
        env?: any;
    }
}

function App() {
    const localIp = window.env?.VITE_HOST_IP || "localhost";
    console.log('local ip:', localIp);

    return (
        <>
            <Typography align='center' fontWeight={100} fontSize={'3rem'}>Jellyfin Console</Typography>
            <Box sx={styles.center} mt={8}>
                <Box sx={{ flexGrow: 1 }}>
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
        </>
    );
}

export default App;
