import { Box, Grid2 as Grid, Tab, Tabs, TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm';
import { WeatherWidgetConfig } from './WeatherWidgetConfig';
import { ITEM_TYPE } from '../../../types';

const WIDGET_OPTIONS = [
    { id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' },
    { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' },
    { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' },
    { id: ITEM_TYPE.PIHOLE_WIDGET, label: 'Pi-hole' }
];

interface DualWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
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

export const DualWidgetConfig = ({ formContext }: DualWidgetConfigProps) => {
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

    const selectStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '.MuiSvgIcon-root ': {
                fill: theme.palette.text.primary,
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
        },
        width: '100%',
        minWidth: isMobile ? '50vw' : '20vw',
        '& .MuiMenuItem-root:hover': {
            backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
        },
        '& .MuiMenuItem-root.Mui-selected': {
            backgroundColor: `${theme.palette.primary.main} !important`,
            color: 'white',
        },
        '& .MuiMenuItem-root.Mui-selected:hover': {
            backgroundColor: `${theme.palette.primary.main} !important`,
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
        const existingItem = formContext.getValues();
        const existingConfig = (existingItem as any).config || {};

        let topWidgetFields: Record<string, any> = {};
        let bottomWidgetFields: Record<string, any> = {};

        // Extract top widget configuration
        if (existingConfig.topWidget?.config) {
            const topWidgetType = existingConfig.topWidget.type;
            const topConfig = existingConfig.topWidget.config;

            if (topWidgetType) {
                formContext.setValue('topWidgetType', topWidgetType);

                // Map configuration based on widget type
                if (topWidgetType === ITEM_TYPE.WEATHER_WIDGET) {
                    topWidgetFields = {
                        temperatureUnit: topConfig.temperatureUnit || 'fahrenheit',
                        location: topConfig.location || null
                    };
                    formContext.setValue('top_temperatureUnit', topConfig.temperatureUnit || 'fahrenheit');
                    formContext.setValue('top_location', topConfig.location || null);
                }
                else if (topWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                    const gauges = topConfig.gauges || ['cpu', 'temp', 'ram'];
                    topWidgetFields = {
                        temperatureUnit: topConfig.temperatureUnit || 'fahrenheit',
                        gauge1: gauges[0] || 'cpu',
                        gauge2: gauges[1] || 'temp',
                        gauge3: gauges[2] || 'ram',
                        networkInterface: topConfig.networkInterface || ''
                    };
                    formContext.setValue('top_temperatureUnit', topConfig.temperatureUnit || 'fahrenheit');
                    formContext.setValue('top_gauge1', gauges[0] || 'cpu');
                    formContext.setValue('top_gauge2', gauges[1] || 'temp');
                    formContext.setValue('top_gauge3', gauges[2] || 'ram');
                    formContext.setValue('top_networkInterface', topConfig.networkInterface || '');
                }
                else if (topWidgetType === ITEM_TYPE.PIHOLE_WIDGET) {
                    topWidgetFields = {
                        piholeHost: topConfig.host || '',
                        piholePort: topConfig.port || '',
                        piholeSsl: topConfig.ssl || false,
                        piholeApiToken: topConfig.apiToken || '',
                        piholePassword: topConfig.password || '',
                        piholeName: topConfig.displayName || '',
                        showLabel: topConfig.showLabel !== undefined ? topConfig.showLabel : true
                    };
                    formContext.setValue('top_piholeHost', topConfig.host || '');
                    formContext.setValue('top_piholePort', topConfig.port || '');
                    formContext.setValue('top_piholeSsl', topConfig.ssl || false);
                    formContext.setValue('top_piholeApiToken', topConfig.apiToken || '');
                    formContext.setValue('top_piholePassword', topConfig.password || '');
                    formContext.setValue('top_piholeName', topConfig.displayName || '');
                    formContext.setValue('top_showLabel', topConfig.showLabel !== undefined ? topConfig.showLabel : true);
                }
            }
        }

        // Extract bottom widget configuration
        if (existingConfig.bottomWidget?.config) {
            const bottomWidgetType = existingConfig.bottomWidget.type;
            const bottomConfig = existingConfig.bottomWidget.config;

            if (bottomWidgetType) {
                // Set the bottomWidgetType directly
                formContext.setValue('bottomWidgetType', bottomWidgetType);

                // Map configuration based on widget type
                if (bottomWidgetType === ITEM_TYPE.WEATHER_WIDGET) {
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
                else if (bottomWidgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                    const gauges = bottomConfig.gauges || ['cpu', 'temp', 'ram'];
                    bottomWidgetFields = {
                        temperatureUnit: bottomConfig.temperatureUnit || 'fahrenheit',
                        gauge1: gauges[0] || 'cpu',
                        gauge2: gauges[1] || 'temp',
                        gauge3: gauges[2] || 'ram',
                        networkInterface: bottomConfig.networkInterface || ''
                    };
                    formContext.setValue('bottom_temperatureUnit', bottomConfig.temperatureUnit || 'fahrenheit');
                    formContext.setValue('bottom_gauge1', gauges[0] || 'cpu');
                    formContext.setValue('bottom_gauge2', gauges[1] || 'temp');
                    formContext.setValue('bottom_gauge3', gauges[2] || 'ram');
                    formContext.setValue('bottom_networkInterface', bottomConfig.networkInterface || '');
                }
                else if (bottomWidgetType === ITEM_TYPE.PIHOLE_WIDGET) {
                    bottomWidgetFields = {
                        piholeHost: bottomConfig.host || '',
                        piholePort: bottomConfig.port || '',
                        piholeSsl: bottomConfig.ssl || false,
                        piholeApiToken: bottomConfig.apiToken || '',
                        piholePassword: bottomConfig.password || '',
                        piholeName: bottomConfig.displayName || '',
                        showLabel: bottomConfig.showLabel !== undefined ? bottomConfig.showLabel : true
                    };
                    formContext.setValue('bottom_piholeHost', bottomConfig.host || '');
                    formContext.setValue('bottom_piholePort', bottomConfig.port || '');
                    formContext.setValue('bottom_piholeSsl', bottomConfig.ssl || false);
                    formContext.setValue('bottom_piholeApiToken', bottomConfig.apiToken || '');
                    formContext.setValue('bottom_piholePassword', bottomConfig.password || '');
                    formContext.setValue('bottom_piholeName', bottomConfig.displayName || '');
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
    }, []);

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

        // Trigger form validation
        formContext.trigger();
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
        else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            defaultFields = {
                temperatureUnit: 'fahrenheit',
                gauge1: 'cpu',
                gauge2: 'temp',
                gauge3: 'ram',
                networkInterface: ''
            };
            formContext.setValue(getFieldName(position, 'temperatureUnit'), 'fahrenheit');
            formContext.setValue(getFieldName(position, 'gauge1'), 'cpu');
            formContext.setValue(getFieldName(position, 'gauge2'), 'temp');
            formContext.setValue(getFieldName(position, 'gauge3'), 'ram');
            formContext.setValue(getFieldName(position, 'networkInterface'), '');
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

        // Update widget state with default fields
        setWidgetState(prevState => ({
            ...prevState,
            [`${position}WidgetFields`]: { ...defaultFields }
        }));

        // Ensure form is validated
        formContext.trigger();
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
        else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            fields.temperatureUnit = formContext.getValues(getFieldName(position, 'temperatureUnit'));
            fields.gauge1 = formContext.getValues(getFieldName(position, 'gauge1'));
            fields.gauge2 = formContext.getValues(getFieldName(position, 'gauge2'));
            fields.gauge3 = formContext.getValues(getFieldName(position, 'gauge3'));
            fields.networkInterface = formContext.getValues(getFieldName(position, 'networkInterface'));
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

        // Update the state with captured values
        setWidgetState(prevState => ({
            ...prevState,
            [`${position}WidgetFields`]: { ...fields }
        }));
    };

    // Handle tab change (replacing handlePageChange)
    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        // Use the same logic as the original handlePageChange
        if (newValue !== currentPage) {
            // Capture current form values to state
            const currentPosition = currentPage === 0 ? 'top' : 'bottom';
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

                // Trigger form validation
                formContext.trigger();
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

    // Watch for changes to widget types
    useEffect(() => {
        const topWidgetType = formContext.watch('topWidgetType');
        const bottomWidgetType = formContext.watch('bottomWidgetType');

        if (currentPage === 0 && topWidgetType) {
            // When top widget type changes, apply default values
            if (Object.keys(widgetState.topWidgetFields).length === 0) {
                resetFormFields('top');
            }
        }

        if (currentPage === 1 && bottomWidgetType) {
            // When bottom widget type changes, apply default values
            if (Object.keys(widgetState.bottomWidgetFields).length === 0) {
                resetFormFields('bottom');
            }
        }

        formContext.trigger();
    }, [formContext.watch('topWidgetType'), formContext.watch('bottomWidgetType')]);

    // Save final configurations when form is submitted
    useEffect(() => {
        const handleFormSubmit = () => {
            // Grab the current page's state first
            const currentPosition = currentPage === 0 ? 'top' : 'bottom';
            captureFormValuesToState(currentPosition);

            // Then ensure BOTH positions' form values are captured
            setTimeout(() => {
                // Ensure we capture both positions regardless of which page we're on
                captureFormValuesToState('top');
                captureFormValuesToState('bottom');

                // Build individual widget configs
                const topWidget = buildWidgetConfig('top');
                const bottomWidget = buildWidgetConfig('bottom');

                // Create the final dual widget config
                const dualWidgetConfig = {
                    topWidget,
                    bottomWidget
                };

                // Set the config value for submission
                (formContext as any).setValue('config', dualWidgetConfig);
            }, 0);
        };

        // Add event listener to form submit
        const formElement = document.querySelector('form');
        if (formElement) {
            formElement.addEventListener('submit', handleFormSubmit);
            return () => {
                formElement.removeEventListener('submit', handleFormSubmit);
            };
        }
    }, [formContext, widgetState, currentPage]);

    // Update buildWidgetConfig to not depend on active position state
    const buildWidgetConfig = (position: 'top' | 'bottom') => {
        const widgetType = formContext.getValues(`${position}WidgetType`);
        if (!widgetType) return undefined;

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
        else if (widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
            // Get values directly from form for critical fields
            const temperatureUnit = formContext.getValues(getFieldName(position, 'temperatureUnit'));
            const gauge1 = formContext.getValues(getFieldName(position, 'gauge1'));
            const gauge2 = formContext.getValues(getFieldName(position, 'gauge2'));
            const gauge3 = formContext.getValues(getFieldName(position, 'gauge3'));
            const networkInterface = formContext.getValues(getFieldName(position, 'networkInterface'));

            config = {
                temperatureUnit: temperatureUnit || 'fahrenheit',
                gauges: [
                    gauge1 || fields.gauge1 || 'cpu',
                    gauge2 || fields.gauge2 || 'temp',
                    gauge3 || fields.gauge3 || 'ram'
                ],
                networkInterface: networkInterface || fields.networkInterface || ''
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

            config = {
                host: host || '',
                port: port || '',
                ssl: ssl || false,
                apiToken: apiToken || '',
                password: password || '',
                displayName: displayName || '',
                showLabel: showLabel !== undefined ? showLabel : true
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
                {/* Our own temperature unit selector */}
                <Box sx={{ width: '100%', mb: 2 }}>
                    <SelectElement
                        label='Temperature Unit'
                        name={getFieldName(position, 'temperatureUnit')}
                        options={[
                            { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
                            { id: 'celsius', label: 'Celsius (°C)' }
                        ]}
                        required
                        fullWidth
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '.MuiSvgIcon-root ': {
                                    fill: theme.palette.text.primary,
                                },
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                            },
                            width: '100%',
                            minWidth: isMobile ? '50vw' : '20vw',
                            '& .MuiMenuItem-root:hover': {
                                backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                            },
                            '& .MuiMenuItem-root.Mui-selected': {
                                backgroundColor: `${theme.palette.primary.main} !important`,
                                color: 'white',
                            },
                            '& .MuiMenuItem-root.Mui-selected:hover': {
                                backgroundColor: `${theme.palette.primary.main} !important`,
                                color: 'white',
                            }
                        }}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                        value={tempUnit}
                        onChange={handleTempUnitChange}
                    />
                </Box>

                {/* Pass only the location handling to WeatherWidgetConfig */}
                <Box sx={{ '& .MuiGrid2-root:first-of-type': { display: 'none' } }}>
                    <WeatherWidgetConfig formContext={modifiedContext as any} />
                </Box>
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

        // Field names for easier reference
        const hostField = getFieldName(position, 'piholeHost');
        const portField = getFieldName(position, 'piholePort');
        const apiTokenField = getFieldName(position, 'piholeApiToken');
        const passwordField = getFieldName(position, 'piholePassword');

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
            const tokenStr = typeof initialApiToken === 'string' ? initialApiToken : '';
            const passwordStr = typeof initialPassword === 'string' ? initialPassword : '';

            // Set local state
            setHost(hostStr);
            setPort(portStr);

            // Handle mutual exclusivity for token/password at initialization
            if (tokenStr && passwordStr) {
                // If both have values, prioritize the token
                formContext.setValue(apiTokenField, tokenStr);
                formContext.setValue(passwordField, '');
                setApiToken(tokenStr);
                setPassword('');
            } else {
                // Otherwise use whatever values we have
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

            // If token has a value, clear password and its validation errors
            if (newValue) {
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

            // If password has a value, clear token and its validation errors
            if (newValue) {
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
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
                        required={!password}
                        disabled={!!password}
                        error={!apiToken && !password}
                        value={apiToken}
                        onChange={handleApiTokenChange}
                        helperText={
                            password ? 'Password already provided' :
                                !apiToken && !password ? 'Enter API token or password below' :
                                    'Enter the API token from Pi-hole Settings > API/Web interface'
                        }
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
                        required={!apiToken}
                        disabled={!!apiToken}
                        error={!apiToken && !password}
                        value={password}
                        onChange={handlePasswordChange}
                        helperText={
                            apiToken ? 'API Token already provided' :
                                !apiToken && !password ? 'Enter password or API token above' :
                                    'Enter your Pi-hole admin password'
                        }
                        sx={{
                            width: '100%',
                            minWidth: isMobile ? '65vw' : '20vw',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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

    // Render the appropriate widget config component with position-specific field names
    const renderWidgetConfig = (widgetType: string | undefined, position: 'top' | 'bottom') => {
        if (!widgetType) return null;

        switch (widgetType) {
        case ITEM_TYPE.DATE_TIME_WIDGET:
            // Date & Time widget doesn't need additional configuration
            return null;
        case ITEM_TYPE.WEATHER_WIDGET:
            return <WeatherConfigWrapper position={position} />;
        case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
            return (
                <Box sx={{ width: '100%' }}>
                    <SelectElement
                        label='Temperature Unit'
                        name={getFieldName(position, 'temperatureUnit')}
                        options={[
                            { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
                            { id: 'celsius', label: 'Celsius (°C)' }
                        ]}
                        required
                        fullWidth
                        sx={selectStyling}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />

                    {/* Use the custom component for system monitor fields */}
                    <SystemMonitorFields position={position} />
                </Box>
            );
        case ITEM_TYPE.PIHOLE_WIDGET:
            return <PiholeConfigWrapper position={position} />;
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
                                color: theme.palette.primary.main,
                                opacity: 0.8
                            },
                            '&.Mui-selected': {
                                color: theme.palette.primary.main,
                                fontWeight: 'bold'
                            }
                        },
                        '& .MuiTabs-indicator': {
                            backgroundColor: theme.palette.primary.main,
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

                        {formContext.watch('topWidgetType') && (
                            <Grid container sx={{
                                marginTop: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '100%'
                            }}>
                                {renderWidgetConfig(formContext.watch('topWidgetType'), 'top')}
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

                        {formContext.watch('bottomWidgetType') && (
                            <Grid container sx={{
                                marginTop: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '100%'
                            }}>
                                {renderWidgetConfig(formContext.watch('bottomWidgetType'), 'bottom')}
                            </Grid>
                        )}
                    </>
                )}
            </Grid>
        </Box>
    );
};
