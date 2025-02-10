import { Autocomplete, Box, IconButton, TextField, Typography } from '@mui/material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import { TextFieldElement } from 'react-hook-form-mui';
import shortid from 'shortid';

import { DashApi } from '../api/dash-api';
import { styles } from '../theme/styles';
import { theme } from '../theme/theme';
import { Icon } from '../types';
import { getIconPath } from '../utils/utils';

type Props = {
    control: any;
    errors: any
};

export const IconSearch = ({ control, errors }: Props) => {
    const [selectedIcon, setSelectedIcon] = useState<Icon>();
    const [iconList, setIconList] = useState<Icon[]>([]);

    const fetchIconList = async () => {
        try {
            const response = await DashApi.getIconList();
            setIconList(response);
        } catch (error) {
            console.error('Error fetching icon list:', error);
        }
    };

    useEffect(() => {
        fetchIconList();
    }, []);

    return (
        <Box sx={{ textAlign: 'center' }}>
            <Controller
                name='icon'
                control={control}
                rules={{ required: 'This field is required' }}
                render={({ field, fieldState }) => (
                    <Autocomplete
                        {...field}
                        options={iconList}
                        getOptionLabel={(option) => option?.name ?? ''}
                        isOptionEqualToValue={(option, value) => option.name === value?.name}
                        onChange={(_, newValue) => {field.onChange(newValue); setSelectedIcon(newValue);}}
                        value={field.value || null}
                        renderOption={(props, option) => (
                            <Box component='li' {...props} sx={{ display: 'flex', alignItems: 'center' }} key={shortid.generate()}>
                                <img src={getIconPath(option.path)} alt={option.name} width={24} style={{ marginRight: 8 }} key={shortid.generate()}/>
                                <Typography variant='body2' key={shortid.generate()}>{option.name}</Typography>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <Box sx={styles.center}>
                                <TextField
                                    {...params}
                                    label='Select Icon*'
                                    variant='outlined'
                                    fullWidth
                                    error={!!fieldState?.error}
                                    helperText={fieldState?.error?.message}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': { borderColor: 'text.primary' },
                                        },
                                        '.MuiSvgIcon-root ': { fill: theme.palette.text.primary },
                                    }}
                                    slotProps={{
                                        inputLabel:
                        { style: { color: theme.palette.text.primary } }
                                    }}
                                />
                                {selectedIcon &&
                                <Box ml={1}>
                                    <img src={getIconPath(selectedIcon.path)} alt={selectedIcon.name} width={25} />
                                </Box>
                                }
                            </Box>
                        )}
                        noOptionsText='No icons found'
                        slotProps={{ listbox: { style: { maxHeight: '25vh' } } }}
                    />
                )}
            />
        </Box>
    );
};
