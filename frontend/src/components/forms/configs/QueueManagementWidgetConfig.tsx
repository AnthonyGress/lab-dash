import { Grid2 as Grid } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next'; // Import hook

import { useIsMobile } from '../../../hooks/useIsMobile';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface QueueManagementWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    serviceName: string; // 'Sonarr' or 'Radarr'
    defaultPort: string; // '8989' for Sonarr, '7878' for Radarr
}

export const QueueManagementWidgetConfig: React.FC<QueueManagementWidgetConfigProps> = ({
    formContext,
    serviceName,
    defaultPort
}) => {
    const { t } = useTranslation(); // Initialize hook
    const isMobile = useIsMobile();
    const servicePrefix = serviceName.toLowerCase(); // 'sonarr' or 'radarr'

    return (
        <>
            <Grid>
                <TextFieldElement
                    name={`${servicePrefix}Name`}
                    label={t('forms.addEdit.fields.displayName')}
                    fullWidth
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                        },
                        width: '100%',
                        minWidth: isMobile ? '65vw' : '20vw'
                    }}
                    InputLabelProps={{
                        style: { color: theme.palette.text.primary }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    name={`${servicePrefix}Host`}
                    label={t('widgets.common.fields.host')} // Assuming you have a common key for Host, or use forms.addEdit.fields.host
                    placeholder='localhost'
                    fullWidth
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                        },
                        width: '100%',
                        minWidth: isMobile ? '65vw' : '20vw'
                    }}
                    InputLabelProps={{
                        style: { color: theme.palette.text.primary }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    name={`${servicePrefix}Port`}
                    label={t('forms.addEdit.fields.port')}
                    placeholder={defaultPort}
                    fullWidth
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                        },
                        width: '100%',
                        minWidth: isMobile ? '65vw' : '20vw'
                    }}
                    InputLabelProps={{
                        style: { color: theme.palette.text.primary }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label={t('forms.addEdit.fields.useSsl')}
                    name={`${servicePrefix}Ssl`}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    name={`${servicePrefix}ApiKey`}
                    label={t('widgets.common.fields.apiKey')} // Assuming common key exists
                    placeholder={t('widgets.queueManagement.config.apiKeyPlaceholder', { serviceName })}
                    fullWidth
                    required
                    type='password'
                    helperText={t('widgets.queueManagement.config.apiKeyHelper', { serviceName })}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                        },
                        width: '100%',
                        minWidth: isMobile ? '65vw' : '20vw'
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: 'rgba(255, 255, 255, 0.7)' } }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label={t('forms.addEdit.fields.showLabel')}
                    name='showLabel'
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