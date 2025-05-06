import { Box, Button, Card, CardContent, CircularProgress, Grid2 as Grid, Skeleton, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { BsCloudLightningRainFill } from 'react-icons/bs';
import { BsCloudSunFill } from 'react-icons/bs';
import { BsCloudSnowFill } from 'react-icons/bs';
import { BsCloudDrizzleFill } from 'react-icons/bs';
import { BsFillCloudRainFill } from 'react-icons/bs';
import { BsCloudRainHeavyFill } from 'react-icons/bs';
import { BsCloudHaze2Fill } from 'react-icons/bs';
import { BsSunFill } from 'react-icons/bs';
import { BsGeoAltFill } from 'react-icons/bs';

import { DashApi } from '../../../../api/dash-api';
import { FIFTEEN_MIN_IN_MS } from '../../../../constants/constants';
import { styles } from '../../../../theme/styles';

interface WeatherData {
    current: { temperature_2m: number; weathercode: number; windspeed_10m: number };
    daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weathercode: number[];
        time: string[];
        sunrise: string[];
        sunset: string[];
    };
}

interface WeatherWidgetProps {
    config?: {
        temperatureUnit?: string;
        location?: {
            name: string;
            latitude: number;
            longitude: number;
        } | null;
    };
}

const getDay = (dateString: string) => {
    if (dateString) {
        return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    }
};

const weatherDescriptions: Record<number, { description: string; icon: JSX.Element }> = {
    0: { description: 'Clear', icon: <BsSunFill style={{ fontSize: '2.4rem' }} /> },
    1: { description: 'Mostly clear', icon: <BsSunFill style={{ fontSize: '2.4rem' }}/> },
    2: { description: 'Partly cloudy', icon: <BsCloudSunFill style={{ fontSize: '2.4rem' }}/> },
    3: { description: 'Overcast', icon: <BsCloudSunFill style={{ fontSize: '2.4rem' }}/> },
    45: { description: 'Fog', icon: <BsCloudHaze2Fill style={{ fontSize: '2.4rem' }}/> },
    48: { description: 'Depositing rime fog', icon: <BsCloudHaze2Fill style={{ fontSize: '2.4rem' }}/> },
    51: { description: 'Drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.4rem' }}/> },
    53: { description: 'Drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.4rem' }}/> },
    55: { description: 'Drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.4rem' }}/> },
    61: { description: 'Rain', icon: <BsFillCloudRainFill style={{ fontSize: '2.4rem' }}/> },
    63: { description: 'Rain', icon: <BsFillCloudRainFill style={{ fontSize: '2.4rem' }}/> },
    65: { description: 'Heavy Rain', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.4rem' }}/> },
    71: { description: 'Snow', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    73: { description: 'Snow', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    75: { description: 'Heavy Snow', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    80: { description: 'Rain showers', icon: <BsFillCloudRainFill style={{ fontSize: '2.4rem' }}/> },
    81: { description: 'Moderate Rain Showers', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.4rem' }}/> },
    82: { description: 'Heavy Rain Showers', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.4rem' }}/> },
    85: { description: 'Snow showers', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    95: { description: 'Thunderstorm', icon: <BsCloudLightningRainFill style={{ fontSize: '2.4rem' }}/> },
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ config }) => {
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [forecastDays, setForecastDays] = useState(5);
    const [isFahrenheit, setIsFahrenheit] = useState(config?.temperatureUnit !== 'celsius');
    const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null);
    const [locationName, setLocationName] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const locationSet = useRef(false);

    // Handle config changes and location setup
    useEffect(() => {
        setIsFahrenheit(config?.temperatureUnit !== 'celsius');

        // Clear any existing weather fetch timer
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Only use location from config, no browser geolocation fallback
        if (config?.location?.latitude && config?.location?.longitude) {
            setLocation({
                latitude: config.location.latitude,
                longitude: config.location.longitude
            });

            if (config.location.name) {
                setLocationName(config.location.name);
            }

            locationSet.current = true;
        } else {
            // If no config location provided, don't use browser geolocation
            setLocation(null);
            locationSet.current = true;
            setIsLoading(false);
        }

        const handleClickOutside = () => {
            setOpenTooltipIndex(null); // Close tooltip when clicking anywhere
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [config]);

    // Handle weather data fetching
    useEffect(() => {
        // Only fetch if location has been determined
        if (!locationSet.current || !location) {
            return;
        }

        let isComponentMounted = true;
        let retryCount = 0;
        const MAX_RETRIES = 2;
        const RETRY_DELAY = 5000; // 5 seconds

        const fetchWeather = async () => {
            try {
                if (!isComponentMounted) return;

                setIsLoading(true);
                // Only fetch when we have explicit coordinates
                if (location.latitude && location.longitude) {
                    const data = await DashApi.getWeather(location.latitude, location.longitude);
                    if (isComponentMounted) {
                        setWeatherData(data);
                        retryCount = 0; // Reset retry count on success
                    }
                } else {
                    // If no coordinates are available, don't fetch
                    console.error('No coordinates available for weather fetch');
                    if (isComponentMounted) {
                        setWeatherData(null);
                    }
                }
            } catch (error) {
                console.error('Error fetching weather:', error);
                if (isComponentMounted) {
                    setWeatherData(null);

                    // Implement retry with backoff
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        console.log(`Retrying weather fetch (${retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY/1000}s`);
                        setTimeout(fetchWeather, RETRY_DELAY);
                    }
                }
            } finally {
                if (isComponentMounted) {
                    setIsLoading(false);
                }
            }
        };

        // Fetch weather immediately
        fetchWeather();

        // Set up interval for periodic refresh - use a longer interval if there were previous errors
        const refreshInterval = retryCount > 0 ? FIFTEEN_MIN_IN_MS * 2 : FIFTEEN_MIN_IN_MS;
        timerRef.current = window.setInterval(fetchWeather, refreshInterval);

        return () => {
            isComponentMounted = false;
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [location, locationSet.current]);

    const convertTemperature = (temp: number) => (isFahrenheit ? Math.round((temp * 9) / 5 + 32) : Math.round(temp));

    const renderLocationName = () => {
        if (!locationName) return null;

        // Parse location parts from the full name
        const locationParts = locationName.split(',').map(part => part.trim());
        const city = locationParts[0];

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
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0,
                mt: -.5,
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.8)',
                position: 'absolute',
                top: 5,
                left: 0,
                right: 0,
                zIndex: 1
            }}>
                <BsGeoAltFill style={{ marginRight: '2px', fontSize: '0.8rem' }} />
                <Typography variant='body2' sx={{ fontWeight: 'medium' }}>
                    {displayLocation}
                </Typography>
            </Box>
        );
    };

    const renderCurrentWeatherItem = () => {
        return weatherData &&
        <Box mt={locationName ? 2 : 0.5} mb={1}>
            <Box sx={styles.center}>
                <Box>{weatherDescriptions[weatherData?.current?.weathercode]?.icon}</Box>
                <Box ml={1} sx={{ fontSize: '1.4rem' }}>{convertTemperature(weatherData.current?.temperature_2m)}°{isFahrenheit ? 'F' : 'C'}</Box>
            </Box>
        </Box>;
    };

    const renderWeatherItem = () => {
        return weatherData && Array.from({ length: forecastDays }, (_, index) => {
            const weatherCode = weatherData.daily?.weathercode[index];
            const weatherInfo = weatherDescriptions[weatherCode] || { description: 'Unknown', icon: <BsCloudSunFill style={{ fontSize: '2.4rem' }} /> };
            const date = new Date(weatherData.daily?.time[index]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
            const sunrise = weatherData.daily?.sunrise[index] || 'N/A';
            const sunset = weatherData.daily?.sunset[index] || 'N/A';

            return (
                <Grid sx={{
                    ...styles.vcenter,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 0
                }} key={index}>
                    <Box sx={{ textAlign: 'center', mb: 0.5, fontSize: '1rem', lineHeight: 1 }}>{getDay(weatherData.daily?.time[index])}</Box>
                    <Tooltip
                        title={
                            <Box sx={{ p: 2 }}>
                                <Typography variant='body2' align={'center'} sx={{ fontWeight: 'bold' }}>{date}</Typography>
                                <Typography variant='body2' align={'center'} mb={2}>{weatherInfo.description}</Typography>
                                <Typography variant='body2'>
                                    <strong>High:</strong> {convertTemperature(weatherData.daily.temperature_2m_max[index])}°{isFahrenheit ? 'F' : 'C'}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>Low:</strong> {convertTemperature(weatherData.daily.temperature_2m_min[index])}°{isFahrenheit ? 'F' : 'C'}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>Wind Speed:</strong> {weatherData.current.windspeed_10m} mph
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>Sunrise:</strong> {new Date(sunrise).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>Sunset:</strong> {new Date(sunset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </Typography>
                            </Box>
                        }
                        open={openTooltipIndex === index}
                        onClose={() => setOpenTooltipIndex(null)}
                        placement='bottom'
                        arrow
                        disableFocusListener
                        disableHoverListener
                        disableTouchListener
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                                onClick={(e) =>{
                                    e.stopPropagation(); // Prevents tooltip from closing when clicking inside
                                    setOpenTooltipIndex(openTooltipIndex === index ? null : index);}
                                }
                                sx={{
                                    cursor: 'pointer',
                                    mt: -0.25,
                                }}
                            >
                                {weatherInfo.icon}
                            </Box>
                            <Box sx={{ fontSize: { xs: '1rem', sm: '1rem', xl: '1.25rem' }, textAlign: 'center', mt: -0.5, lineHeight: 1.1 }}>
                                {convertTemperature(weatherData.daily?.temperature_2m_max[index])}°
                                {isFahrenheit ? 'F' : 'C'}
                            </Box>
                        </Box>
                    </Tooltip>
                </Grid>
            );
        });
    };

    return (
        <CardContent sx={{
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            pt: 1,
            pb: 0
        }}>
            {isLoading ? (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        aspectRatio: '16/9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: { xs: 120, sm: 120, md: 120 },
                    }}
                >
                    <CircularProgress />
                </Box>
            ) : weatherData ? (
                <Grid sx={{ width: '100%' }}>
                    {/* Location Name */}
                    {renderLocationName()}
                    {/* 1 Day */}
                    {renderCurrentWeatherItem()}
                    {/* 5 Day */}
                    <Grid container gap={{ xs: 3, sm: 3, md: 3.5, lg: 4.5, xl: 5.5 }} sx={{ px: 1, mt: 0, justifyContent: 'center' }}>
                        { forecastDays > 1 && renderWeatherItem() }
                    </Grid>
                </Grid>
            ) : (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: 2
                    }}
                >
                    <Typography variant='subtitle1'>
                        Weather unavailable
                    </Typography>
                    <Typography variant='caption' sx={{ mt: 1 }}>
                        Please set a location in the widget settings
                    </Typography>
                </Box>
            )}
        </CardContent>
    );
};
