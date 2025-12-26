import { Grid2 as Grid, Typography } from '@mui/material';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

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
    const isMobile = useIsMobile();
    const servicePrefix = serviceName.toLowerCase(); // 'sonarr' or 'radarr'

    return (
        <>
            <Grid>
                <TextFieldElement
                    name={`${servicePrefix}Name`}
                    label='Display Name'
                    fullWidth
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
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
                    label='Host'
                    placeholder='localhost'
                    fullWidth
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
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
                    label='Port'
                    placeholder={defaultPort}
                    fullWidth
                    required
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
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
                    label='Use SSL'
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
                    label='API Key'
                    placeholder={`Enter your ${serviceName} API key`}
                    fullWidth
                    required
                    type='password'
                    helperText={`Find your API key in ${serviceName}: Settings → General → Security → API Key`}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
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
                    label='Show Label'
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
