import { FormControl, MenuItem, Select } from '@mui/material';
import React from 'react';

import { FONT_SIZE_SELECT_OPTIONS } from '../../../../../constants/font-sizes';

interface FontSizeSelectorProps {
    fontSize: string;
    onFontSizeChange: (fontSize: string) => void;
    size?: 'small' | 'medium';
    sx?: object;
}

export const FontSizeSelector: React.FC<FontSizeSelectorProps> = ({
    fontSize = '16px',
    onFontSizeChange,
    size = 'small',
    sx = {}
}) => {
    return (
        <FormControl size={size} sx={{ minWidth: 55, ...sx }}>
            <Select
                value={fontSize}
                onChange={(e) => onFontSizeChange(e.target.value)}
                sx={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.75rem',
                    height: size === 'small' ? '28px' : '32px',
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
    );
};
