import {
    Checklist,
    Code,
    FormatBold,
    FormatItalic,
    FormatListBulleted,
    FormatListNumbered,
    FormatQuote,
    Link
} from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import React from 'react';
import { GoHeading } from 'react-icons/go';


interface MarkdownToolbarProps {
    onFormat: (type: string, prefix?: string, suffix?: string) => void;
    isMobile?: boolean;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onFormat }) => {
    const iconButtonStyle = {
        color: 'rgba(255,255,255,0.7)',
        '&:hover': { color: 'white' },
        padding: '4px', // Reduced padding for more compact buttons
        minWidth: '28px', // Smaller fixed width
        minHeight: '28px', // Smaller fixed height
        borderRadius: '50%', // Force circular shape
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const iconStyle = {
        fontSize: '16px' // Consistent icon size
    };

    return (
        <Box sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 0,
            padding: '0px',
            backgroundColor: 'transparent',
            borderRadius: '4px',
        }}>
            <Tooltip title='Heading'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('heading')}
                    sx={iconButtonStyle}
                >
                    <GoHeading style={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Bold'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('bold', '**', '**')}
                    sx={iconButtonStyle}
                >
                    <FormatBold sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Italic'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('italic', '_', '_')}
                    sx={iconButtonStyle}
                >
                    <FormatItalic sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Inline Code'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('code', '`', '`')}
                    sx={iconButtonStyle}
                >
                    <Code sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Code Block'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('codeblock')}
                    sx={iconButtonStyle}
                >
                    <Code sx={{ ...iconStyle, fontWeight: 'bold' }} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Quote'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('quote')}
                    sx={iconButtonStyle}
                >
                    <FormatQuote sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Link'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('link')}
                    sx={iconButtonStyle}
                >
                    <Link sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Unordered List'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('ul')}
                    sx={iconButtonStyle}
                >
                    <FormatListBulleted sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Numbered List'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('ol')}
                    sx={iconButtonStyle}
                >
                    <FormatListNumbered sx={iconStyle} />
                </IconButton>
            </Tooltip>

            <Tooltip title='Task List'>
                <IconButton
                    size='small'
                    onClick={() => onFormat('task')}
                    sx={iconButtonStyle}
                >
                    <Checklist sx={iconStyle} />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default MarkdownToolbar;
