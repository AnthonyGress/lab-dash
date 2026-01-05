import ClearIcon from '@mui/icons-material/Clear';
import { Autocomplete, Grid2 as Grid, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { CheckboxElement, UseFormReturn } from 'react-hook-form-mui';

import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface LocationOption {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface DateTimeWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    fieldNamePrefix?: string;
}

export const DateTimeWidgetConfig = ({ formContext, fieldNamePrefix = '' }: DateTimeWidgetConfigProps) => {
    // Helper to get field name with optional prefix
    const getFieldName = (baseName: string) => {
        return fieldNamePrefix ? `${fieldNamePrefix}${baseName}` : baseName;
    };
    const isMobile = useIsMobile();
    const [locationSearch, setLocationSearch] = useState('');
    const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isFetchingTimezone, setIsFetchingTimezone] = useState(false);
    const [timezoneError, setTimezoneError] = useState<string | null>(null);

    // Initialize location state if it exists in form values
    useEffect(() => {
        const locationValue = formContext.getValues(getFieldName('location') as any);
        if (locationValue) {
            setSelectedLocation(locationValue as LocationOption);
            setLocationSearch(locationValue.name || '');

            // If location exists but no timezone, try to fetch it
            const timezone = formContext.getValues(getFieldName('timezone') as any);
            if (locationValue && !timezone && locationValue.latitude && locationValue.longitude) {
                fetchTimezoneForLocation(locationValue.latitude, locationValue.longitude);
            }
        }
    }, [formContext]);

    // Function to fetch timezone for a location
    const fetchTimezoneForLocation = async (latitude: number, longitude: number) => {
        setIsFetchingTimezone(true);
        setTimezoneError(null);

        try {
            const response = await DashApi.getTimezone(latitude, longitude);

            if (response && response.data && response.data.timezone) {
                // Set the timezone in the form
                const timezone = response.data.timezone;
                formContext.setValue(getFieldName('timezone') as any, timezone, { shouldDirty: true });
            } else {
                setTimezoneError('Failed to fetch timezone: Invalid response format');

                // Set an empty string timezone to ensure the property exists
                formContext.setValue(getFieldName('timezone') as any, '', { shouldDirty: true });
            }
        } catch (error) {
            // More detailed error handling
            if (error instanceof Error) {
                setTimezoneError(`Error: ${error.message}`);
            } else {
                setTimezoneError('Unknown error fetching timezone');
            }

            // Set an empty string timezone to ensure the property exists
            formContext.setValue(getFieldName('timezone') as any, '', { shouldDirty: true });
        } finally {
            setIsFetchingTimezone(false);
        }
    };

    // Debounce location search and fetch results
    useEffect(() => {
        const fetchLocations = async () => {
            if (locationSearch.length < 2) {
                setLocationOptions([]);
                return;
            }

            setIsSearching(true);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&limit=5`);
                const data = await response.json();

                // Create a Map to track seen names and ensure uniqueness
                const uniqueLocations = new Map();

                // Process each location, ensuring uniqueness
                data.forEach((item: any) => {
                    const name = item.display_name;
                    // Use a combination of place_id and name as the unique key
                    const uniqueId = `${item.place_id}_${name}`;

                    if (!uniqueLocations.has(name)) {
                        uniqueLocations.set(name, {
                            id: uniqueId,
                            name: name,
                            latitude: parseFloat(item.lat),
                            longitude: parseFloat(item.lon)
                        });
                    }
                });

                // Convert the Map values to an array
                const results = Array.from(uniqueLocations.values());

                setLocationOptions(results);
            } catch (error) {
                console.error('Error fetching locations:', error);
                setLocationOptions([]);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(() => {
            if (locationSearch) {
                fetchLocations();
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [locationSearch]);

    // When a location is selected, update the form values and fetch timezone
    const handleLocationSelected = (newLocation: LocationOption | null) => {
        if (!newLocation) {
            setSelectedLocation(null);
            formContext.setValue(getFieldName('location') as any, null);
            formContext.setValue(getFieldName('timezone') as any, '');
            return;
        }

        // Update selected location state
        setSelectedLocation(newLocation);

        // Update form with location data
        formContext.setValue(getFieldName('location') as any, {
            name: newLocation.name,
            latitude: newLocation.latitude,
            longitude: newLocation.longitude
        });

        // Fetch and set timezone for this location
        fetchTimezoneForLocation(newLocation.latitude, newLocation.longitude);
    };

    return (
        <>
            <Grid>
                <Autocomplete
                    options={locationOptions}
                    getOptionLabel={(option) => {
                        // Handle both string and LocationOption types
                        if (typeof option === 'string') {
                            return option;
                        }
                        return option.name;
                    }}
                    inputValue={locationSearch}
                    onInputChange={(_, newValue) => {
                        setLocationSearch(newValue);
                    }}
                    onChange={(_, newValue) => {
                        // Handle both string and LocationOption types
                        if (typeof newValue === 'string' || !newValue) {
                            handleLocationSelected(null);
                        } else {
                            handleLocationSelected(newValue);
                        }
                    }}
                    loading={isSearching}
                    loadingText={
                        <Typography style={{ color: theme.palette.text.primary }}>
                            Searching...
                        </Typography>
                    }
                    noOptionsText={
                        <Typography style={{ color: theme.palette.text.primary }}>
                            {locationSearch.length < 2 ? 'Type to search...' : 'No locations found'}
                        </Typography>
                    }
                    fullWidth
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    clearOnBlur={false}
                    clearOnEscape
                    value={selectedLocation}
                    freeSolo
                    clearIcon={<ClearIcon style={{ color: theme.palette.text.primary }} />}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label='Search location'
                            variant='outlined'
                            helperText={isFetchingTimezone ? 'Fetching timezone...' : (timezoneError || 'Enter a zip code or city')}
                            FormHelperTextProps={{
                                style: {
                                    color: timezoneError
                                        ? 'rgba(255, 0, 0, 0.7)'
                                        : theme.palette.text.primary
                                }
                            }}
                            sx={{
                                width: '100%',
                                minWidth: isMobile ? '65vw' : '20vw',
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'text.primary',
                                    },
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                                }
                            }}
                            InputLabelProps={{
                                style: { color: theme.palette.text.primary }
                            }}
                        />
                    )}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Use 24-hour format'
                    name={getFieldName('use24Hour')}
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
