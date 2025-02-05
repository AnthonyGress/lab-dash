import { Box, SxProps, Theme } from '@mui/material';

import logo from '../assets/gradient_logo.png';

interface LogoProps {
    src?: string;
    size?: number | string;
    alt?: string;
    sx?: SxProps<Theme>;
}

export const Logo: React.FC<LogoProps> = ({ src, size = 40, alt = 'Logo Icon', sx }) => {
    return (
        <Box
            component='img'
            src={logo}
            alt={alt}
            sx={{
                width: size,
                height: size,
                objectFit: 'contain',
                ...sx
            }}
        />
    );
};
