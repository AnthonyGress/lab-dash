import { Box, Button, Card, CardContent, CircularProgress, Grid2 as Grid, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { BsCloudLightningRainFill } from 'react-icons/bs';
import { BsCloudSunFill } from 'react-icons/bs';
import { BsCloudSnowFill } from 'react-icons/bs';
import { BsCloudDrizzleFill } from 'react-icons/bs';
import { BsFillCloudRainFill } from 'react-icons/bs';
import { BsCloudRainHeavyFill } from 'react-icons/bs';
import { BsCloudHaze2Fill } from 'react-icons/bs';
import { BsSunFill } from 'react-icons/bs';


import { DashApi } from '../../api/dash-api';
import { styles } from '../../theme/styles';

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

export const WeatherWidget: React.FC = () => {
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [forecastDays, setForecastDays] = useState(5);
    const [isFahrenheit, setIsFahrenheit] = useState(true);
    const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null);


    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ latitude, longitude });
            },
            (error) => console.error('Error fetching location:', error)
        );

        const handleClickOutside = () => {
            setOpenTooltipIndex(null); // Close tooltip when clicking anywhere
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const fetchWeather = async () => {
            setLoading(true);
            try {
                let data;
                if (!location?.latitude || !location.longitude) {
                    console.log('no location');

                    data = await DashApi.getWeather();
                    console.log('Weather data:', data);
                } else {
                    data = await DashApi.getWeather(location.latitude, location.longitude);
                    console.log('Weather data:', data);
                }
                setWeatherData(data);
            } catch (error) {
                console.log('Error fetching weather:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();

        // every 15 min
        // setTimeout(() => {
        //     fetchWeather();
        // }, 900);
    }, [location, forecastDays]);


    const convertTemperature = (temp: number) => (isFahrenheit ? Math.round((temp * 9) / 5 + 32) : Math.round(temp));

    const renderCurrentWeatherItem = () => {
        return weatherData &&
        <Box mb={1}>
            <Box sx={styles.center}>
                <Box>{weatherDescriptions[weatherData?.current?.weathercode]?.icon}</Box>
                <Box ml={1} sx={{ fontSize: '1.5rem' }}>{convertTemperature(weatherData.current?.temperature_2m)}°{isFahrenheit ? 'F' : 'C'}</Box>
            </Box>
            {/* <Box sx={{ fontSize: '1rem' }}>{weatherDescriptions[weatherData.current.weathercode]?.description || 'Unknown'}</Box> */}
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
                <Grid sx={styles.vcenter} key={index}>
                    <Box>{getDay(weatherData.daily?.time[index])}</Box>
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
                        <Box>
                            <Box
                                onClick={(e) =>{
                                    e.stopPropagation(); // Prevents tooltip from closing when clicking inside
                                    setOpenTooltipIndex(openTooltipIndex === index ? null : index);}
                                }
                                sx={{ cursor: 'pointer' }}
                            >
                                {weatherInfo.icon}
                            </Box>
                            <Box sx={{ fontSize: { sm: '1.25rem', xl: '1.5rem' } }}>
                                {convertTemperature(weatherData.daily?.temperature_2m_max[index])}°
                                {/* {isFahrenheit ? 'F' : 'C'} */}
                            </Box>
                        </Box>
                    </Tooltip>
                </Grid>
            );
        });
    };

    return (
        <CardContent sx={{ p: 0 }}>
            {loading ? (
                <Box sx={styles.center}>
                    <CircularProgress sx={{ mt: 2 }} />
                </Box>
            ) : weatherData ? (
                <Grid sx={styles.vcenter} container>
                    {/* 1 Day */}
                    {renderCurrentWeatherItem()}
                    {/* 5 Day */}
                    <Grid sx={styles.center} container gap={{ xs: 4, md: 5 }}>
                        { forecastDays > 1 && renderWeatherItem() }
                    </Grid>
                </Grid>
            ) : (
                <Typography variant='body2' sx={{ mt: 1 }}>Fetching weather...</Typography>
            )}
        </CardContent>
    );
};
