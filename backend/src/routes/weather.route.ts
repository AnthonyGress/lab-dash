// src/routes/weather.route.ts
import axios from 'axios';
import { Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';

export const weatherRoute = Router();

/**
 * GET /weather
 * Expects query parameters `latitude` and `longitude`.
 * Example request:
 *   GET /weather?latitude=27.87&longitude=-82.626
 */
weatherRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        let latitude, longitude;
        // Extract client IP (supports proxies)
        if (!req.query.latitude && !req.query.longitude) {
            const ipResponse = await axios.get('https://api64.ipify.org?format=json');
            const ip = ipResponse.data.ip;

            console.log('Fetching location by ip');

            // Fetch geolocation data using ip-api.com
            const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`);
            const { lat, lon, city, country, status } = geoResponse.data;
            latitude = lat;
            longitude = lon;

            if (status !== 'success') {
                res.status(400).json({ error: 'Unable to determine location from IP' });
                console.error(`Error fetching weather: ${ip}`);
                return;
            }
        } else {
            latitude = req.query.latitude;
            longitude = req.query.longitude;
        }


        // Fetch weather data from Open-Meteo
        const weatherResponse = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: latitude,
                longitude: longitude,
                current: 'temperature_2m,weathercode,windspeed_10m',
                daily: 'temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset',
                timezone: 'auto'
            }
        });

        res.json(
            weatherResponse.data
        );

    } catch (error) {
        console.error('Error fetching weather:', error);
        res.status(500).json({ error: 'Error fetching weather data' });
    }
});
