import {
    Box,
    FormControlLabel,
    Grid2 as Grid,
    Radio,
    RadioGroup,
    Typography
} from '@mui/material';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface MediaRequestManagerWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const MediaRequestManagerWidgetConfig: React.FC<MediaRequestManagerWidgetConfigProps> = ({
    formContext
}) => {
    const { watch, setValue } = formContext;

    const service = watch('mediaRequestManagerService') || 'jellyseerr';
    const displayName = watch('mediaRequestManagerName') || '';
    const port = watch('mediaRequestManagerPort') || '5055';

    const handleServiceChange = (value: string) => {
        setValue('mediaRequestManagerService', value as 'jellyseerr' | 'overseerr');

        // Auto-update display name when service changes
        if (!displayName || displayName === 'Jellyseerr' || displayName === 'Overseerr') {
            setValue('mediaRequestManagerName', value === 'jellyseerr' ? 'Jellyseerr' : 'Overseerr');
        }
        // Auto-update port when service changes
        if (port === '5055' || !port) {
            setValue('mediaRequestManagerPort', '5055');
        }
    };

    return (
        <>
            <Grid>
                <Box sx={{ mb: 2, mt: 1 }}>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'white',
                            mb: 1,
                            ml: 1
                        }}
                    >
                        Select Service:
                    </Typography>
                    <RadioGroup
                        name='mediaRequestManagerService'
                        value={service}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        sx={{
                            flexDirection: 'row',
                            ml: 1,
                            '& .MuiFormControlLabel-label': {
                                color: 'white'
                            }
                        }}
                    >
                        <FormControlLabel
                            value='jellyseerr'
                            control={
                                <Radio
                                    sx={{
                                        color: 'white',
                                        '&.Mui-checked': {
                                            color: 'primary.main'
                                        }
                                    }}
                                />
                            }
                            label='Jellyseerr'
                        />
                        <FormControlLabel
                            value='overseerr'
                            control={
                                <Radio
                                    sx={{
                                        color: 'white',
                                        '&.Mui-checked': {
                                            color: 'primary.main'
                                        }
                                    }}
                                />
                            }
                            label='Overseerr'
                        />
                    </RadioGroup>
                </Box>
            </Grid>
            <Grid>
                <TextFieldElement
                    name='mediaRequestManagerName'
                    label='Display Name'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <TextFieldElement
                    name='mediaRequestManagerHost'
                    label='Host'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <TextFieldElement
                    name='mediaRequestManagerPort'
                    label='Port'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <TextFieldElement
                    name='mediaRequestManagerApiKey'
                    label='API Key'
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Use SSL'
                    name='mediaRequestManagerSsl'
                    checked={formContext.watch('mediaRequestManagerSsl')}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Show Name'
                    name='showLabel'
                    checked={formContext.watch('showLabel')}
                    sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}
                />
            </Grid>
        </>
    );
};
