import { Box, Button, CardContent, CircularProgress, Grid2 as Grid, Tooltip, Typography, useMediaQuery } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next'; // Import hook
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
import { COLORS, styles } from '../../../../theme/styles';
import { theme } from '../../../../theme/theme';

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

// Map weather codes to translation keys and icons
const weatherCodeMap: Record<number, { key: string; icon: JSX.Element }> = {
    0: { key: 'clear', icon: <BsSunFill style={{ fontSize: '2.4rem' }} /> },
    1: { key: 'mostlyClear', icon: <BsSunFill style={{ fontSize: '2.4rem' }}/> },
    2: { key: 'partlyCloudy', icon: <BsCloudSunFill style={{ fontSize: '2.4rem' }}/> },
    3: { key: 'overcast', icon: <BsCloudSunFill style={{ fontSize: '2.4rem' }}/> },
    45: { key: 'fog', icon: <BsCloudHaze2Fill style={{ fontSize: '2.4rem' }}/> },
    48: { key: 'depositingRimeFog', icon: <BsCloudHaze2Fill style={{ fontSize: '2.4rem' }}/> },
    51: { key: 'drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.4rem' }}/> },
    53: { key: 'drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.4rem' }}/> },
    55: { key: 'drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.4rem' }}/> },
    61: { key: 'rain', icon: <BsFillCloudRainFill style={{ fontSize: '2.4rem' }}/> },
    63: { key: 'rain', icon: <BsFillCloudRainFill style={{ fontSize: '2.4rem' }}/> },
    65: { key: 'heavyRain', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.4rem' }}/> },
    71: { key: 'snow', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    73: { key: 'snow', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    75: { key: 'heavySnow', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    80: { key: 'rainShowers', icon: <BsFillCloudRainFill style={{ fontSize: '2.4rem' }}/> },
    81: { key: 'moderateRainShowers', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.4rem' }}/> },
    82: { key: 'heavyRainShowers', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.4rem' }}/> },
    85: { key: 'snowShowers', icon: <BsCloudSnowFill style={{ fontSize: '2.4rem' }}/> },
    95: { key: 'thunderstorm', icon: <BsCloudLightningRainFill style={{ fontSize: '2.4rem' }}/> },
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ config }) => {
    const { t, i18n } = useTranslation(); // Initialize hook
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [forecastDays, setForecastDays] = useState(5);
    const [isFahrenheit, setIsFahrenheit] = useState(config?.temperatureUnit !== 'celsius');
    const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null);
    const [locationName, setLocationName] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const locationSet = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Helper to format day name using current locale
    const getDay = (dateString: string) => {
        if (dateString) {
            return new Date(dateString).toLocaleDateString(i18n.language, { weekday: 'short', timeZone: 'UTC' });
        }
    };

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

        return () => {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            // Cancel any ongoing requests when config changes
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [config]);

    // Handle tooltip clicks separately
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Only close tooltip if click is outside of any weather item
            const weatherItemClicked = (e.target as HTMLElement).closest('[data-weather-item]');
            if (!weatherItemClicked) {
                setOpenTooltipIndex(null);
            }
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const fetchWeather = async (abortSignal?: AbortSignal) => {
        try {
            setIsLoading(true);

            if (!location?.latitude || !location?.longitude) {
                console.error('No coordinates available for weather fetch');
                setWeatherData(null);
                setIsLoading(false);
                return;
            }

            // Check if request was cancelled before making the API call
            if (abortSignal?.aborted) {
                return;
            }

            // Add a small delay to prevent rapid successive requests
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check again after delay
            if (abortSignal?.aborted) {
                return;
            }

            const data = await DashApi.getWeather(location.latitude, location.longitude, abortSignal);

            // Check if request was cancelled after API call
            if (abortSignal?.aborted) {
                return;
            }

            setWeatherData(data);
            setErrorMessage(null); // Clear any previous errors
            setIsLoading(false);

        } catch (err: any) {
            // Don't set error state if the request was cancelled
            if (abortSignal?.aborted || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }

            console.error('Error fetching weather:', err);
            setWeatherData(null);
            setIsLoading(false);

            // Handle specific error types
            if (err?.response?.status === 429 && err?.response?.data?.error_source === 'labdash_api') {
                setErrorMessage(t('widgets.weather.errors.rateLimit', { message: err.response.data.message }));
            } else if (err?.response?.status === 500) {
                // Handle 500 errors specifically - likely from Open-Meteo API
                setErrorMessage(t('widgets.weather.errors.serviceUnavailable'));
            } else if (err?.response?.status >= 400) {
                // Handle other API errors
                const message = err?.response?.data?.message || err?.response?.data?.error || 'Error fetching weather data';
                setErrorMessage(t('widgets.weather.errors.apiError', { message }));
            } else if (err?.message) {
                setErrorMessage(t('widgets.weather.errors.specific', { message: err.message }));
            } else {
                setErrorMessage(t('widgets.weather.errors.generic'));
            }
        }
    };

    // Handle weather data fetching
    useEffect(() => {
        // Only fetch if location has been determined
        if (!locationSet.current || !location) {
            return;
        }

        let isComponentMounted = true;
        const abortController = new AbortController();

        // Initial fetch with abort signal
        fetchWeather(abortController.signal);

        // Set up interval for periodic refresh
        timerRef.current = window.setInterval(() => {
            if (isComponentMounted) {
                // Cancel any existing request before making a new one
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }

                // Create a new abort controller for the interval request
                abortControllerRef.current = new AbortController();
                fetchWeather(abortControllerRef.current.signal);
            }
        }, FIFTEEN_MIN_IN_MS);

        return () => {
            isComponentMounted = false;
            // Cancel any ongoing requests
            abortController.abort();
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [location, locationSet.current, errorMessage, t]); // Added t dependency

    const convertTemperature = (temp: number) => (isFahrenheit ? Math.round((temp * 9) / 5 + 32) : Math.round(temp));

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
                top: isMobile ? 2.5 : 6,
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
        // Get description and icon from map
        const weatherInfo = weatherData ? (weatherCodeMap[weatherData.current.weathercode] || { key: 'unknown', icon: <BsCloudSunFill style={{ fontSize: '2.4rem' }} /> }) : null;

        return weatherData &&
        <Box mt={locationName ? 3 : 0.5} mb={1}>
            <Box sx={styles.center}>
                <Box>{weatherInfo?.icon}</Box>
                <Box ml={1} sx={{ fontSize: '1.4rem' }}>{convertTemperature(weatherData.current?.temperature_2m)}°{isFahrenheit ? 'F' : 'C'}</Box>
            </Box>
        </Box>;
    };

    const renderWeatherItem = () => {
        return weatherData && Array.from({ length: forecastDays }, (_, index) => {
            const weatherCode = weatherData.daily?.weathercode[index];
            // Use map to get key and icon
            const weatherMapItem = weatherCodeMap[weatherCode];
            const icon = weatherMapItem ? weatherMapItem.icon : <BsCloudSunFill style={{ fontSize: '2.4rem' }} />;
            const description = weatherMapItem ? t(`widgets.weather.conditions.${weatherMapItem.key}`) : t('widgets.weather.conditions.unknown');

            // Use i18n language for date formatting
            const date = new Date(weatherData.daily?.time[index]).toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
            const sunrise = weatherData.daily?.sunrise[index] || 'N/A';
            const sunset = weatherData.daily?.sunset[index] || 'N/A';

            return (
                <Grid sx={{
                    ...styles.vcenter,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center', }}
                key={index}>
                    <Box sx={{ textAlign: 'center', mb: 0.5, fontSize: '1rem', lineHeight: 1 }}>{getDay(weatherData.daily?.time[index])}</Box>

                    <Tooltip
                        title={
                            <Box sx={{ p: 2 }}>
                                <Typography variant='body2' align={'center'} sx={{ fontWeight: 'bold' }}>{date}</Typography>
                                <Typography variant='body2' align={'center'} mb={2}>{description}</Typography>
                                <Typography variant='body2'>
                                    <strong>{t('widgets.weather.high')}:</strong> {convertTemperature(weatherData.daily.temperature_2m_max[index])}°{isFahrenheit ? 'F' : 'C'}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>{t('widgets.weather.low')}:</strong> {convertTemperature(weatherData.daily.temperature_2m_min[index])}°{isFahrenheit ? 'F' : 'C'}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>{t('widgets.weather.wind')}:</strong> {weatherData.current.windspeed_10m} {t('widgets.weather.speedUnit')}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>{t('widgets.weather.sunrise')}:</strong> {new Date(sunrise).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </Typography>
                                <Typography variant='body2'>
                                    <strong>{t('widgets.weather.sunset')}:</strong> {new Date(sunset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
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
                        componentsProps={{
                            tooltip: {
                                sx: {
                                    bgcolor: COLORS.BORDER, // Solid dark background
                                    '.MuiTooltip-arrow': {
                                        color: COLORS.BORDER // Match the arrow color
                                    }
                                }
                            }
                        }}
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
                                {icon}
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

    // If there's an error, show full-screen error message
    if (errorMessage) {
        return (
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2
            }}>
                <Typography variant='subtitle1' align='center' sx={{ mb: 1 }}>
                    {!errorMessage || errorMessage === 'null' ? t('widgets.weather.errors.fetchFailed') : errorMessage}
                </Typography>
                <Button
                    variant='contained'
                    color='primary'
                    onClick={() => fetchWeather()}
                    disabled={isLoading}
                    sx={{ mt: 2 }}
                >
                    {isLoading ? t('common.retry') + '...' : t('common.retry')}
                </Button>
            </Box>
        );
    }

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
                        {t('widgets.weather.unavailable')}
                    </Typography>
                    <Typography variant='caption' sx={{ mt: 1 }}>
                        {t('widgets.weather.setLocation')}
                    </Typography>
                </Box>
            )}
        </CardContent>
    );
};