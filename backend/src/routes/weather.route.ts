// src/routes/weather.route.ts
import axios from 'axios';
import { Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';

export const weatherRoute = Router();

/**
 * GET /weather
 * Requires query parameters `latitude` and `longitude`.
 * Example request:
 *   GET /weather?latitude=27.87&longitude=-82.626
 */
weatherRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate required parameters
        if (!req.query.latitude || !req.query.longitude) {
            res.status(400).json({ error: 'Both latitude and longitude are required parameters' });
            return;
        }

        const latitude = req.query.latitude;
        const longitude = req.query.longitude;

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
