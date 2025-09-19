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
import { Box, FormControl, IconButton, MenuItem, Select, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { GoHeading } from 'react-icons/go';

import { FONT_SIZE_SELECT_OPTIONS } from '../../../../../constants/font-sizes';

interface MarkdownToolbarProps {
    onFormat: (type: string, prefix?: string, suffix?: string) => void;
    isMobile?: boolean;
    fontSize?: string;
    onFontSizeChange?: (fontSize: string) => void;
    hideFontSize?: boolean;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
    onFormat,
    fontSize = '16px',
    onFontSizeChange,
    hideFontSize = false
}) => {
    const [isSelectOpen, setIsSelectOpen] = useState(false);

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
            alignItems: 'center'
        }}>
            {/* Font Size Selector */}
            {onFontSizeChange && !hideFontSize && (
                <FormControl size='small' sx={{ minWidth: 55, mr: 1 }}>
                    <Select
                        value={fontSize}
                        open={isSelectOpen}
                        onOpen={() => setIsSelectOpen(true)}
                        onClose={() => setIsSelectOpen(false)}
                        onChange={(e) => onFontSizeChange(e.target.value as string)}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '0.75rem',
                            height: '28px',
                            '& .MuiSelect-select': {
                                padding: '4px 8px',
                                paddingRight: '20px !important'
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.3)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.5)',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.7)',
                            },
                            '& .MuiSelect-icon': {
                                color: 'rgba(255,255,255,0.7)',
                            }
                        }}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    bgcolor: '#2A2A2A',
                                    color: 'white',
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.75rem',
                                        minHeight: '32px',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255,255,255,0.1)'
                                        },
                                        '&.Mui-selected': {
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(255,255,255,0.3)'
                                            }
                                        }
                                    }
                                }
                            }
                        }}
                    >
                        {FONT_SIZE_SELECT_OPTIONS.map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

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
