import { Box, Button, Card, CardContent, CircularProgress, Grid2 as Grid, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { BsCloudLightningRainFill } from 'react-icons/bs';
import { BsCloudSunFill } from 'react-icons/bs';
import { BsCloudSnowFill } from 'react-icons/bs';
import { BsCloudDrizzleFill } from 'react-icons/bs';
import { BsFillCloudRainFill } from 'react-icons/bs';
import { BsCloudRainHeavyFill } from 'react-icons/bs';
import { BsCloudHaze2Fill } from 'react-icons/bs';
import { BsSunFill } from 'react-icons/bs';


import { styles } from '../../theme/styles';

interface WeatherData {
  current: { temperature_2m: number; weathercode: number };
  daily: { temperature_2m_max: number[]; weathercode: number[], time: string[] };
}

const weatherDescriptions: Record<number, { description: string; icon: JSX.Element }> = {
    0: { description: 'Clear', icon: <BsSunFill style={{ fontSize: '2.5rem' }}/> },
    1: { description: 'Mostly clear', icon: <BsSunFill style={{ fontSize: '2.5rem' }}/> },
    2: { description: 'Partly cloudy', icon: <BsCloudSunFill style={{ fontSize: '2.5rem' }}/> },
    3: { description: 'Overcast', icon: <BsCloudSunFill style={{ fontSize: '2.5rem' }}/> },
    45: { description: 'Fog', icon: <BsCloudHaze2Fill style={{ fontSize: '2.5rem' }}/> },
    48: { description: 'Depositing rime fog', icon: <BsCloudHaze2Fill style={{ fontSize: '2.5rem' }}/> },
    51: { description: 'Drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.5rem' }}/> },
    53: { description: 'Drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.5rem' }}/> },
    55: { description: 'Drizzle', icon: <BsCloudDrizzleFill style={{ fontSize: '2.5rem' }}/> },
    61: { description: 'Rain', icon: <BsFillCloudRainFill style={{ fontSize: '2.5rem' }}/> },
    63: { description: 'Rain', icon: <BsFillCloudRainFill style={{ fontSize: '2.5rem' }}/> },
    65: { description: 'Heavy Rain', icon: <BsCloudRainHeavyFill style={{ fontSize: '2.5rem' }}/> },
    71: { description: 'Snow', icon: <BsCloudSnowFill style={{ fontSize: '2.5rem' }}/> },
    73: { description: 'Snow', icon: <BsCloudSnowFill style={{ fontSize: '2.5rem' }}/> },
    75: { description: 'Heavy Snow', icon: <BsCloudSnowFill style={{ fontSize: '2.5rem' }}/> },
    80: { description: 'Rain showers', icon: <BsFillCloudRainFill style={{ fontSize: '2.5rem' }}/> },
    85: { description: 'Snow showers', icon: <BsCloudSnowFill style={{ fontSize: '2.5rem' }}/> },
    95: { description: 'Thunderstorm', icon: <BsCloudLightningRainFill style={{ fontSize: '2.5rem' }}/> },
};

export const WeatherWidget: React.FC = () => {
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [forecastDays, setForecastDays] = useState(5);
    const [isFahrenheit, setIsFahrenheit] = useState(true);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ latitude, longitude });
            },
            (error) => console.error('Error fetching location:', error)
        );
    }, []);

    useEffect(() => {
        const fetchWeather = async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${location?.latitude}&longitude=${location?.longitude}&current=temperature_2m,weathercode&daily=temperature_2m_max,weathercode&timezone=auto`
                );
                const data: WeatherData = await response.json();
                console.log(data);

                setWeatherData(data);
            } catch (error) {
                console.error('Error fetching weather:', error);
            } finally {
                setLoading(false);
            }
        };

        if (location) {
            fetchWeather();
        }

        // every 15 min
        setTimeout(() => {
            fetchWeather();
        }, 900);
    }, [location, forecastDays]);


    const convertTemperature = (temp: number) => (isFahrenheit ? Math.round((temp * 9) / 5 + 32) : Math.round(temp));

    const renderCurrentWeatherItem = () => {
        return weatherData &&
        <Box mb={2}>
            <Box sx={styles.center}>
                <Box>{weatherDescriptions[weatherData?.current?.weathercode]?.icon}</Box>
                <Box ml={1} sx={{ fontSize: '2rem' }}>{convertTemperature(weatherData.current?.temperature_2m)}°{isFahrenheit ? 'F' : 'C'}</Box>
            </Box>
            {/* <Box sx={{ fontSize: '1rem' }}>{weatherDescriptions[weatherData.current.weathercode]?.description || 'Unknown'}</Box> */}
        </Box>;
    };

    const getDay = (dateString: string) => {
        if (dateString) {
            return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        }
    };

    const renderWeatherItem = () => {
        return weatherData && Array.from({ length: forecastDays }, (_, index) => (
            <Grid sx={styles.vcenter} key={index}>
                <Box>{getDay(weatherData.daily?.time[index])}</Box>
                <Box>{weatherDescriptions[weatherData.daily?.weathercode[index]]?.icon}</Box>
                <Box ml={1} sx={{ fontSize: '1.5rem' }}>{convertTemperature(weatherData.daily?.temperature_2m_max[index])}°{isFahrenheit ? 'F' : 'C'}</Box>
                <Box sx={{ fontSize: '1rem' }}> {weatherDescriptions[weatherData.daily?.weathercode[index]]?.description || 'Unknown'}</Box>
            </Grid>
        ));
    };

    return (
        // <Card sx={{ ...styles.widgetContainer }}>
        <CardContent>
            {loading ? (
                <Box sx={styles.center}>
                    <CircularProgress sx={{ mt: 2 }} />
                </Box>
            ) : weatherData ? (
                <Grid sx={styles.vcenter} container>
                    {/* 1 Day */}
                    {renderCurrentWeatherItem()}
                    {/* 5 Day */}
                    <Grid sx={styles.center} container gap={5}>
                        { forecastDays > 1 && renderWeatherItem() }
                    </Grid>
                </Grid>
            ) : (
                <Typography variant='body2' sx={{ mt: 2 }}>Fetching weather...</Typography>
            )}
        </CardContent>
        // </Card>
    );
};
