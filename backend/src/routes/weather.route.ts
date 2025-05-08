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
            res.status(StatusCodes.BAD_REQUEST).json({ error: 'Both latitude and longitude are required parameters' });
            return;
        }

        const latitude = req.query.latitude;
        const longitude = req.query.longitude;

        // Fetch weather data from Open-Meteo with timeout
        const weatherResponse = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: latitude,
                longitude: longitude,
                current: 'temperature_2m,weathercode,windspeed_10m',
                daily: 'temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset',
                timezone: 'auto'
            },
            timeout: 5000 // 5 second timeout
        });

        res.json(weatherResponse.data);

    } catch (error) {
        let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        let errorMessage = 'Error fetching weather data';

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                statusCode = StatusCodes.GATEWAY_TIMEOUT;
                errorMessage = 'Weather API timeout';
            } else if (error.response) {
                statusCode = error.response.status;
                errorMessage = `Weather API error: ${error.response.statusText}`;
            }

            console.error(`Weather API error: ${errorMessage}`, {
                status: statusCode,
                message: error.message,
                url: error.config?.url,
                params: error.config?.params
            });
        } else {
            console.error('Unknown error fetching weather:', error);
        }

        res.status(statusCode).json({ error: errorMessage });
    }
});
