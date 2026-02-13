import { Box, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement } from 'react-hook-form-mui';

import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { ITEM_TYPE } from '../../../types';
import { FormValues } from '../AddEditForm/types';

const TEMPERATURE_UNIT_OPTIONS = [
    { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
    { id: 'celsius', label: 'Celsius (°C)' }
];

const SYSTEM_MONITOR_GAUGE_OPTIONS = [
    { id: 'cpu', label: 'CPU Usage' },
    { id: 'temp', label: 'CPU Temperature' },
    { id: 'ram', label: 'RAM Usage' },
    { id: 'network', label: 'Network' },
    { id: 'none', label: 'None' }
];

interface SystemMonitorWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const SystemMonitorWidgetConfig = ({ formContext }: SystemMonitorWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const [networkInterfaces, setNetworkInterfaces] = useState<Array<{id: string, label: string}>>([]);

    // Watch the temperature unit directly from the form
    const watchedTemperatureUnit = formContext.watch('temperatureUnit');
    const [temperatureUnit, setTemperatureUnit] = useState<string>(() => {
        const currentValue = formContext.getValues('temperatureUnit');
        return typeof currentValue === 'string' ? currentValue : 'fahrenheit';
    });

    // Sync local state with form value when it changes
    useEffect(() => {
        if (typeof watchedTemperatureUnit === 'string') {
            setTemperatureUnit(watchedTemperatureUnit);
        }
    }, [watchedTemperatureUnit]);

    // Initialize temperature unit with default value if not set
    useEffect(() => {
        const currentValue = formContext.getValues('temperatureUnit');
        if (!currentValue || typeof currentValue !== 'string') {
            formContext.setValue('temperatureUnit', 'fahrenheit');
            setTemperatureUnit('fahrenheit');
        }
    }, [formContext]);

    const selectStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '.MuiSvgIcon-root ': {
                fill: theme.palette.text.primary,
            },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
        },
        width: '100%',
        minWidth: isMobile ? '65vw' : '20vw',
        '& .MuiMenuItem-root:hover': {
            backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
        },
        '& .MuiMenuItem-root.Mui-selected': {
            backgroundColor: `${'primary.main'} !important`,
            color: 'white',
        },
        '& .MuiMenuItem-root.Mui-selected:hover': {
            backgroundColor: `${'primary.main'} !important`,
            color: 'white',
        }
    };

    // Fetch network interfaces for system monitor widget
    useEffect(() => {
        const fetchNetworkInterfaces = async () => {
            try {
                const systemInfo = await DashApi.getSystemInformation();
                if (systemInfo && systemInfo.networkInterfaces && Array.isArray(systemInfo.networkInterfaces)) {
                    // Use all network interfaces from the backend without filtering
                    const interfaces = systemInfo.networkInterfaces.map((iface: { iface: string }) => ({
                        id: iface.iface,
                        label: iface.iface
                    }));

                    setNetworkInterfaces(interfaces);

                    // Get the current network interface value
                    const currentInterface = formContext.getValues('networkInterface');

                    if (!currentInterface) {
                        // No interface is currently selected, set one based on priority
                        const activeInterface = systemInfo.network?.iface;

                        if (activeInterface && interfaces.some((iface: { id: string }) => iface.id === activeInterface)) {
                            // Use active interface if available
                            formContext.setValue('networkInterface', activeInterface);
                        } else if (interfaces.length > 0) {
                            // Otherwise use the first available interface
                            formContext.setValue('networkInterface', interfaces[0].id);
                        }
                    } else if (!interfaces.some((iface: { id: string }) => iface.id === currentInterface)) {
                        // Current interface is invalid or not available, reset it
                        const activeInterface = systemInfo.network?.iface;

                        if (activeInterface && interfaces.some((iface: { id: string }) => iface.id === activeInterface)) {
                            // Use active interface if available
                            formContext.setValue('networkInterface', activeInterface);
                        } else if (interfaces.length > 0) {
                            // Otherwise use the first available interface
                            formContext.setValue('networkInterface', interfaces[0].id);
                        } else {
                            formContext.setValue('networkInterface', '');
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching network interfaces:', error);
                setNetworkInterfaces([]);
            }
        };

        fetchNetworkInterfaces();
    }, [
        formContext.watch('gauge1'),
        formContext.watch('gauge2'),
        formContext.watch('gauge3'),
        formContext
    ]);

    return (
        <>
            <Grid>
                <Box sx={{ mb: 2, mt: 1 }}>
                    <Typography
                        variant='body2'
                        sx={{
                            mb: 1,
                            ml: 1
                        }}
                    >
                        Temperature Unit:
                    </Typography>
                    <RadioGroup
                        name='temperatureUnit'
                        value={temperatureUnit}
                        onChange={(e) => {
                            setTemperatureUnit(e.target.value);
                            formContext.setValue('temperatureUnit', e.target.value);
                        }}
                        sx={{
                            flexDirection: 'row',
                            ml: 1,
                            '& .MuiFormControlLabel-label': {
                                color: 'white'
                            }
                        }}
                    >
                        {TEMPERATURE_UNIT_OPTIONS.map((option) => (
                            <FormControlLabel
                                key={option.id}
                                value={option.id}
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
                                label={option.label}
                            />
                        ))}
                    </RadioGroup>
                </Box>
            </Grid>
            <Grid>
                <SelectElement
                    label='Left Gauge'
                    name='gauge1'
                    options={SYSTEM_MONITOR_GAUGE_OPTIONS}
                    required
                    fullWidth
                    sx={selectStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <SelectElement
                    label='Middle Gauge'
                    name='gauge2'
                    options={SYSTEM_MONITOR_GAUGE_OPTIONS}
                    required
                    fullWidth
                    sx={selectStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <SelectElement
                    label='Right Gauge'
                    name='gauge3'
                    options={SYSTEM_MONITOR_GAUGE_OPTIONS}
                    required
                    fullWidth
                    sx={selectStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                {/* Network interface selection when a network gauge is selected */}
                {(formContext.watch('gauge1') === 'network' ||
                formContext.watch('gauge2') === 'network' ||
                formContext.watch('gauge3') === 'network') && (
                    <SelectElement
                        label='Network Interface'
                        name='networkInterface'
                        options={networkInterfaces.length > 0 ? networkInterfaces : [{ id: '', label: 'No network interfaces available' }]}
                        required
                        fullWidth
                        disabled={networkInterfaces.length === 0}
                        sx={{
                            ...selectStyling,
                            mt: 2
                        }}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />
                )}
            </Grid>

            <Grid>
                <Typography variant='h6' sx={{ color: 'text.primary', mb: 2, mt: 2 }}>
                    Display Options
                </Typography>
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show Disk Usage'
                    name='showDiskUsage'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show System Info Button'
                    name='showSystemInfo'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show Internet Status'
                    name='showInternetStatus'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show IP in Tooltip'
                    name='showIP'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            {formContext.watch('showIP') && (
                <Grid>
                    <SelectElement
                        label='IP Display Type'
                        name='ipDisplayType'
                        options={[
                            { id: 'wan', label: 'WAN (Public IP)' },
                            { id: 'lan', label: 'LAN (Local IP)' },
                            { id: 'both', label: 'Both WAN & LAN' }
                        ]}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />
                </Grid>
            )}
        </>
    );
};
