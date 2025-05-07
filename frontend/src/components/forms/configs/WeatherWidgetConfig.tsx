import ClearIcon from '@mui/icons-material/Clear';
import { Autocomplete, Grid2 as Grid, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { SelectElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm';

const TEMPERATURE_UNIT_OPTIONS = [
    { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
    { id: 'celsius', label: 'Celsius (°C)' }
];

interface LocationOption {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface WeatherWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const WeatherWidgetConfig = ({ formContext }: WeatherWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const [locationSearch, setLocationSearch] = useState('');
    const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Initialize location state if it exists in form values
    useEffect(() => {
        const locationValue = formContext.getValues('location');
        if (locationValue) {
            setSelectedLocation(locationValue as LocationOption);
            setLocationSearch(locationValue.name || '');
        }
    }, [formContext]);

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

    // When a location is selected, update the form values
    useEffect(() => {
        if (selectedLocation) {
            formContext.setValue('location', {
                name: selectedLocation.name,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude
            });
        }
    }, [selectedLocation, formContext]);

    return (
        <>
            <Grid>
                <SelectElement
                    label='Temperature Unit'
                    name='temperatureUnit'
                    options={TEMPERATURE_UNIT_OPTIONS}
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
                        minWidth: isMobile ? '65vw' : '20vw',
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
                />
            </Grid>
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
                            setSelectedLocation(null);
                            formContext.setValue('location', null);
                        } else {
                            setSelectedLocation(newValue);
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
                            helperText='Enter a city/state or city/country'
                            FormHelperTextProps={{
                                style: { color: theme.palette.text.primary }
                            }}
                            sx={{
                                width: '100%',
                                minWidth: isMobile ? '65vw' : '20vw',
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'text.primary',
                                    },
                                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                }
                            }}
                            InputLabelProps={{
                                style: { color: theme.palette.text.primary }
                            }}
                        />
                    )}
                />
            </Grid>
        </>
    );
};
