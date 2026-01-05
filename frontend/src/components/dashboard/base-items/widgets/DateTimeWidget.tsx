import { Box, CardContent, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { BsGeoAltFill } from 'react-icons/bs';

import { useIsMobile } from '../../../../hooks/useIsMobile';
import { theme } from '../../../../theme/theme';

type DateTimeWidgetConfig = {
    location?: {
        name: string;
        latitude: number;
        longitude: number;
    } | null;
    timezone?: string;
    use24Hour?: boolean;
};

type DateTimeWidgetProps = {
    config?: DateTimeWidgetConfig;
};

export const DateTimeWidget = ({ config }: DateTimeWidgetProps) => {
    const [dateTime, setDateTime] = useState<Date>(new Date());
    const [locationName, setLocationName] = useState<string | null>(null);
    const isMobile = useIsMobile();

    useEffect(() => {
        // Update location name from config
        if (config?.location?.name) {
            setLocationName(config.location.name);
        } else {
            setLocationName(null);
        }
    }, [config]);

    useEffect(() => {
        const updateDateTime = () => {
            // Just update with current time - timezone applied during display
            setDateTime(new Date());
        };

        // Initial update
        updateDateTime();

        // Update every minute
        const interval = setInterval(updateDateTime, 60000);

        // Clean up interval on component unmount
        return () => clearInterval(interval);
    }, []);

    const renderLocationName = () => {
        if (!locationName) return null;

        // Parse location parts from the full name
        const locationParts = locationName.split(',').map(part => part.trim());

        // Check if the first part is a US zip code (5 digits)
        const isZipCodeFirst = /^\d{5}$/.test(locationParts[0]);

        // If first part is a zip code, use the second part as the city
        const cityIndex = isZipCodeFirst ? 1 : 0;
        const city = locationParts[cityIndex] || locationParts[0]; // Fallback to first part if second doesn't exist

        let displayLocation = '';

        // Check if this is a US location
        const isUS = locationParts.some(part =>
            part === 'United States' ||
            part === 'USA' ||
            part === 'US'
        );

        if (isUS) {
            // For US locations, try to find the state
            // States can be in the format "Florida" or "FL"
            const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)\b/i;

            // Find the part that contains a state
            const statePart = locationParts.find(part => statePattern.test(part));

            if (statePart) {
                displayLocation = `${city}, ${statePart}`;
            } else {
                // Fallback to city and country if state not found
                displayLocation = `${city}, US`;
            }
        } else if (locationParts.length >= 2) {
            // For non-US locations, show City, Country
            const country = locationParts[locationParts.length - 1];
            displayLocation = `${city}, ${country}`;
        } else {
            // Fallback to just the city
            displayLocation = city;
        }

        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0,
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.8)',
                position: 'absolute',
                top: isMobile ? 2.5 : 0,
                left: 0,
                right: 0,
                zIndex: 1,
                fontWeight: 'medium',
                padding: '4px 0'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BsGeoAltFill style={{ marginRight: '2px', fontSize: '0.8rem' }} />
                    <Typography variant='body2' sx={{ fontWeight: 'medium' }}>
                        {displayLocation}
                    </Typography>
                </Box>

                {config?.timezone && (
                    <Typography
                        fontSize={'0.75rem'}
                        sx={{
                            opacity: 0.8,
                            mt: 0.3,
                            lineHeight: 1
                        }}
                    >
                        {config.timezone.replace(/_/g, ' ')}
                    </Typography>
                )}
            </Box>
        );
    };

    // Create formatter functions with the timezone
    const getFormattedTime = () => {
        const use24Hour = config?.use24Hour === true;

        try {
            if (use24Hour) {
                // For 24-hour format, manually format to avoid locale issues
                let hours: number;
                let minutes: number;

                if (config?.timezone) {
                    // Get hours and minutes in the specified timezone
                    const formatter = new Intl.DateTimeFormat('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: false,
                        timeZone: config.timezone
                    });
                    const parts = formatter.formatToParts(dateTime);
                    hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
                    minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
                } else {
                    hours = dateTime.getHours();
                    minutes = dateTime.getMinutes();
                }

                // Format as HH:MM
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else {
                // For 12-hour format, use standard formatting
                if (config?.timezone) {
                    const options: Intl.DateTimeFormatOptions = {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: config.timezone,
                        hour12: true
                    };
                    return new Intl.DateTimeFormat('en-US', options).format(dateTime);
                } else {
                    return dateTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                }
            }
        } catch (error) {
            console.error('Error formatting time with timezone:', error);
            if (use24Hour) {
                const hours = dateTime.getHours();
                const minutes = dateTime.getMinutes();
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else {
                return dateTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            }
        }
    };

    const getFormattedDate = () => {
        try {
            if (config?.timezone) {
                const options: Intl.DateTimeFormatOptions = {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    timeZone: config.timezone
                };
                return new Intl.DateTimeFormat([], options).format(dateTime);
            }

            // Fallback to local date if no timezone provided
            return dateTime.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date with timezone:', error);
            return dateTime.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
        }
    };

    return (
        <CardContent sx={{ position: 'relative' }}>
            {renderLocationName()}
            <Box height={'100%'} mt={locationName ? (config?.timezone ? 4 : 3) : 0}>
                <Typography fontSize={'3rem'} align={'center'} fontWeight={600}>
                    {getFormattedTime()}
                </Typography>
                <Typography fontSize={'1.5rem'} align={'center'}>
                    {getFormattedDate()}
                </Typography>
            </Box>
        </CardContent>
    );
};
