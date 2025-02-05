import { Box, Typography } from '@mui/material';

export const Footer = () => {
    return (
        <Box component='footer'
            sx={{
                backgroundColor: 'primary.main',
                color: 'white',
                textAlign: 'center',
                padding: 4,
                mt: 'auto'
            }}>
            <a href='https://catalyx.cloud' rel='noreferrer noopener' target='_blank'>
                <Typography className='signature'>
                    Catalyx
                </Typography>
            </a>
        </Box>
    );
};
