import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';

import jellyfinIcon from '../assets/jellyfin.png';
import jellyseerIcon from '../assets/jellyseerr.png';
import prowlarrIcon from '../assets/prowlarr.png';
import qbIcon from '../assets/qb.png';
import radarrIcon from '../assets/radarr.png';
import readarrIcon from '../assets/readarr.png';
import sonarrIcon from '../assets/sonarr.png';

type Props = {
    url: string;
    app: string;
}

export const LinkButton = ({ url, app }: Props) => {
    let icon: string;
    switch (app) {
    case 'qBittorrent':
        icon = qbIcon;
        break;
    case 'Jellyfin':
        icon = jellyfinIcon;
        break;
    case 'Jellyseer':
        icon = jellyseerIcon;
        break;
    case 'Radarr':
        icon = radarrIcon;
        break;
    case 'Sonarr':
        icon = sonarrIcon;
        break;
    case 'Prowlarr':
        icon = prowlarrIcon;
        break;
    case 'Readarr':
        icon = readarrIcon;
        break;
    default:
        icon = jellyfinIcon;
        break;
    }

    return (
        <Grid className='scale'>
            <a href={url} rel='noopener noreferrer' target='_blank'>
                <Box sx={{ backgroundColor: 'white', borderRadius: 4, p:1 }}>
                    <Box>
                        <img src={icon} alt={app} width={'75w'}/>
                    </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                    <Typography fontSize={'1.2rem'}>{app}</Typography>
                </Box>
            </a>
        </Grid>
    );
};
