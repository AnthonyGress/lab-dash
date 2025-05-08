import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Autocomplete, Box, Button, createFilterOptions, Divider, IconButton, TextField, Typography } from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import { TextFieldElement } from 'react-hook-form-mui';
import shortid from 'shortid';

import { VirtualizedListbox } from './VirtualizedListBox';
import { DashApi } from '../../api/dash-api';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { Icon } from '../../types';
import { getIconPath } from '../../utils/utils';

type Props = {
    control: any;
    errors: any;
    onCustomIconSelect?: (file: File | null) => void;
};

export const IconSearch = ({ control, errors, onCustomIconSelect }: Props) => {
    const [selectedIcon, setSelectedIcon] = useState<Icon | null>(control._defaultValues.icon || null);
    const [iconList, setIconList] = useState<Icon[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);

    const fetchIconList = async () => {
        try {
            // Fetch built-in icons
            const builtInIcons = await DashApi.getIconList();

            // Fetch custom icons
            const customIcons = await DashApi.getCustomIcons();

            // Combine the icons with custom icons first
            const combinedIcons = [...(customIcons || []), ...(builtInIcons || [])];
            setIconList(combinedIcons);
        } catch (error) {
            console.error('Error fetching icon list:', error);
        }
    };

    useEffect(() => {
        fetchIconList();
    }, []);

    useEffect(() => {
        if (control._defaultValues.icon) {
            setSelectedIcon(control._defaultValues.icon);
        }
    }, [control._defaultValues.icon]);

    // Clean up any temporary preview URLs when component unmounts
    useEffect(() => {
        return () => {
            if (tempPreviewUrl) {
                URL.revokeObjectURL(tempPreviewUrl);
            }
        };
    }, [tempPreviewUrl]);

    return (
        <Box sx={{ textAlign: 'center' }}>
            <Controller
                name='icon'
                control={control}
                rules={{ required: 'This field is required' }}
                render={({ field, fieldState }) => {
                    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        // Clean up previous preview URL if it exists
                        if (tempPreviewUrl) {
                            URL.revokeObjectURL(tempPreviewUrl);
                        }

                        // Create a temporary preview URL
                        // Validate file type
                        if (!file.type.startsWith('image/')) {
                            console.error('Invalid file type. Only image files are allowed.');
                            return;
                        }

                        const objectUrl = URL.createObjectURL(file);
                        setTempPreviewUrl(objectUrl);

                        // Sanitize the object URL
                        const sanitizedObjectUrl = encodeURI(objectUrl);

                        // Create a valid icon object
                        const tempIcon: Icon = {
                            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                            path: sanitizedObjectUrl,
                            source: 'custom-pending'
                        };

                        // Update the form field value
                        field.onChange(tempIcon);
                        setSelectedIcon(tempIcon);

                        // Pass the file to parent component
                        if (onCustomIconSelect) {
                            onCustomIconSelect(file);
                        }

                        // Reset file input
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    };

                    const handleUploadClick = () => {
                        fileInputRef.current?.click();
                    };

                    return (
                        <>
                            <input
                                type='file'
                                accept='image/*'
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <Autocomplete
                                {...field}
                                options={iconList}
                                filterOptions={createFilterOptions({
                                    matchFrom: 'any',
                                    limit: 50,
                                })}
                                disablePortal
                                blurOnSelect={true}
                                ListboxComponent={VirtualizedListbox}
                                getOptionLabel={(option) => option?.name ?? ''}
                                isOptionEqualToValue={(option, value) => {
                                    // Consider custom-pending icons equal to their non-pending versions
                                    return option?.name === value?.name ||
                                        (option?.source === 'custom-pending' && option?.name === value?.name);
                                }}
                                onChange={(_, newValue) => {
                                    // Directly update the form value
                                    field.onChange(newValue);
                                    setSelectedIcon(newValue);

                                    // Clear custom file if selecting a standard icon
                                    if (newValue && newValue.source !== 'custom-pending' && onCustomIconSelect) {
                                        onCustomIconSelect(null);
                                    }
                                }}
                                value={selectedIcon}
                                renderOption={(props, option) => (
                                    <Box component='li' {...props} sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        '&:hover': {
                                            backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`
                                        },
                                        '&.Mui-selected': {
                                            backgroundColor: `${theme.palette.primary.main} !important`,
                                            color: 'white',
                                        },
                                        '&.Mui-selected:hover': {
                                            backgroundColor: `${theme.palette.primary.main} !important`,
                                            color: 'white',
                                        }
                                    }} key={shortid.generate()}>
                                        <img
                                            src={option.source === 'custom-pending' ? option.path : getIconPath(option.path)}
                                            alt={option.name}
                                            width={24}
                                            style={{ marginRight: 8 }}
                                            key={shortid.generate()}
                                            crossOrigin='anonymous'
                                        />
                                        <Typography variant='body2' key={shortid.generate()}
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '180px'
                                            }}>
                                            {option.name} {option.source === 'custom' && ' (Custom)'}
                                        </Typography>
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
                                                    '& fieldset': { borderColor: theme.palette.text.primary },
                                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                                                    '&.MuiInputBase-root.MuiOutlinedInput-root.Mui-error fieldset': {
                                                        borderColor: theme.palette.error.main,
                                                    },
                                                    '.MuiSvgIcon-root ': { fill: theme.palette.text.primary },
                                                },
                                            }}
                                            slotProps={{ inputLabel: { style: { color: theme.palette.text.primary } } }}
                                        />
                                        {selectedIcon &&
                                            <Box ml={1}>
                                                <img
                                                    src={selectedIcon.source === 'custom-pending'
                                                        ? encodeURI(selectedIcon.path)
                                                        : getIconPath(selectedIcon.path)}
                                                    alt={selectedIcon.name}
                                                    width={25}
                                                    crossOrigin='anonymous'
                                                />
                                                <Typography
                                                    variant='caption'
                                                    sx={{
                                                        display: 'block',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: '60px',
                                                        textAlign: 'center'
                                                    }}>
                                                    {selectedIcon.name}
                                                </Typography>
                                            </Box>
                                        }
                                    </Box>
                                )}
                                noOptionsText='No icons found'
                            />
                            <Box mt={1}>
                                <Button
                                    variant='contained'
                                    startIcon={<CloudUploadIcon />}
                                    onClick={handleUploadClick}
                                    size='small'
                                >
                                    Select Custom Icon
                                </Button>
                            </Box>
                        </>
                    );
                }}
            />
        </Box>
    );
};
