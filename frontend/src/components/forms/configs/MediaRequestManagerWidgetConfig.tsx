import {
    Box,
    FormControl,
    FormControlLabel,
    FormLabel,
    Radio,
    RadioGroup,
    Switch,
    TextField,
    Typography
} from '@mui/material';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';

import { FormValues } from '../AddEditForm';

interface MediaRequestManagerWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const MediaRequestManagerWidgetConfig: React.FC<MediaRequestManagerWidgetConfigProps> = ({
    formContext
}) => {
    const { register, watch, setValue } = formContext;

    const service = watch('mediaRequestManagerService') || 'jellyseerr';
    const displayName = watch('mediaRequestManagerName') || '';
    const host = watch('mediaRequestManagerHost') || '';
    const port = watch('mediaRequestManagerPort') || '5055';
    const ssl = watch('mediaRequestManagerSsl') || false;
    const apiKey = watch('mediaRequestManagerApiKey') || '';

    const handleChange = (field: string, value: any) => {
        setValue(field as keyof FormValues, value);

        // Auto-update display name when service changes
        if (field === 'mediaRequestManagerService') {
            if (!displayName || displayName === 'Jellyseerr' || displayName === 'Overseerr') {
                setValue('mediaRequestManagerName', value === 'jellyseerr' ? 'Jellyseerr' : 'Overseerr');
            }
            // Auto-update port when service changes
            if (port === '5055' || !port) {
                setValue('mediaRequestManagerPort', '5055');
            }
        }
    };

    return (
        <Box>
            <FormControl component='fieldset' sx={{ mb: 2 }}>
                <FormLabel component='legend'>Service</FormLabel>
                <RadioGroup
                    value={service}
                    onChange={(e) => handleChange('mediaRequestManagerService', e.target.value)}
                >
                    <FormControlLabel
                        value='jellyseerr'
                        control={<Radio />}
                        label='Jellyseerr'
                    />
                    <FormControlLabel
                        value='overseerr'
                        control={<Radio />}
                        label='Overseerr'
                    />
                </RadioGroup>
            </FormControl>

            <TextField
                {...register('mediaRequestManagerName')}
                fullWidth
                label='Display Name'
                sx={{ mb: 2 }}
                placeholder={service === 'jellyseerr' ? 'Jellyseerr' : 'Overseerr'}
            />

            <TextField
                {...register('mediaRequestManagerHost', { required: true })}
                fullWidth
                label='Host'
                sx={{ mb: 2 }}
                placeholder='localhost'
                required
            />

            <TextField
                {...register('mediaRequestManagerPort', { required: true })}
                fullWidth
                label='Port'
                sx={{ mb: 2 }}
                placeholder='5055'
                required
            />

            <FormControlLabel
                control={
                    <Switch
                        checked={ssl}
                        onChange={(e) => handleChange('mediaRequestManagerSsl', e.target.checked)}
                    />
                }
                label='Use SSL (HTTPS)'
                sx={{ mb: 2, display: 'block' }}
            />

            <TextField
                {...register('mediaRequestManagerApiKey', { required: true })}
                fullWidth
                label='API Key'
                type='password'
                sx={{ mb: 2 }}
                required
                helperText={`Find your API key in ${service === 'jellyseerr' ? 'Jellyseerr' : 'Overseerr'}: Settings → General → Security → API Key`}
            />
        </Box>
    );
};
