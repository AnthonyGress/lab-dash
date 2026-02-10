import { Box, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { DateTimeWidgetConfig } from './DateTimeWidgetConfig';
import { DiskMonitorWidgetConfig } from './DiskMonitorWidgetConfig';
import { WeatherWidgetConfig } from './WeatherWidgetConfig';
import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { ITEM_TYPE } from '../../../types';
import { FormValues } from '../AddEditForm/types';

const WIDGET_OPTIONS = [
    { id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' },
    { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' },
    { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' },
    { id: ITEM_TYPE.DISK_MONITOR_WIDGET, label: 'Disk Monitor' },
    { id: ITEM_TYPE.PIHOLE_WIDGET, label: 'Pi-hole' },
    { id: ITEM_TYPE.ADGUARD_WIDGET, label: 'AdGuard Home' }
];

interface DualWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    existingItem?: any;
}

// State wrapper for top and bottom widget configs
interface WidgetState {
    topWidgetFields: Record<string, any>;
    bottomWidgetFields: Record<string, any>;
    activePosition: 'top' | 'bottom';
}

// Create a position-aware form context type
type PositionFormContext = Omit<UseFormReturn<FormValues>, 'register' | 'watch' | 'setValue' | 'getValues'> & {
    register: (name: string, options?: any) => any;
    watch: (name?: string) => any;
    setValue: (name: string, value: any, options?: any) => void;
    getValues: (name?: string) => any;
};

export const DualWidgetConfig = ({ formContext, existingItem }: DualWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const initializedRef = useRef(false);

    // State to track which position's config is currently being edited
    const [widgetState, setWidgetState] = useState<WidgetState>({
        topWidgetFields: {},
        bottomWidgetFields: {},
        activePosition: 'top'
    });

    // State to track current page - 0 for top, 1 for bottom
    const [currentPage, setCurrentPage] = useState(0);

    // Track widget types using state instead of formContext.watch to prevent re-renders
    const [topWidgetType, setTopWidgetType] = useState<string>('');
    const [bottomWidgetType, setBottomWidgetType] = useState<string>('');

    // Subscribe to widget type changes without causing re-renders
    useEffect(() => {
        const subscription = formContext.watch((value, { name }) => {
            if (name === 'topWidgetType') {
                setTopWidgetType(value.topWidgetType || '');
            }
            if (name === 'bottomWidgetType') {
                setBottomWidgetType(value.bottomWidgetType || '');
            }
        });
        return () => subscription.unsubscribe();
    }, [formContext]);

    // Initialize widget types from form values
    useEffect(() => {
        const currentTopType = formContext.getValues('topWidgetType');
        const currentBottomType = formContext.getValues('bottomWidgetType');
        if (currentTopType) setTopWidgetType(currentTopType);
        if (currentBottomType) setBottomWidgetType(currentBottomType);
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
            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
        },
        width: '100%',
        minWidth: isMobile ? '50vw' : '20vw',
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

    // Get position-specific field name
    const getFieldName = (position: 'top' | 'bottom', baseName: string): keyof FormValues => {
        return `${position}_${baseName}` as keyof FormValues;
    };

    // Initialize widget configs from existing data
    useEffect(() => {
        if (initializedRef.current) return;

        // Don't mark as initialized until we're done loading
        // This will prevent premature navigation between tabs

        // Initialize from existing item if editing
        const existingConfig = existingItem?.config || {};



        let topWidgetFields: Record<string, any> = {};
        let bottomWidgetFields: Record<string, any> = {};

        // Extract top widget configuration
        if (existingConfig.topWidget?.config) {
            const existingTopWidgetType = existingConfig.topWidget.type;
            const topConfig = existingConfig.topWidget.config;

            if (existingTopWidgetType) {
                formContext.setValue('topWidgetType', existingTopWidgetType);

                // Map configuration based on widget type
                if (existingTopWidgetType === ITEM_TYPE.WEATHER_WIDGET) {
                    topWidgetFields = {
                        temperatureUnit: topConfig.temperatureUnit || 'fahrenheit',
                        location: topConfig.location || null
                    };
                    formContext.setValue('top_temperatureUnit', topConfig.temperatureUnit || 'fahrenheit');
                    formContext.setValue('top_location', topConfig.location || null);
                }
                else if (existingTopWidgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
                    topWidgetFields = {
                        location: topConfig.location || null,
                        timezone: topConfig.timezone || ''
                    };
                    formContext.setValue('top_location', topConfig.location || null);
                    formContext.setValue('top_timezone', topConfig.timezone || '');
                }
                else if (existingTopWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                    const gauges = topConfig.gauges || ['cpu', 'temp', 'ram'];
                    topWidgetFields = {
                        temperatureUnit: topConfig.temperatureUnit || 'fahrenheit',
                        gauge1: gauges[0] || 'cpu',
                        gauge2: gauges[1] || 'temp',
                        gauge3: gauges[2] || 'ram',
                        networkInterface: topConfig.networkInterface || '',
                        showDiskUsage: topConfig.showDiskUsage !== false,
                        showSystemInfo: topConfig.showSystemInfo !== false,
                        showInternetStatus: topConfig.showInternetStatus !== false,
                        showIP: topConfig.showIP ?? topConfig.showPublicIP ?? false,
                        ipDisplayType: topConfig.ipDisplayType || 'wan'
                    };
                    formContext.setValue('top_temperatureUnit', topConfig.temperatureUnit || 'fahrenheit');
                    formContext.setValue('top_gauge1', gauges[0] || 'cpu');
                    formContext.setValue('top_gauge2', gauges[1] || 'temp');
                    formContext.setValue('top_gauge3', gauges[2] || 'ram');
                    formContext.setValue('top_networkInterface', topConfig.networkInterface || '');
                    formContext.setValue('top_showDiskUsage', topConfig.showDiskUsage !== false);
                    formContext.setValue('top_showSystemInfo', topConfig.showSystemInfo !== false);
                    formContext.setValue('top_showInternetStatus', topConfig.showInternetStatus !== false);
                    formContext.setValue('top_showIP', topConfig.showIP ?? topConfig.showPublicIP ?? false);
                    formContext.setValue('top_ipDisplayType', topConfig.ipDisplayType || 'wan');
                }
                else if (existingTopWidgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
                    topWidgetFields = {
                        selectedDisks: topConfig.selectedDisks || [],
                        showIcons: topConfig.showIcons !== false,
                        showName: topConfig.showName !== false,
                        layout: '2x2' // Force 2x2 for dual widgets
                    };
                    formContext.setValue('top_selectedDisks', topConfig.selectedDisks || []);
                    formContext.setValue('top_showIcons', topConfig.showIcons !== false);
                    formContext.setValue('top_showName', topConfig.showName !== false);
                    formContext.setValue('top_layout', '2x2');
                }
                else if (existingTopWidgetType === ITEM_TYPE.PIHOLE_WIDGET) {
                    // Use masked values for sensitive fields if they exist
                    const maskedApiToken = topConfig._hasApiToken ? '**********' : '';
                    const maskedPassword = topConfig._hasPassword ? '**********' : '';

                    topWidgetFields = {
                        piholeHost: topConfig.host || '',
                        piholePort: topConfig.port || '',
                        piholeSsl: topConfig.ssl || false,
                        piholeApiToken: maskedApiToken,
                        piholePassword: maskedPassword,
                        piholeName: topConfig.displayName || '',
                        showLabel: topConfig.showLabel !== undefined ? topConfig.showLabel : true
                    };
                    formContext.setValue('top_piholeHost', topConfig.host || '');
                    formContext.setValue('top_piholePort', topConfig.port !== undefined ? topConfig.port : '');
                    formContext.setValue('top_piholeSsl', topConfig.ssl || false);
                    formContext.setValue('top_piholeApiToken', maskedApiToken);
                    formContext.setValue('top_piholePassword', maskedPassword);
                    formContext.setValue('top_piholeName', topConfig.displayName || '');
                    formContext.setValue('top_showLabel', topConfig.showLabel !== undefined ? topConfig.showLabel : true);
                }
                else if (existingTopWidgetType === ITEM_TYPE.ADGUARD_WIDGET) {
                    // Use masked values for sensitive fields if they exist
                    const maskedUsername = topConfig._hasUsername ? '**********' : '';
                    const maskedPassword = topConfig._hasPassword ? '**********' : '';

                    topWidgetFields = {
                        adguardHost: topConfig.host || '',
                        adguardPort: topConfig.port || '80',
                        adguardSsl: topConfig.ssl || false,
                        adguardUsername: maskedUsername,
                        adguardPassword: maskedPassword,
                        adguardName: topConfig.displayName || '',
                        showLabel: topConfig.showLabel !== undefined ? topConfig.showLabel : true
                    };
                    formContext.setValue('top_adguardHost', topConfig.host || '');
                    formContext.setValue('top_adguardPort', topConfig.port !== undefined ? topConfig.port : '80');
                    formContext.setValue('top_adguardSsl', topConfig.ssl || false);
                    formContext.setValue('top_adguardUsername', maskedUsername);
                    formContext.setValue('top_adguardPassword', maskedPassword);
                    formContext.setValue('top_adguardName', topConfig.displayName || '');
                    formContext.setValue('top_showLabel', topConfig.showLabel !== undefined ? topConfig.showLabel : true);
                }
            }
        }

        // Extract bottom widget configuration
        if (existingConfig.bottomWidget?.config) {
            const existingBottomWidgetType = existingConfig.bottomWidget.type;
            const bottomConfig = existingConfig.bottomWidget.config;

            if (existingBottomWidgetType) {
                // Set the bottomWidgetType directly
                formContext.setValue('bottomWidgetType', existingBottomWidgetType);

                // Map configuration based on widget type
                if (existingBottomWidgetType === ITEM_TYPE.WEATHER_WIDGET) {
                    const temperatureUnit = bottomConfig.temperatureUnit || 'fahrenheit';
                    const location = bottomConfig.location || null;

                    bottomWidgetFields = {
                        temperatureUnit,
                        location
                    };

                    formContext.setValue('bottom_temperatureUnit', temperatureUnit);

                    // Special handling for location to ensure it's properly preserved
                    if (location) {
                        formContext.setValue('bottom_location', location);
                    } else {
                        formContext.setValue('bottom_location', null);
                    }
                }
                else if (existingBottomWidgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
                    const location = bottomConfig.location || null;
                    const timezone = bottomConfig.timezone || '';

                    bottomWidgetFields = {
                        location,
                        timezone
                    };

                    // Special handling for location to ensure it's properly preserved
                    if (location) {
                        formContext.setValue('bottom_location', location);
                    } else {
                        formContext.setValue('bottom_location', null);
                    }

                    formContext.setValue('bottom_timezone', timezone);
                }
                else if (existingBottomWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                    const gauges = bottomConfig.gauges || ['cpu', 'temp', 'ram'];
                    bottomWidgetFields = {
                        temperatureUnit: bottomConfig.temperatureUnit || 'fahrenheit',
                        gauge1: gauges[0] || 'cpu',
                        gauge2: gauges[1] || 'temp',
                        gauge3: gauges[2] || 'ram',
                        networkInterface: bottomConfig.networkInterface || '',
                        showDiskUsage: bottomConfig.showDiskUsage !== false,
                        showSystemInfo: bottomConfig.showSystemInfo !== false,
                        showInternetStatus: bottomConfig.showInternetStatus !== false,
                        showIP: bottomConfig.showIP ?? bottomConfig.showPublicIP ?? false,
                        ipDisplayType: bottomConfig.ipDisplayType || 'wan'
                    };
                    formContext.setValue('bottom_temperatureUnit', bottomConfig.temperatureUnit || 'fahrenheit');
                    formContext.setValue('bottom_gauge1', gauges[0] || 'cpu');
                    formContext.setValue('bottom_gauge2', gauges[1] || 'temp');
                    formContext.setValue('bottom_gauge3', gauges[2] || 'ram');
                    formContext.setValue('bottom_networkInterface', bottomConfig.networkInterface || '');
                    formContext.setValue('bottom_showDiskUsage', bottomConfig.showDiskUsage !== false);
                    formContext.setValue('bottom_showSystemInfo', bottomConfig.showSystemInfo !== false);
                    formContext.setValue('bottom_showInternetStatus', bottomConfig.showInternetStatus !== false);
                    formContext.setValue('bottom_showIP', bottomConfig.showIP ?? bottomConfig.showPublicIP ?? false);
                    formContext.setValue('bottom_ipDisplayType', bottomConfig.ipDisplayType || 'wan');
                }
                else if (existingBottomWidgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
                    bottomWidgetFields = {
                        selectedDisks: bottomConfig.selectedDisks || [],
                        showIcons: bottomConfig.showIcons !== false,
                        showName: bottomConfig.showName !== false,
                        layout: '2x2' // Force 2x2 for dual widgets
                    };
                    formContext.setValue('bottom_selectedDisks', bottomConfig.selectedDisks || []);
                    formContext.setValue('bottom_showIcons', bottomConfig.showIcons !== false);
                    formContext.setValue('bottom_showName', bottomConfig.showName !== false);
                    formContext.setValue('bottom_layout', '2x2');
                }
                else if (existingBottomWidgetType === ITEM_TYPE.PIHOLE_WIDGET) {
                    // Use masked values for sensitive fields if they exist
                    const maskedApiToken = bottomConfig._hasApiToken ? '**********' : '';
                    const maskedPassword = bottomConfig._hasPassword ? '**********' : '';

                    bottomWidgetFields = {
                        piholeHost: bottomConfig.host || '',
                        piholePort: bottomConfig.port || '',
                        piholeSsl: bottomConfig.ssl || false,
                        piholeApiToken: maskedApiToken,
                        piholePassword: maskedPassword,
                        piholeName: bottomConfig.displayName || '',
                        showLabel: bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true
                    };
                    formContext.setValue('bottom_piholeHost', bottomConfig.host || '');
                    formContext.setValue('bottom_piholePort', bottomConfig.port !== undefined ? bottomConfig.port : '');
                    formContext.setValue('bottom_piholeSsl', bottomConfig.ssl || false);
                    formContext.setValue('bottom_piholeApiToken', maskedApiToken);
                    formContext.setValue('bottom_piholePassword', maskedPassword);
                    formContext.setValue('bottom_piholeName', bottomConfig.displayName || '');
                    formContext.setValue('bottom_showLabel', bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true);
                }
                else if (existingBottomWidgetType === ITEM_TYPE.ADGUARD_WIDGET) {
                    // Use masked values for sensitive fields if they exist
                    const maskedUsername = bottomConfig._hasUsername ? '**********' : '';
                    const maskedPassword = bottomConfig._hasPassword ? '**********' : '';

                    bottomWidgetFields = {
                        adguardHost: bottomConfig.host || '',
                        adguardPort: bottomConfig.port || '80',
                        adguardSsl: bottomConfig.ssl || false,
                        adguardUsername: maskedUsername,
                        adguardPassword: maskedPassword,
                        adguardName: bottomConfig.displayName || '',
                        showLabel: bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true
                    };
                    formContext.setValue('bottom_adguardHost', bottomConfig.host || '');
                    formContext.setValue('bottom_adguardPort', bottomConfig.port !== undefined ? bottomConfig.port : '80');
                    formContext.setValue('bottom_adguardSsl', bottomConfig.ssl || false);
                    formContext.setValue('bottom_adguardUsername', maskedUsername);
                    formContext.setValue('bottom_adguardPassword', maskedPassword);
                    formContext.setValue('bottom_adguardName', bottomConfig.displayName || '');
                    formContext.setValue('bottom_showLabel', bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true);
                }
            }
        }

        // Initialize state with existing configurations
        setWidgetState({
            topWidgetFields,
            bottomWidgetFields,
            activePosition: 'top'
        });

        // Now mark as initialized
        initializedRef.current = true;

        // Add a delayed check to verify widget state after initialization
        setTimeout(() => {
            // Verification happens silently now
        }, 500);
    }, [existingItem]);

    // Apply saved fields to form
    const applyWidgetFieldsToForm = (position: 'top' | 'bottom', fields: Record<string, any>) => {
        // Apply fields based on widget type
        const widgetType = formContext.getValues(`${position}WidgetType`);

        if (widgetType && widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            // Handle temperature unit - ensure it has a default value
            const tempUnit = fields.temperatureUnit || 'fahrenheit';
            formContext.setValue(getFieldName(position, 'temperatureUnit'), tempUnit);

            // Handle location with special care
            try {
                if (fields.location !== undefined) {
                    formContext.setValue(getFieldName(position, 'location'), fields.location);
                }
            } catch (error) {
                console.error(`Error setting ${position} location`);
            }
        }
        else if (widgetType && widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
            try {
                if (fields.location !== undefined) {
                    formContext.setValue(getFieldName(position, 'location'), fields.location);
                }
            } catch (error) {
                console.error(`Error setting ${position} location`);
            }

            // Handle timezone
            if (fields.timezone !== undefined) {
                formContext.setValue(getFieldName(position, 'timezone'), fields.timezone);
            }

            // Handle use24Hour
            if (fields.use24Hour !== undefined) {
                formContext.setValue(getFieldName(position, 'use24Hour'), fields.use24Hour);
            }
        }
        else if (widgetType && widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            if (fields.temperatureUnit) {
                formContext.setValue(getFieldName(position, 'temperatureUnit'), fields.temperatureUnit);
            }

            if (fields.gauge1) {
                formContext.setValue(getFieldName(position, 'gauge1'), fields.gauge1);
            }

            if (fields.gauge2) {
                formContext.setValue(getFieldName(position, 'gauge2'), fields.gauge2);
            }

            if (fields.gauge3) {
                formContext.setValue(getFieldName(position, 'gauge3'), fields.gauge3);
            }

            if (fields.networkInterface !== undefined) {
                formContext.setValue(getFieldName(position, 'networkInterface'), fields.networkInterface);
            }
        }
        else if (widgetType && widgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
            if (fields.selectedDisks !== undefined) {
                formContext.setValue(getFieldName(position, 'selectedDisks'), fields.selectedDisks);
            }

            if (fields.showIcons !== undefined) {
                formContext.setValue(getFieldName(position, 'showIcons'), fields.showIcons);
            }

            if (fields.showName !== undefined) {
                formContext.setValue(getFieldName(position, 'showName'), fields.showName);
            }

            // Always force 2x2 layout for dual widgets
            formContext.setValue(getFieldName(position, 'layout'), '2x2');
        }
        else if (widgetType && widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
            if (fields.piholeHost !== undefined) {
                formContext.setValue(getFieldName(position, 'piholeHost'), fields.piholeHost);
            }

            if (fields.piholePort !== undefined) {
                formContext.setValue(getFieldName(position, 'piholePort'), fields.piholePort);
            }

            if (fields.piholeSsl !== undefined) {
                formContext.setValue(getFieldName(position, 'piholeSsl'), fields.piholeSsl);
            }

            if (fields.piholeApiToken !== undefined) {
                formContext.setValue(getFieldName(position, 'piholeApiToken'), fields.piholeApiToken);
            }

            if (fields.piholePassword !== undefined) {
                formContext.setValue(getFieldName(position, 'piholePassword'), fields.piholePassword);
            }

            if (fields.piholeName !== undefined) {
                formContext.setValue(getFieldName(position, 'piholeName'), fields.piholeName);
            }

            if (fields.showLabel !== undefined) {
                formContext.setValue(getFieldName(position, 'showLabel'), fields.showLabel);
            }
        }
        else if (widgetType && widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
            if (fields.adguardHost !== undefined) {
                formContext.setValue(getFieldName(position, 'adguardHost'), fields.adguardHost);
            }

            if (fields.adguardPort !== undefined) {
                formContext.setValue(getFieldName(position, 'adguardPort'), fields.adguardPort);
            }

            if (fields.adguardSsl !== undefined) {
                formContext.setValue(getFieldName(position, 'adguardSsl'), fields.adguardSsl);
            }

            if (fields.adguardUsername !== undefined) {
                formContext.setValue(getFieldName(position, 'adguardUsername'), fields.adguardUsername);
            }

            if (fields.adguardPassword !== undefined) {
                formContext.setValue(getFieldName(position, 'adguardPassword'), fields.adguardPassword);
            }

            if (fields.adguardName !== undefined) {
                formContext.setValue(getFieldName(position, 'adguardName'), fields.adguardName);
            }

            if (fields.showLabel !== undefined) {
                formContext.setValue(getFieldName(position, 'showLabel'), fields.showLabel);
            }
        }

        // Don't trigger validation here as it can cause flashing
        // formContext.trigger();
    };

    // Reset form fields to defaults for a position
    const resetFormFields = (position: 'top' | 'bottom') => {
        const widgetType = formContext.getValues(`${position}WidgetType`);
        if (!widgetType) return;

        let defaultFields: Record<string, any> = {};

        // Apply default fields based on widget type
        if (widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            defaultFields = {
                temperatureUnit: 'fahrenheit',
                location: null
            };
            formContext.setValue(getFieldName(position, 'temperatureUnit'), 'fahrenheit');
            formContext.setValue(getFieldName(position, 'location'), null);
        }
        else if (widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
            defaultFields = {
                location: null,
                timezone: '',
                use24Hour: false
            };
            formContext.setValue(getFieldName(position, 'location'), null);
            formContext.setValue(getFieldName(position, 'timezone'), '');
            formContext.setValue(getFieldName(position, 'use24Hour'), false);
        }
        else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            defaultFields = {
                temperatureUnit: 'fahrenheit',
                gauge1: 'cpu',
                gauge2: 'temp',
                gauge3: 'ram',
                networkInterface: '',
                showDiskUsage: true,
                showSystemInfo: true,
                showInternetStatus: true,
                showIP: false,
                ipDisplayType: 'wan'
            };
            formContext.setValue(getFieldName(position, 'temperatureUnit'), 'fahrenheit');
            formContext.setValue(getFieldName(position, 'gauge1'), 'cpu');
            formContext.setValue(getFieldName(position, 'gauge2'), 'temp');
            formContext.setValue(getFieldName(position, 'gauge3'), 'ram');
            formContext.setValue(getFieldName(position, 'networkInterface'), '');
            formContext.setValue(getFieldName(position, 'showDiskUsage'), true);
            formContext.setValue(getFieldName(position, 'showSystemInfo'), true);
            formContext.setValue(getFieldName(position, 'showInternetStatus'), true);
            formContext.setValue(getFieldName(position, 'showIP'), false);
            formContext.setValue(getFieldName(position, 'ipDisplayType'), 'wan');
        }
        else if (widgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
            defaultFields = {
                selectedDisks: [],
                showIcons: true,
                showName: true,
                layout: '2x2'
            };
            formContext.setValue(getFieldName(position, 'selectedDisks'), []);
            formContext.setValue(getFieldName(position, 'showIcons'), true);
            formContext.setValue(getFieldName(position, 'showName'), true);
            formContext.setValue(getFieldName(position, 'layout'), '2x2');
        }
        else if (widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
            defaultFields = {
                piholeHost: '',
                piholePort: '',
                piholeSsl: false,
                piholeApiToken: '',
                piholePassword: '',
                piholeName: '',
                showLabel: true
            };
            formContext.setValue(getFieldName(position, 'piholeHost'), '');
            formContext.setValue(getFieldName(position, 'piholePort'), '');
            formContext.setValue(getFieldName(position, 'piholeSsl'), false);
            formContext.setValue(getFieldName(position, 'piholeApiToken'), '');
            formContext.setValue(getFieldName(position, 'piholePassword'), '');
            formContext.setValue(getFieldName(position, 'piholeName'), '');
            formContext.setValue(getFieldName(position, 'showLabel'), true);
        }
        else if (widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
            defaultFields = {
                adguardHost: '',
                adguardPort: '80',
                adguardSsl: false,
                adguardUsername: '',
                adguardPassword: '',
                adguardName: '',
                showLabel: true
            };
            formContext.setValue(getFieldName(position, 'adguardHost'), '');
            formContext.setValue(getFieldName(position, 'adguardPort'), '80');
            formContext.setValue(getFieldName(position, 'adguardSsl'), false);
            formContext.setValue(getFieldName(position, 'adguardUsername'), '');
            formContext.setValue(getFieldName(position, 'adguardPassword'), '');
            formContext.setValue(getFieldName(position, 'adguardName'), '');
            formContext.setValue(getFieldName(position, 'showLabel'), true);
        }

        // Update widget state with default fields
        setWidgetState(prevState => ({
            ...prevState,
            [`${position}WidgetFields`]: { ...defaultFields }
        }));

        // Don't trigger validation here as it can cause flashing
        // formContext.trigger();
    };

    // Capture form values to state based on widget type
    const captureFormValuesToState = (position: 'top' | 'bottom') => {
        const widgetType = formContext.getValues(`${position}WidgetType`);
        if (!widgetType) return;

        const fields: Record<string, any> = {};

        if (widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            // Get temperature unit value
            const tempUnit = formContext.getValues(getFieldName(position, 'temperatureUnit'));
            fields.temperatureUnit = tempUnit || 'fahrenheit';

            // Get location data and ensure it has proper structure
            const locationValue = formContext.getValues(getFieldName(position, 'location'));

            // Ensure location object is properly structured
            if (locationValue && typeof locationValue === 'object' && 'name' in locationValue) {
                const locationObj = locationValue as {
                    name: string;
                    latitude: number | string;
                    longitude: number | string;
                };

                fields.location = {
                    name: locationObj.name || '',
                    latitude: typeof locationObj.latitude === 'number' ?
                        locationObj.latitude :
                        parseFloat(String(locationObj.latitude)) || 0,
                    longitude: typeof locationObj.longitude === 'number' ?
                        locationObj.longitude :
                        parseFloat(String(locationObj.longitude)) || 0
                };
            } else {
                fields.location = null;
            }
        }
        else if (widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
            // Get timezone value
            const timezone = formContext.getValues(getFieldName(position, 'timezone'));

            // Ensure timezone is properly stored as a string, never null
            fields.timezone = timezone || '';

            // Get use24Hour value
            const use24Hour = formContext.getValues(getFieldName(position, 'use24Hour'));
            fields.use24Hour = use24Hour || false;

            // Get location data and ensure it has proper structure
            const locationValue = formContext.getValues(getFieldName(position, 'location'));

            // Ensure location object is properly structured
            if (locationValue && typeof locationValue === 'object' && 'name' in locationValue) {
                const locationObj = locationValue as {
                    name: string;
                    latitude: number | string;
                    longitude: number | string;
                };

                fields.location = {
                    name: locationObj.name || '',
                    latitude: typeof locationObj.latitude === 'number' ?
                        locationObj.latitude :
                        parseFloat(String(locationObj.latitude)) || 0,
                    longitude: typeof locationObj.longitude === 'number' ?
                        locationObj.longitude :
                        parseFloat(String(locationObj.longitude)) || 0
                };
            } else {
                fields.location = null;
            }
        }
        else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            fields.temperatureUnit = formContext.getValues(getFieldName(position, 'temperatureUnit'));
            fields.gauge1 = formContext.getValues(getFieldName(position, 'gauge1'));
            fields.gauge2 = formContext.getValues(getFieldName(position, 'gauge2'));
            fields.gauge3 = formContext.getValues(getFieldName(position, 'gauge3'));
            fields.networkInterface = formContext.getValues(getFieldName(position, 'networkInterface'));
            fields.showDiskUsage = formContext.getValues(getFieldName(position, 'showDiskUsage'));
            fields.showSystemInfo = formContext.getValues(getFieldName(position, 'showSystemInfo'));
            fields.showInternetStatus = formContext.getValues(getFieldName(position, 'showInternetStatus'));
            fields.showIP = formContext.getValues(getFieldName(position, 'showIP'));
            fields.ipDisplayType = formContext.getValues(getFieldName(position, 'ipDisplayType'));
        }
        else if (widgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
            fields.selectedDisks = formContext.getValues(getFieldName(position, 'selectedDisks'));
            fields.showIcons = formContext.getValues(getFieldName(position, 'showIcons'));
            fields.showName = formContext.getValues(getFieldName(position, 'showName'));
            fields.layout = '2x2'; // Always 2x2 for dual widgets
        }
        else if (widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
            fields.piholeHost = formContext.getValues(getFieldName(position, 'piholeHost'));
            fields.piholePort = formContext.getValues(getFieldName(position, 'piholePort'));
            fields.piholeSsl = formContext.getValues(getFieldName(position, 'piholeSsl'));
            fields.piholeApiToken = formContext.getValues(getFieldName(position, 'piholeApiToken'));
            fields.piholePassword = formContext.getValues(getFieldName(position, 'piholePassword'));
            fields.piholeName = formContext.getValues(getFieldName(position, 'piholeName'));
            fields.showLabel = formContext.getValues(getFieldName(position, 'showLabel'));
        }
        else if (widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
            fields.adguardHost = formContext.getValues(getFieldName(position, 'adguardHost'));
            fields.adguardPort = formContext.getValues(getFieldName(position, 'adguardPort'));
            fields.adguardSsl = formContext.getValues(getFieldName(position, 'adguardSsl'));
            fields.adguardUsername = formContext.getValues(getFieldName(position, 'adguardUsername'));
            fields.adguardPassword = formContext.getValues(getFieldName(position, 'adguardPassword'));
            fields.adguardName = formContext.getValues(getFieldName(position, 'adguardName'));
            fields.showLabel = formContext.getValues(getFieldName(position, 'showLabel'));
        }

        // Update the state with captured values
        setWidgetState(prevState => {
            const newState = {
                ...prevState,
                [`${position}WidgetFields`]: { ...fields }
            };
            return newState;
        });
    };

    // Handle tab change (replacing handlePageChange)
    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        // Use the same logic as the original handlePageChange
        if (newValue !== currentPage) {
            // Capture current form values to state
            const currentPosition = currentPage === 0 ? 'top' : 'bottom';

            // Explicitly check for timezone values before switching tabs
            const currentWidgetType = currentPosition === 'top' ? topWidgetType : bottomWidgetType;
            if (currentWidgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
                const timezoneFieldName = getFieldName(currentPosition, 'timezone');
                const timezone = formContext.getValues(timezoneFieldName);

                // Explicitly set the timezone in the widget state
                setWidgetState(prevState => {
                    const positionKey = `${currentPosition}WidgetFields` as 'topWidgetFields' | 'bottomWidgetFields';
                    const updatedFields = {
                        ...prevState[positionKey],
                        timezone: timezone || ''
                    };

                    return {
                        ...prevState,
                        [positionKey]: updatedFields
                    };
                });
            }

            captureFormValuesToState(currentPosition);

            // Change the page
            setCurrentPage(newValue);

            // Update active position
            setWidgetState(prevState => ({
                ...prevState,
                activePosition: newValue === 0 ? 'top' : 'bottom'
            }));

            // Apply form values for the new position after a short delay
            setTimeout(() => {
                const newPosition = newValue === 0 ? 'top' : 'bottom';
                const fields = newPosition === 'top' ?
                    widgetState.topWidgetFields :
                    widgetState.bottomWidgetFields;

                // Apply the fields
                applyWidgetFieldsToForm(newPosition, fields);

                // Don't trigger validation during tab changes as it can cause flashing
                // formContext.trigger();
            }, 50);
        }
    };

    // Add a useEffect to sync form values with widget state when page changes
    useEffect(() => {
        const position = currentPage === 0 ? 'top' : 'bottom';
        const fields = position === 'top' ?
            widgetState.topWidgetFields :
            widgetState.bottomWidgetFields;

        if (fields && Object.keys(fields).length > 0) {
            // Just log the values, don't trigger more updates
            if (widgetState.activePosition !== position) {
                setTimeout(() => {
                    // Don't call applyWidgetFieldsToForm which calls formContext.trigger()
                    // Just directly apply critical fields if needed
                }, 100);
            }
        }
    }, [currentPage]); // Only depend on currentPage, not on widgetState which changes frequently

    // Watch for changes to widget types - use separate subscriptions to avoid triggering on every form change
    useEffect(() => {
        const subscription = formContext.watch((value, { name }) => {
            if (name === 'topWidgetType' && currentPage === 0 && value.topWidgetType) {
                // When top widget type changes, apply default values
                if (Object.keys(widgetState.topWidgetFields).length === 0) {
                    resetFormFields('top');
                }
            }

            if (name === 'bottomWidgetType' && currentPage === 1 && value.bottomWidgetType) {
                // When bottom widget type changes, apply default values
                if (Object.keys(widgetState.bottomWidgetFields).length === 0) {
                    resetFormFields('bottom');
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [currentPage, widgetState.topWidgetFields, widgetState.bottomWidgetFields]);

    // Save final configurations when form is submitted
    useEffect(() => {
        const handleFormSubmit = async () => {
            // Capture widget types immediately before they can be lost
            const currentTopWidgetType = formContext.getValues('topWidgetType');
            const currentBottomWidgetType = formContext.getValues('bottomWidgetType');

            // Grab the current page's state first
            const currentPosition = currentPage === 0 ? 'top' : 'bottom';
            captureFormValuesToState(currentPosition);

            // Ensure we capture both positions regardless of which page we're on
            captureFormValuesToState('top');
            captureFormValuesToState('bottom');

            // Build individual widget configs using captured types
            const topWidget = currentTopWidgetType ? await buildWidgetConfigWithType('top', currentTopWidgetType) : undefined;
            const bottomWidget = currentBottomWidgetType ? await buildWidgetConfigWithType('bottom', currentBottomWidgetType) : undefined;

            // Create the final dual widget config
            const dualWidgetConfig = {
                topWidget,
                bottomWidget
            };

            // Set the config value for submission
            (formContext as any).setValue('config', dualWidgetConfig);
        };

        // Add event listener to form submit
        const formElement = document.querySelector('form');
        if (formElement) {
            formElement.addEventListener('submit', handleFormSubmit);
            return () => {
                formElement.removeEventListener('submit', handleFormSubmit);
            };
        }
    }, [formContext, currentPage]); // Removed widgetState dependency to prevent unnecessary re-renders

    // Build widget config with explicit widget type (to avoid form reset issues)
    const buildWidgetConfigWithType = async (position: 'top' | 'bottom', widgetType: string) => {
        if (!widgetType) {
            return undefined;
        }

        return await buildWidgetConfigInternal(position, widgetType);
    };

    // Update buildWidgetConfig to not depend on active position state
    const buildWidgetConfig = async (position: 'top' | 'bottom') => {
        const widgetType = formContext.getValues(`${position}WidgetType`);
        if (!widgetType) {
            return undefined;
        }

        return await buildWidgetConfigInternal(position, widgetType);
    };

    // Internal function to build widget config with given type
    const buildWidgetConfigInternal = async (position: 'top' | 'bottom', widgetType: string) => {

        const fields = position === 'top' ?
            widgetState.topWidgetFields :
            widgetState.bottomWidgetFields;

        let config: Record<string, any> = {};

        if (widgetType === ITEM_TYPE.WEATHER_WIDGET) {
            // Get values directly from form for critical fields
            // Force get the temperature unit from the form directly
            const temperatureUnitField = getFieldName(position, 'temperatureUnit');
            const temperatureUnit = formContext.getValues(temperatureUnitField);

            // Get it from fields object as fallback
            const finalTempUnit = temperatureUnit || (fields && fields.temperatureUnit) || 'fahrenheit';

            const location = formContext.getValues(getFieldName(position, 'location'));

            // Ensure location has the correct structure
            let processedLocation = null;
            if (location && typeof location === 'object' && 'name' in location) {
                const locationObj = location as {
                    name: string;
                    latitude: number | string;
                    longitude: number | string;
                };

                processedLocation = {
                    name: locationObj.name || '',
                    latitude: typeof locationObj.latitude === 'number' ?
                        locationObj.latitude :
                        parseFloat(String(locationObj.latitude)) || 0,
                    longitude: typeof locationObj.longitude === 'number' ?
                        locationObj.longitude :
                        parseFloat(String(locationObj.longitude)) || 0
                };
            }

            config = {
                temperatureUnit: finalTempUnit,
                location: processedLocation
            };
        }
        else if (widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
            // Get location directly from form
            const location = formContext.getValues(getFieldName(position, 'location'));

            // Explicitly retrieve timezone with a fallback empty string
            const timezone = formContext.getValues(getFieldName(position, 'timezone')) || '';

            // Ensure location has the correct structure
            let processedLocation = null;
            if (location && typeof location === 'object' && 'name' in location) {
                const locationObj = location as {
                    name: string;
                    latitude: number | string;
                    longitude: number | string;
                };

                processedLocation = {
                    name: locationObj.name || '',
                    latitude: typeof locationObj.latitude === 'number' ?
                        locationObj.latitude :
                        parseFloat(String(locationObj.latitude)) || 0,
                    longitude: typeof locationObj.longitude === 'number' ?
                        locationObj.longitude :
                        parseFloat(String(locationObj.longitude)) || 0
                };
            }

            // Get use24Hour value
            const use24Hour = formContext.getValues(getFieldName(position, 'use24Hour')) || false;

            // Always include the timezone field, even if it's an empty string (never undefined or null)
            config = {
                location: processedLocation,
                timezone: timezone, // This is already guaranteed to be a string (empty if not set)
                use24Hour: use24Hour
            };
        }
        else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            // Get values directly from form for critical fields
            const temperatureUnit = formContext.getValues(getFieldName(position, 'temperatureUnit'));
            const gauge1 = formContext.getValues(getFieldName(position, 'gauge1'));
            const gauge2 = formContext.getValues(getFieldName(position, 'gauge2'));
            const gauge3 = formContext.getValues(getFieldName(position, 'gauge3'));
            const networkInterface = formContext.getValues(getFieldName(position, 'networkInterface'));
            const showDiskUsage = formContext.getValues(getFieldName(position, 'showDiskUsage'));
            const showSystemInfo = formContext.getValues(getFieldName(position, 'showSystemInfo'));
            const showInternetStatus = formContext.getValues(getFieldName(position, 'showInternetStatus'));
            const showIP = formContext.getValues(getFieldName(position, 'showIP'));
            const ipDisplayType = formContext.getValues(getFieldName(position, 'ipDisplayType'));

            config = {
                temperatureUnit: temperatureUnit || 'fahrenheit',
                gauges: [
                    gauge1 || fields.gauge1 || 'cpu',
                    gauge2 || fields.gauge2 || 'temp',
                    gauge3 || fields.gauge3 || 'ram'
                ],
                networkInterface: networkInterface || fields.networkInterface || '',
                showDiskUsage: showDiskUsage !== false,
                showSystemInfo: showSystemInfo !== false,
                showInternetStatus: showInternetStatus !== false,
                showIP: showIP || false,
                ipDisplayType: ipDisplayType || 'wan'
            };
        }
        else if (widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
            // Get values directly from form for critical fields
            const host = formContext.getValues(getFieldName(position, 'piholeHost'));
            const port = formContext.getValues(getFieldName(position, 'piholePort'));
            const ssl = formContext.getValues(getFieldName(position, 'piholeSsl'));
            const apiToken = formContext.getValues(getFieldName(position, 'piholeApiToken'));
            const password = formContext.getValues(getFieldName(position, 'piholePassword'));
            const displayName = formContext.getValues(getFieldName(position, 'piholeName'));
            const showLabel = formContext.getValues(getFieldName(position, 'showLabel'));



            // Check if we have existing sensitive data from the original config
            let hasExistingApiToken = false;
            let hasExistingPassword = false;

            // For dual widgets, we need to check the position-specific config
            if (existingItem && existingItem.config) {
                const dualConfig = existingItem.config;
                const positionWidget = position === 'top' ? dualConfig.topWidget : dualConfig.bottomWidget;
                if (positionWidget?.config) {
                    hasExistingApiToken = !!positionWidget.config._hasApiToken;
                    hasExistingPassword = !!positionWidget.config._hasPassword;
                }
            }

            // Also check if the current form values are masked (indicating existing data)
            if (apiToken === '**********') {
                hasExistingApiToken = true;
            }
            if (password === '**********') {
                hasExistingPassword = true;
            }



            // Base configuration
            const configObj: any = {
                host: host || '',
                port: port || '',
                ssl: ssl || false,
                displayName: displayName || '',
                showLabel: showLabel !== undefined ? showLabel : true
            };

            // Handle credential encryption - only encrypt if not masked
            let encryptedApiToken = '';
            let encryptedPassword = '';

            // Only process API token if it's not the masked value
            if (apiToken && typeof apiToken === 'string' && apiToken !== '**********') {
                try {
                    encryptedApiToken = await DashApi.encryptPiholeToken(apiToken);
                } catch (error) {
                    console.error('Error encrypting Pi-hole API token:', error);
                }
            }

            // Only process password if it's not the masked value
            if (password && typeof password === 'string' && password !== '**********') {
                try {
                    encryptedPassword = await DashApi.encryptPiholePassword(password);
                } catch (error) {
                    console.error('Error encrypting Pi-hole password:', error);
                }
            }

            // Include encrypted credentials if they were provided
            if (encryptedApiToken) {
                configObj.apiToken = encryptedApiToken;
            } else if (hasExistingApiToken) {
                // If we have an existing API token but no new token provided, set the flag
                configObj._hasApiToken = true;
            }

            if (encryptedPassword) {
                configObj.password = encryptedPassword;
            } else if (hasExistingPassword) {
                // If we have an existing password but no new password provided, set the flag
                configObj._hasPassword = true;
            }
            config = configObj;
        }
        else if (widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
            // Get values directly from form for critical fields
            const host = formContext.getValues(getFieldName(position, 'adguardHost'));
            const port = formContext.getValues(getFieldName(position, 'adguardPort'));
            const ssl = formContext.getValues(getFieldName(position, 'adguardSsl'));
            const username = formContext.getValues(getFieldName(position, 'adguardUsername'));
            const password = formContext.getValues(getFieldName(position, 'adguardPassword'));
            const displayName = formContext.getValues(getFieldName(position, 'adguardName'));
            const showLabel = formContext.getValues(getFieldName(position, 'showLabel'));

            // Check if we have existing sensitive data from the original config
            let hasExistingUsername = false;
            let hasExistingPassword = false;

            // For dual widgets, we need to check the position-specific config
            if (existingItem && existingItem.config) {
                const dualConfig = existingItem.config;
                const positionWidget = position === 'top' ? dualConfig.topWidget : dualConfig.bottomWidget;
                if (positionWidget?.config) {
                    hasExistingUsername = !!positionWidget.config._hasUsername;
                    hasExistingPassword = !!positionWidget.config._hasPassword;
                }
            }

            // Also check if the current form values are masked (indicating existing data)
            if (username === '**********') {
                hasExistingUsername = true;
            }
            if (password === '**********') {
                hasExistingPassword = true;
            }

            // Handle credential encryption - only encrypt if not masked
            let encryptedUsername = '';
            let encryptedPassword = '';

            // Only process username if it's not the masked value
            if (username && typeof username === 'string' && username !== '**********') {
                try {
                    encryptedUsername = await DashApi.encryptAdGuardUsername(username);
                } catch (error) {
                    console.error('Error encrypting AdGuard username:', error);
                }
            }

            // Only process password if it's not the masked value
            if (password && typeof password === 'string' && password !== '**********') {
                try {
                    encryptedPassword = await DashApi.encryptAdGuardPassword(password);
                } catch (error) {
                    console.error('Error encrypting AdGuard password:', error);
                }
            }

            // Base configuration
            const configObj: any = {
                host: host || '',
                port: port || '80',
                ssl: ssl || false,
                displayName: displayName || '',
                showLabel: showLabel !== undefined ? showLabel : true
            };

            // Include encrypted credentials if they were provided
            if (encryptedUsername && encryptedPassword) {
                configObj.username = encryptedUsername;
                configObj.password = encryptedPassword;
            } else {
                // If we have existing credentials but no new ones provided, set the flags
                if (hasExistingUsername) {
                    configObj._hasUsername = true;
                }
                if (hasExistingPassword) {
                    configObj._hasPassword = true;
                }
            }
            config = configObj;
        }
        else if (widgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
            // Get values directly from form for critical fields
            const selectedDisks = formContext.getValues(getFieldName(position, 'selectedDisks')) as Array<{ mount: string; customName: string; showMountPath?: boolean }> | undefined;
            const showIcons = formContext.getValues(getFieldName(position, 'showIcons'));
            const showName = formContext.getValues(getFieldName(position, 'showName'));

            // Validate that at least one disk is selected
            if (!selectedDisks || !Array.isArray(selectedDisks) || selectedDisks.length === 0) {
                formContext.setError(getFieldName(position, 'selectedDisks'), {
                    type: 'required',
                    message: 'At least one disk must be selected'
                });
                throw new Error(`At least one disk must be selected for ${position} widget`);
            }

            config = {
                selectedDisks: selectedDisks || [],
                showIcons: showIcons !== false,
                showName: showName !== false,
                layout: '2x2' // Always 2x2 for dual widgets
            };
        }

        return {
            type: widgetType,
            config
        };
    };

    // When active position changes, update the form
    useEffect(() => {
        const position = widgetState.activePosition;
        const fields = position === 'top' ?
            widgetState.topWidgetFields :
            widgetState.bottomWidgetFields;

        applyWidgetFieldsToForm(position, fields);
    }, [widgetState.activePosition]);

    // Create position-aware wrappers for each widget configuration component
    const createPositionedFormContext = (position: 'top' | 'bottom'): PositionFormContext => {
        return {
            ...formContext,
            register: (name: string, options?: any) => {
                const fieldName = getFieldName(position, name);
                return formContext.register(fieldName, options);
            },
            watch: (name?: string) => {
                if (!name) return formContext.watch();
                const fieldName = getFieldName(position, name);
                return formContext.watch(fieldName);
            },
            setValue: (name: string, value: any, options?: any) => {
                const fieldName = getFieldName(position, name);
                return formContext.setValue(fieldName, value, options);
            },
            getValues: (name?: string) => {
                if (!name) return formContext.getValues();
                const fieldName = getFieldName(position, name);
                return formContext.getValues(fieldName);
            }
        };
    };

    // Create a special location-aware context for the WeatherWidgetConfig
    const createLocationAwareContext = (position: 'top' | 'bottom'): PositionFormContext => {
        const baseContext = createPositionedFormContext(position);
        return {
            ...baseContext,
            setValue: (name: string, value: any, options?: any) => {
                if (name === 'location') {
                    return formContext.setValue(getFieldName(position, 'location'), value, options);
                }
                else if (name === 'temperatureUnit') {
                    formContext.setValue(getFieldName(position, 'temperatureUnit'), value, options);

                    // Also update the widgetState directly to keep everything in sync
                    setWidgetState(prevState => {
                        const positionKey = `${position}WidgetFields` as 'topWidgetFields' | 'bottomWidgetFields';
                        return {
                            ...prevState,
                            [positionKey]: {
                                ...prevState[positionKey],
                                temperatureUnit: value
                            }
                        };
                    });

                    return undefined; // setValue doesn't expect a return value
                }
                return baseContext.setValue(name, value, options);
            },
            watch: (name?: string) => {
                if (name === 'location') {
                    return formContext.watch(getFieldName(position, 'location'));
                }
                else if (name === 'temperatureUnit') {
                    const fieldValue = formContext.watch(getFieldName(position, 'temperatureUnit'));
                    return fieldValue || 'fahrenheit';
                }
                return baseContext.watch(name);
            },
            getValues: (name?: string) => {
                if (name === 'location') {
                    return formContext.getValues(getFieldName(position, 'location'));
                }
                else if (name === 'temperatureUnit') {
                    const fieldValue = formContext.getValues(getFieldName(position, 'temperatureUnit'));
                    return fieldValue || 'fahrenheit';
                }
                return baseContext.getValues(name);
            }
        };
    };

    // Create a custom component for System Monitor fields to properly use hooks
    const SystemMonitorFields = ({ position }: { position: 'top' | 'bottom' }) => {
        // Access the widget state and form context from parent component
        const fields = position === 'top' ?
            widgetState.topWidgetFields :
            widgetState.bottomWidgetFields;

        // Store field names in variables to ensure stability
        const gauge1FieldName = getFieldName(position, 'gauge1');
        const gauge2FieldName = getFieldName(position, 'gauge2');
        const gauge3FieldName = getFieldName(position, 'gauge3');
        const networkInterfaceFieldName = getFieldName(position, 'networkInterface');
        const temperatureUnitFieldName = getFieldName(position, 'temperatureUnit');

        // Watch the temperature unit directly from the form
        const watchedTemperatureUnit = formContext.watch(temperatureUnitFieldName);
        const [temperatureUnit, setTemperatureUnit] = useState<string>(() => {
            const currentValue = formContext.getValues(temperatureUnitFieldName);
            return typeof currentValue === 'string' ? currentValue : 'fahrenheit';
        });

        // Sync local state with form value when it changes
        useEffect(() => {
            if (typeof watchedTemperatureUnit === 'string') {
                setTemperatureUnit(watchedTemperatureUnit);
            }
        }, [watchedTemperatureUnit]);

        // State for network interfaces
        const [networkInterfaces, setNetworkInterfaces] = useState<Array<{id: string, label: string}>>([]);

        // Immediately check form values for pre-existing network gauge selections
        const initialGauge1 = formContext.getValues(gauge1FieldName);
        const initialGauge2 = formContext.getValues(gauge2FieldName);
        const initialGauge3 = formContext.getValues(gauge3FieldName);

        // Use state to store the gauge values locally
        const [gaugeValues, setGaugeValues] = useState({
            gauge1: initialGauge1 || 'cpu',
            gauge2: initialGauge2 || 'temp',
            gauge3: initialGauge3 || 'ram'
        });

        // Force immediate network interface field display if any gauge is already set to network
        const [shouldShowNetworkField, setShouldShowNetworkField] = useState(() => {
            const hasNetworkGauge =
                initialGauge1 === 'network' ||
                initialGauge2 === 'network' ||
                initialGauge3 === 'network';

            return hasNetworkGauge;
        });

        // Check if any gauge is currently set to network
        const isNetworkSelected =
            gaugeValues.gauge1 === 'network' ||
            gaugeValues.gauge2 === 'network' ||
            gaugeValues.gauge3 === 'network';

        // Update the network field display state whenever gauge values change
        useEffect(() => {
            setShouldShowNetworkField(isNetworkSelected);
        }, [gaugeValues.gauge1, gaugeValues.gauge2, gaugeValues.gauge3]);

        // Handler for gauge changes
        const handleGaugeChange = (gauge: string) => (event: any) => {
            // Safely access value from event
            const value = event?.target?.value || event;
            if (!value) return;

            // Update form value
            const fieldName = getFieldName(position, gauge);
            formContext.setValue(fieldName, value);

            // Update local state
            setGaugeValues(prev => ({
                ...prev,
                [gauge]: value
            }));
        };

        // Fetch network interfaces immediately when component mounts or network is selected
        useEffect(() => {
            if (shouldShowNetworkField) {
                const fetchNetworkInterfaces = async () => {
                    try {
                        const systemInfo = await DashApi.getSystemInformation();
                        if (systemInfo && systemInfo.networkInterfaces && Array.isArray(systemInfo.networkInterfaces)) {
                            const interfaces = systemInfo.networkInterfaces.map((iface: { iface: string }) => ({
                                id: iface.iface,
                                label: iface.iface
                            }));

                            setNetworkInterfaces(interfaces);

                            // Get the current network interface value from form
                            const currentInterface = formContext.getValues(networkInterfaceFieldName);

                            // If there's no current interface selected but we need one, set it
                            if (!currentInterface && interfaces.length > 0) {
                                const activeInterface = systemInfo.network?.iface;

                                if (activeInterface && interfaces.some((iface: { id: string }) => iface.id === activeInterface)) {
                                    formContext.setValue(networkInterfaceFieldName, activeInterface);
                                } else {
                                    formContext.setValue(networkInterfaceFieldName, interfaces[0].id);
                                }
                            }
                        }
                    } catch (error) {
                        setNetworkInterfaces([]);
                    }
                };

                fetchNetworkInterfaces();
            }
        }, [shouldShowNetworkField]);

        return (
            <>
                {/* Temperature Unit Radio Buttons */}
                <Box sx={{ mb: 2, mt: 1 }}>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'white',
                            mb: 1,
                            ml: 1
                        }}
                    >
                        Temperature Unit:
                    </Typography>
                    <RadioGroup
                        name={temperatureUnitFieldName}
                        value={temperatureUnit}
                        onChange={(e) => {
                            setTemperatureUnit(e.target.value);
                            formContext.setValue(temperatureUnitFieldName, e.target.value);
                        }}
                        sx={{
                            flexDirection: 'row',
                            ml: 1,
                            '& .MuiFormControlLabel-label': {
                                color: 'white'
                            }
                        }}
                    >
                        <FormControlLabel
                            value='fahrenheit'
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
                            label='Fahrenheit (°F)'
                        />
                        <FormControlLabel
                            value='celsius'
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
                            label='Celsius (°C)'
                        />
                    </RadioGroup>
                </Box>

                <Box sx={{ mt: 2 }}>
                    <SelectElement
                        label='Left Gauge'
                        name={gauge1FieldName}
                        options={[
                            { id: 'cpu', label: 'CPU Usage' },
                            { id: 'temp', label: 'CPU Temperature' },
                            { id: 'ram', label: 'RAM Usage' },
                            { id: 'network', label: 'Network' },
                            { id: 'none', label: 'None' }
                        ]}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                        onChange={handleGaugeChange('gauge1')}
                        value={gaugeValues.gauge1}
                    />
                </Box>
                <Box sx={{ mt: 2 }}>
                    <SelectElement
                        label='Middle Gauge'
                        name={gauge2FieldName}
                        options={[
                            { id: 'cpu', label: 'CPU Usage' },
                            { id: 'temp', label: 'CPU Temperature' },
                            { id: 'ram', label: 'RAM Usage' },
                            { id: 'network', label: 'Network' },
                            { id: 'none', label: 'None' }
                        ]}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                        onChange={handleGaugeChange('gauge2')}
                        value={gaugeValues.gauge2}
                    />
                </Box>
                <Box sx={{ mt: 2 }}>
                    <SelectElement
                        label='Right Gauge'
                        name={gauge3FieldName}
                        options={[
                            { id: 'cpu', label: 'CPU Usage' },
                            { id: 'temp', label: 'CPU Temperature' },
                            { id: 'ram', label: 'RAM Usage' },
                            { id: 'network', label: 'Network' },
                            { id: 'none', label: 'None' }
                        ]}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                        onChange={handleGaugeChange('gauge3')}
                        value={gaugeValues.gauge3}
                    />
                </Box>

                {/* Network Interface Selection - use shouldShowNetworkField for initial render */}
                {shouldShowNetworkField && (
                    <Box sx={{ mt: 2 }}>
                        <SelectElement
                            label='Network Interface'
                            name={networkInterfaceFieldName}
                            options={networkInterfaces.length > 0 ? networkInterfaces : [{ id: '', label: 'No network interfaces available' }]}
                            required
                            fullWidth
                            disabled={networkInterfaces.length === 0}
                            sx={selectStyling}
                            slotProps={{
                                inputLabel: { style: { color: theme.palette.text.primary } }
                            }}
                        />
                    </Box>
                )}

                {/* Display Options */}
                <Box sx={{ mt: 3, mb: 2 }}>
                    <Typography variant='h6' sx={{ color: 'text.primary', mb: 2 }}>
                        Display Options
                    </Typography>
                </Box>

                <Box sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Show Disk Usage'
                        name={getFieldName(position, 'showDiskUsage')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Box>

                <Box sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Show System Info Button'
                        name={getFieldName(position, 'showSystemInfo')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Box>

                <Box sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Show Internet Status'
                        name={getFieldName(position, 'showInternetStatus')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Box>

                <Box sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Show IP in Tooltip'
                        name={getFieldName(position, 'showIP')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Box>

                {formContext.watch(getFieldName(position, 'showIP')) && (
                    <Box sx={{ width: '100%', mb: 2 }}>
                        <SelectElement
                            label='IP Display Type'
                            name={getFieldName(position, 'ipDisplayType')}
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
                    </Box>
                )}
            </>
        );
    };

    // Create a custom wrapper for WeatherWidgetConfig to ensure temperature unit is properly set
    const WeatherConfigWrapper = ({ position }: { position: 'top' | 'bottom' }) => {
        // Create a context with only location handling, we'll handle temperature ourselves
        const positionContext = createLocationAwareContext(position);

        // Create local state that tracks the temperature unit value
        const [tempUnit, setTempUnit] = useState(() => {
            const value = formContext.getValues(getFieldName(position, 'temperatureUnit')) || 'fahrenheit';
            return value as string;
        });

        // Handle temperature unit change
        const handleTempUnitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = event.target.value as string;

            // Update local state
            setTempUnit(newValue);

            // Update form context
            formContext.setValue(getFieldName(position, 'temperatureUnit'), newValue);

            // Update widget state
            setWidgetState(prev => {
                const positionKey = `${position}WidgetFields` as 'topWidgetFields' | 'bottomWidgetFields';
                return {
                    ...prev,
                    [positionKey]: {
                        ...prev[positionKey],
                        temperatureUnit: newValue
                    }
                };
            });
        };

        // Create a modified version of formContext for WeatherWidgetConfig that omits temperature unit handling
        const modifiedContext = {
            ...positionContext,
            // Override register to not handle temperatureUnit
            register: (name: string, options?: any) => {
                if (name === 'temperatureUnit') {
                    // Return a dummy registration that won't be used
                    return { name: 'dummy' };
                }
                return positionContext.register(name, options);
            },
            // Override setValue to not handle temperatureUnit
            setValue: (name: string, value: any, options?: any) => {
                if (name === 'temperatureUnit') {
                    return; // Don't do anything, we handle it ourselves
                }
                return positionContext.setValue(name, value, options);
            },
            // Override watch to not watch temperatureUnit
            watch: (name?: string) => {
                if (name === 'temperatureUnit') {
                    return tempUnit;
                }
                return positionContext.watch(name);
            },
            // Override getValues to not get temperatureUnit
            getValues: (name?: string) => {
                if (name === 'temperatureUnit') {
                    return tempUnit;
                }
                return positionContext.getValues(name);
            }
        };

        return (
            <Box sx={{ width: '100%' }}>
                {/* Our own temperature unit selector using radio buttons */}
                <Box sx={{ mb: 2, mt: 1 }}>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'white',
                            mb: 1,
                            ml: 1
                        }}
                    >
                        Temperature Unit:
                    </Typography>
                    <RadioGroup
                        name={getFieldName(position, 'temperatureUnit')}
                        value={tempUnit}
                        onChange={handleTempUnitChange}
                        sx={{
                            flexDirection: 'row',
                            ml: 1,
                            '& .MuiFormControlLabel-label': {
                                color: 'white'
                            }
                        }}
                    >
                        <FormControlLabel
                            value='fahrenheit'
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
                            label='Fahrenheit (°F)'
                        />
                        <FormControlLabel
                            value='celsius'
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
                            label='Celsius (°C)'
                        />
                    </RadioGroup>
                </Box>

                {/* Pass only the location handling to WeatherWidgetConfig */}
                <Box sx={{ '& .MuiGrid2-root:first-of-type': { display: 'none' } }}>
                    <WeatherWidgetConfig formContext={modifiedContext as any} />
                </Box>
            </Box>
        );
    };

    // Wrapper for DateTime widget config with position-specific field names
    const DateTimeConfigWrapper = ({ position }: { position: 'top' | 'bottom' }) => {
        // Wrap with consistent styling to match single widget display
        return (
            <Box sx={{ width: '100%' }}>
                <DateTimeWidgetConfig
                    formContext={formContext as any}
                    fieldNamePrefix={position === 'top' ? 'top_' : 'bottom_'}
                />
            </Box>
        );
    };

    // Create a custom wrapper for PiholeWidgetConfig to ensure API token and password fields work correctly
    const PiholeConfigWrapper = ({ position }: { position: 'top' | 'bottom' }) => {
        // Track field values with local state
        const [host, setHost] = useState('');
        const [port, setPort] = useState('');
        const [apiToken, setApiToken] = useState('');
        const [password, setPassword] = useState('');
        const [formInitialized, setFormInitialized] = useState(false);

        // Track if we have existing sensitive data (similar to regular PiholeWidgetConfig)
        const [hasExistingApiToken, setHasExistingApiToken] = useState(false);
        const [hasExistingPassword, setHasExistingPassword] = useState(false);

        // Field names for easier reference
        const hostField = getFieldName(position, 'piholeHost');
        const portField = getFieldName(position, 'piholePort');
        const apiTokenField = getFieldName(position, 'piholeApiToken');
        const passwordField = getFieldName(position, 'piholePassword');

        // Initialize masked values for existing items (similar to regular PiholeWidgetConfig)
        useEffect(() => {
            if (existingItem?.config) {
                const dualConfig = existingItem.config;
                const positionWidget = position === 'top' ? dualConfig.topWidget : dualConfig.bottomWidget;

                if (positionWidget?.config) {
                    const config = positionWidget.config;

                    // Check if existing item has sensitive data using security flags
                    if (config._hasApiToken) {
                        setHasExistingApiToken(true);
                        // Set masked value in form if not already set
                        const currentApiToken = formContext.getValues(apiTokenField);
                        if (!currentApiToken) {
                            formContext.setValue(apiTokenField, '**********');
                            setApiToken('**********');
                        } else {
                            setApiToken(typeof currentApiToken === 'string' ? currentApiToken : '');
                        }
                    }

                    if (config._hasPassword) {
                        setHasExistingPassword(true);
                        // Set masked value in form if not already set
                        const currentPassword = formContext.getValues(passwordField);
                        if (!currentPassword) {
                            formContext.setValue(passwordField, '**********');
                            setPassword('**********');
                        } else {
                            setPassword(typeof currentPassword === 'string' ? currentPassword : '');
                        }
                    }
                }
            }
        }, [existingItem, position, apiTokenField, passwordField]);

        // Initialize the component with values from the form
        useEffect(() => {
            if (formInitialized) return;

            // Get initial values from form context
            const initialHost = formContext.getValues(hostField);
            const initialPort = formContext.getValues(portField);
            const initialApiToken = formContext.getValues(apiTokenField);
            const initialPassword = formContext.getValues(passwordField);

            // Convert to strings, handling any non-string values
            const hostStr = typeof initialHost === 'string' ? initialHost : '';
            const portStr = typeof initialPort === 'string' ? initialPort : '';
            // For sensitive fields, use the values as they are (already masked from form initialization)
            const tokenStr = typeof initialApiToken === 'string' ? initialApiToken : '';
            const passwordStr = typeof initialPassword === 'string' ? initialPassword : '';

            // Set local state
            setHost(hostStr);
            setPort(portStr);

            // Handle mutual exclusivity for token/password at initialization
            // Only clear if both are non-masked values
            if (tokenStr && passwordStr && tokenStr !== '**********' && passwordStr !== '**********') {
                // If both have non-masked values, prioritize the token
                formContext.setValue(apiTokenField, tokenStr);
                formContext.setValue(passwordField, '');
                setApiToken(tokenStr);
                setPassword('');
            } else {
                // Otherwise use whatever values we have (including masked values)
                setApiToken(tokenStr);
                setPassword(passwordStr);
            }

            // Clear any validation errors since we've just loaded the values
            formContext.clearErrors(hostField);
            formContext.clearErrors(portField);
            formContext.clearErrors(apiTokenField);
            formContext.clearErrors(passwordField);

            // Mark as initialized so we don't run this again
            setFormInitialized(true);
        }, [hostField, portField, apiTokenField, passwordField, formInitialized]);

        // Handle host change
        const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setHost(newValue);
            formContext.setValue(hostField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });
            formContext.clearErrors(hostField);
        };

        // Handle port change
        const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setPort(newValue);
            formContext.setValue(portField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });
            formContext.clearErrors(portField);
        };

        // Handle API token change
        const handleApiTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;

            setApiToken(newValue);
            formContext.setValue(apiTokenField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });

            // If token has a non-masked value, clear password and its validation errors
            if (newValue && newValue !== '**********') {
                setPassword('');
                formContext.setValue(passwordField, '', {
                    shouldValidate: false,
                    shouldDirty: true
                });
                formContext.clearErrors(passwordField);
            }

            // Clear validation errors on this field
            formContext.clearErrors(apiTokenField);
        };

        // Handle password change
        const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;

            setPassword(newValue);
            formContext.setValue(passwordField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });

            // If password has a non-masked value, clear token and its validation errors
            if (newValue && newValue !== '**********') {
                setApiToken('');
                formContext.setValue(apiTokenField, '', {
                    shouldValidate: false,
                    shouldDirty: true
                });
                formContext.clearErrors(apiTokenField);
            }

            // Clear validation errors on this field
            formContext.clearErrors(passwordField);
        };

        // Clear validation errors when component unmounts to prevent stale errors
        useEffect(() => {
            return () => {
                formContext.clearErrors(hostField);
                formContext.clearErrors(portField);
                formContext.clearErrors(apiTokenField);
                formContext.clearErrors(passwordField);
            };
        }, [hostField, portField, apiTokenField, passwordField]);

        // Return the custom form with our controlled inputs
        return (
            <Box sx={{ width: '100%' }}>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextField
                        name={hostField}
                        label='Pi-hole Host'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required
                        value={host}
                        onChange={handleHostChange}
                        error={!host}
                        helperText={!host ? 'Host is required' : ''}
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 0, 0, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextField
                        name={portField}
                        label='Port'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required
                        value={port}
                        onChange={handlePortChange}
                        error={!port}
                        helperText={!port ? 'Port is required' : ''}
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 0, 0, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextFieldElement
                        name={getFieldName(position, 'piholeName')}
                        label='Display Name'
                        variant='outlined'
                        placeholder='Pi-hole'
                        fullWidth
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
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
                <Grid sx={{ width: '100%', mb: 2 }}>
                    {/* Use a regular TextField for better control */}
                    <TextField
                        name={apiTokenField}
                        label='API Token (Pi-hole v5)'
                        type='password'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required={!password && !hasExistingApiToken}
                        disabled={Boolean(password && password !== '**********')}
                        error={!apiToken && !password && !hasExistingApiToken && !hasExistingPassword}
                        value={apiToken}
                        onChange={handleApiTokenChange}
                        helperText={
                            password && password !== '**********' ? 'Password already provided' :
                                hasExistingApiToken && apiToken === '**********' ? 'Current API token is set (shown as ********). Clear field to remove or enter new token to replace.' :
                                    !apiToken && !password && !hasExistingApiToken && !hasExistingPassword ? 'Enter API token or password below' :
                                        'Enter the API token from Pi-hole Settings > API/Web interface'
                        }
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    {/* Use a regular TextField for better control */}
                    <TextField
                        name={passwordField}
                        label='Password (Pi-hole v6)'
                        type='password'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required={!apiToken && !hasExistingPassword}
                        disabled={Boolean(apiToken && apiToken !== '**********')}
                        error={!apiToken && !password && !hasExistingApiToken && !hasExistingPassword}
                        value={password}
                        onChange={handlePasswordChange}
                        helperText={
                            apiToken && apiToken !== '**********' ? 'API Token already provided' :
                                hasExistingPassword && password === '**********' &&
                                    !apiToken && !password && !hasExistingApiToken && !hasExistingPassword ? 'Enter password or API token above' :
                                    'Enter your Pi-hole admin password'
                        }
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Use SSL'
                        name={getFieldName(position, 'piholeSsl')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Show Name'
                        name={getFieldName(position, 'showLabel')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Grid>
            </Box>
        );
    };

    // Create a custom wrapper for AdGuardWidgetConfig to ensure username and password fields work correctly
    const AdGuardConfigWrapper = ({ position }: { position: 'top' | 'bottom' }) => {
        // Track field values with local state
        const [host, setHost] = useState('');
        const [port, setPort] = useState('');
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        const [formInitialized, setFormInitialized] = useState(false);

        // Track if we have existing sensitive data (similar to regular AdGuardWidgetConfig)
        const [hasExistingUsername, setHasExistingUsername] = useState(false);
        const [hasExistingPassword, setHasExistingPassword] = useState(false);

        // Field names for easier reference
        const hostField = getFieldName(position, 'adguardHost');
        const portField = getFieldName(position, 'adguardPort');
        const usernameField = getFieldName(position, 'adguardUsername');
        const passwordField = getFieldName(position, 'adguardPassword');

        // Initialize masked values for existing items (similar to regular AdGuardWidgetConfig)
        useEffect(() => {
            if (existingItem?.config) {
                const dualConfig = existingItem.config;
                const positionWidget = position === 'top' ? dualConfig.topWidget : dualConfig.bottomWidget;

                if (positionWidget?.config) {
                    const config = positionWidget.config;

                    // Check if existing item has sensitive data using security flags
                    if (config._hasUsername) {
                        setHasExistingUsername(true);
                        // Set masked value in form if not already set
                        const currentUsername = formContext.getValues(usernameField);
                        if (!currentUsername) {
                            formContext.setValue(usernameField, '**********');
                            setUsername('**********');
                        } else {
                            setUsername(typeof currentUsername === 'string' ? currentUsername : '');
                        }
                    }

                    if (config._hasPassword) {
                        setHasExistingPassword(true);
                        // Set masked value in form if not already set
                        const currentPassword = formContext.getValues(passwordField);
                        if (!currentPassword) {
                            formContext.setValue(passwordField, '**********');
                            setPassword('**********');
                        } else {
                            setPassword(typeof currentPassword === 'string' ? currentPassword : '');
                        }
                    }
                }
            }
        }, [existingItem, position, usernameField, passwordField]);

        // Initialize the component with values from the form
        useEffect(() => {
            if (formInitialized) return;

            // Get initial values from form context
            const initialHost = formContext.getValues(hostField);
            const initialPort = formContext.getValues(portField);
            const initialUsername = formContext.getValues(usernameField);
            const initialPassword = formContext.getValues(passwordField);

            // Convert to strings, handling any non-string values
            const hostStr = typeof initialHost === 'string' ? initialHost : '';
            const portStr = typeof initialPort === 'string' ? initialPort : '80';
            // For sensitive fields, use the values as they are (already masked from form initialization)
            const usernameStr = typeof initialUsername === 'string' ? initialUsername : '';
            const passwordStr = typeof initialPassword === 'string' ? initialPassword : '';

            // Set local state
            setHost(hostStr);
            setPort(portStr);
            setUsername(usernameStr);
            setPassword(passwordStr);

            // Clear any validation errors since we've just loaded the values
            formContext.clearErrors(hostField);
            formContext.clearErrors(portField);
            formContext.clearErrors(usernameField);
            formContext.clearErrors(passwordField);

            // Mark as initialized so we don't run this again
            setFormInitialized(true);
        }, [hostField, portField, usernameField, passwordField, formInitialized]);

        // Handle host change
        const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setHost(newValue);
            formContext.setValue(hostField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });
            formContext.clearErrors(hostField);
        };

        // Handle port change
        const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setPort(newValue);
            formContext.setValue(portField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });
            formContext.clearErrors(portField);
        };

        // Handle username change
        const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setUsername(newValue);
            formContext.setValue(usernameField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });
            formContext.clearErrors(usernameField);
        };

        // Handle password change
        const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setPassword(newValue);
            formContext.setValue(passwordField, newValue, {
                shouldValidate: false,
                shouldDirty: true
            });
            formContext.clearErrors(passwordField);
        };

        // Helper function to determine if field should be required
        const isUsernameRequired = () => {
            // Username is required if password is provided (both are needed for Basic Auth)
            return Boolean(password && password !== '**********') || hasExistingPassword;
        };

        const isPasswordRequired = () => {
            // Password is required if username is provided (both are needed for Basic Auth)
            return Boolean(username && username !== '**********') || hasExistingUsername;
        };

        // Clear validation errors when component unmounts to prevent stale errors
        useEffect(() => {
            return () => {
                formContext.clearErrors(hostField);
                formContext.clearErrors(portField);
                formContext.clearErrors(usernameField);
                formContext.clearErrors(passwordField);
            };
        }, [hostField, portField, usernameField, passwordField]);

        // Return the custom form with our controlled inputs
        return (
            <Box sx={{ width: '100%' }}>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextField
                        name={hostField}
                        label='AdGuard Home Host'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required
                        value={host}
                        onChange={handleHostChange}
                        error={!host}
                        helperText={!host ? 'Host is required' : ''}
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 0, 0, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextField
                        name={portField}
                        label='Port'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required
                        value={port}
                        onChange={handlePortChange}
                        error={!port}
                        helperText={!port ? 'Port is required' : ''}
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 0, 0, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextFieldElement
                        name={getFieldName(position, 'adguardName')}
                        label='Display Name'
                        variant='outlined'
                        placeholder='AdGuard Home'
                        fullWidth
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
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
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextField
                        name={usernameField}
                        label='Username'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required={isUsernameRequired()}
                        value={username}
                        onChange={handleUsernameChange}
                        error={isUsernameRequired() && !username}
                        helperText={
                            hasExistingUsername && username === '**********' ? 'Current username is set (shown as ********). Clear field to remove or enter new username to replace.' :
                                'Enter your AdGuard Home admin username'
                        }
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <TextField
                        name={passwordField}
                        label='Password'
                        type='password'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required={isPasswordRequired()}
                        value={password}
                        onChange={handlePasswordChange}
                        error={isPasswordRequired() && !password}
                        helperText={
                            hasExistingPassword && password === '**********' ? 'Current password is set (shown as ********). Clear field to remove or enter new password to replace.' :
                                'Enter your AdGuard Home admin password'
                        }
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                            '& .MuiFormHelperText-root': {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }}
                        InputLabelProps={{
                            style: { color: theme.palette.text.primary }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Use SSL'
                        name={getFieldName(position, 'adguardSsl')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Grid>
                <Grid sx={{ width: '100%', mb: 2 }}>
                    <CheckboxElement
                        label='Show Name'
                        name={getFieldName(position, 'showLabel')}
                        sx={{
                            ml: 1,
                            color: 'white',
                            '& .MuiSvgIcon-root': { fontSize: 30 }
                        }}
                    />
                </Grid>
            </Box>
        );
    };

    const DiskMonitorConfigWrapper = ({ position }: { position: 'top' | 'bottom' }) => {
        return (
            <Box sx={{ width: '100%' }}>
                <DiskMonitorWidgetConfig
                    formContext={formContext as any}
                    fieldNamePrefix={position === 'top' ? 'top_' : 'bottom_'}
                />
            </Box>
        );
    };

    // Render the appropriate widget config component with position-specific field names
    const renderWidgetConfig = (widgetType: string | undefined, position: 'top' | 'bottom') => {
        if (!widgetType) return null;

        switch (widgetType) {
        case ITEM_TYPE.DATE_TIME_WIDGET:
            // Date & Time widget now has additional configuration
            return <DateTimeConfigWrapper position={position} />;
        case ITEM_TYPE.WEATHER_WIDGET:
            return <WeatherConfigWrapper position={position} />;
        case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
            return (
                <Box sx={{ width: '100%' }}>
                    {/* Use the custom component for system monitor fields */}
                    <SystemMonitorFields position={position} />
                </Box>
            );
        case ITEM_TYPE.PIHOLE_WIDGET:
            return <PiholeConfigWrapper position={position} />;
        case ITEM_TYPE.ADGUARD_WIDGET:
            return <AdGuardConfigWrapper position={position} />;
        case ITEM_TYPE.DISK_MONITOR_WIDGET:
            return <DiskMonitorConfigWrapper position={position} />;
        default:
            return null;
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%'
        }}>
            {/* Replace pagination header with Tabs */}
            <Box sx={{
                width: '100%',
                borderBottom: `1px solid ${COLORS.BORDER}`,
                mb: 3
            }}>
                <Tabs
                    value={currentPage}
                    onChange={handleTabChange}
                    centered
                    indicatorColor='primary'
                    textColor='primary'
                    variant='fullWidth'
                    sx={{
                        minHeight: isMobile ? '42px' : '48px',
                        width: '100%',
                        '& .MuiTab-root': {
                            color: theme.palette.text.primary,
                            fontWeight: 'medium',
                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                            padding: isMobile ? '6px 4px' : '12px 16px',
                            minWidth: isMobile ? '50%' : '90px',
                            flex: isMobile ? 1 : 'initial',
                            minHeight: isMobile ? '42px' : '48px',
                            '&:hover': {
                                color: 'primary.main',
                                opacity: 0.8
                            },
                            '&.Mui-selected': {
                                color: 'primary.main',
                                fontWeight: 'bold'
                            }
                        },
                        '& .MuiTabs-indicator': {
                            backgroundColor: 'primary.main',
                            height: 3
                        }
                    }}
                >
                    <Tab label={'Top Widget'} />
                    <Tab label={'Bottom Widget'} />
                </Tabs>
            </Box>

            {/* Current Page Content */}
            <Grid container spacing={2} sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
            }}>
                {/* Top Widget Configuration Page */}
                {currentPage === 0 && (
                    <>
                        <Grid style={{ width: '100%' }}>
                            <SelectElement
                                label='Widget Type'
                                name='topWidgetType'
                                options={WIDGET_OPTIONS}
                                required
                                fullWidth
                                sx={selectStyling}
                                slotProps={{
                                    inputLabel: { style: { color: theme.palette.text.primary } }
                                }}
                            />
                        </Grid>

                        {topWidgetType && (
                            <Grid container sx={{
                                marginTop: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '100%'
                            }}>
                                {renderWidgetConfig(topWidgetType, 'top')}
                            </Grid>
                        )}
                    </>
                )}

                {/* Bottom Widget Configuration Page */}
                {currentPage === 1 && (
                    <>
                        <Grid style={{ width: '100%' }}>
                            <SelectElement
                                label='Widget Type'
                                name='bottomWidgetType'
                                options={WIDGET_OPTIONS}
                                required
                                fullWidth
                                sx={selectStyling}
                                slotProps={{
                                    inputLabel: { style: { color: theme.palette.text.primary } }
                                }}
                            />
                        </Grid>

                        {bottomWidgetType && (
                            <Grid container sx={{
                                marginTop: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '100%'
                            }}>
                                {renderWidgetConfig(bottomWidgetType, 'bottom')}
                            </Grid>
                        )}
                    </>
                )}
            </Grid>
        </Box>
    );
};
