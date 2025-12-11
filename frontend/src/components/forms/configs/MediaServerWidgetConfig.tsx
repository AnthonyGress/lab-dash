import { Box, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

const MEDIA_SERVER_OPTIONS = [
    { id: 'jellyfin', label: 'Jellyfin' },
    // { id: 'plex', label: 'Plex (Coming Soon)' }
];

interface MediaServerWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const MediaServerWidgetConfig = ({ formContext }: MediaServerWidgetConfigProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    // Watch the media server type directly from the form
    const watchedMediaServerType = formContext.watch('mediaServerType');
    const [mediaServerType, setMediaServerType] = useState<string>(
        watchedMediaServerType || formContext.getValues('mediaServerType') || 'jellyfin'
    );

    const textFieldStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
        },
        width: '100%',
        minWidth: isMobile ? '50vw' : '20vw'
    };

    useEffect(() => {
        if (watchedMediaServerType) {
            setMediaServerType(watchedMediaServerType);

            // Set default port if there's no existing port value (for new widgets)
            const currentPort = formContext.getValues('msPort');
            if (!currentPort || currentPort === '') {
                const defaultPort = watchedMediaServerType === 'plex' ? '32400' : '8096';
                formContext.setValue('msPort', defaultPort);
            }
        }
    }, [watchedMediaServerType, formContext]);

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
                        {t('widgets.mediaServer.config.selectServer')}
                    </Typography>
                    <RadioGroup
                        name='mediaServerType'
                        value={mediaServerType}
                        onChange={(e) => {
                            setMediaServerType(e.target.value);
                            formContext.setValue('mediaServerType', e.target.value);
                        }}
                        sx={{
                            flexDirection: 'row',
                            ml: 1,
                            '& .MuiFormControlLabel-label': {
                                color: 'white'
                            }
                        }}
                    >
                        {MEDIA_SERVER_OPTIONS.map((option) => (
                            <FormControlLabel
                                key={option.id}
                                value={option.id}
                                control={
                                    <Radio
                                        sx={{
                                            color: 'white',
                                            '&.Mui-checked': {
                                                color: theme.palette.primary.main
                                            }
                                        }}
                                    />
                                }
                                label={option.label}
                            />
                        ))}
                    </RadioGroup>
                </Box>
            </Grid>

            <Grid>
                <TextFieldElement
                    label={t('widgets.mediaServer.config.displayName')}
                    name='mediaServerName'
                    fullWidth
                    sx={textFieldStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                    placeholder='Jellyfin'
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    name='msHost'
                    label={t('widgets.mediaServer.config.host')}
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={textFieldStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                    placeholder={t('widgets.mediaServer.config.placeholder')}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    name='msPort'
                    label={t('widgets.mediaServer.config.port')}
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={textFieldStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    name='msApiKey'
                    label={t('widgets.mediaServer.config.apiKey')}
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={textFieldStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                    helperText={t('widgets.mediaServer.config.apiKeyHelper')}
                    rules={{
                        required: t('widgets.mediaServer.config.apiKeyRequired'),
                        validate: (value: string) => {
                            // Allow masked value for existing widgets
                            if (value === '**********') return true;
                            // Require actual value for new widgets or when changed
                            if (!value || value.trim() === '') {
                                return t('widgets.mediaServer.config.apiKeyRequired');
                            }
                            return true;
                        }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label={t('widgets.mediaServer.config.useSsl')}
                    name='msSsl'
                    checked={formContext.watch('msSsl')}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label={t('widgets.mediaServer.config.showLabel')}
                    name='showLabel'
                    checked={formContext.watch('showLabel') !== false}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>
        </>
    );
};