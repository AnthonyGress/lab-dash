import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';

import { LinkButton } from './LinkButton';
import { styles } from './styles';
import './App.css';

function App() {
    const localIp = window.location.host.split(':')[0];

    console.log(localIp);
    console.log('env', import.meta.env.VITE_HOST_IP);


    return (
        <>
            <Typography align='center' fontWeight={100} fontSize={'3rem'}>Management Console</Typography>
            <Box sx={styles.center} mt={8}>
                <Box sx={{ flexGrow: 1 }}>
                    <Grid container spacing={3} sx={styles.center} size={12}>
                        <LinkButton url={`${localIp}:8080`} app='qBittorrent'/>
                        <LinkButton url={`${localIp}:5055`} app='Jellyseer'/>
                        <LinkButton url={`${localIp}:8096`} app='Jellyfin'/>
                    </Grid>
                    <Grid container spacing={3} sx={styles.center} size={12} mt={8}>
                        <LinkButton url={`${localIp}:7878`} app='Radarr'/>
                        <LinkButton url={`${localIp}:8989`} app='Sonarr'/>
                        <LinkButton url={`${localIp}:9696`} app='Prowlarr'/>
                    </Grid>
                </Box>
            </Box>
        </>
    );
}

export default App;
