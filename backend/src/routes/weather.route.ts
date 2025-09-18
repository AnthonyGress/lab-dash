// src/routes/weather.route.ts
import axios from 'axios';
import { Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';

export const weatherRoute = Router();

// Helper function for retry logic with exponential backoff
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on client errors (4xx) or if it's the last attempt
            if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
                throw error;
            }

            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Weather API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

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

        // Fetch weather data from Open-Meteo with retry logic
        const weatherResponse = await retryWithBackoff(async () => {
            return await axios.get('https://api.open-meteo.com/v1/forecast', {
                params: {
                    latitude: latitude,
                    longitude: longitude,
                    current: 'temperature_2m,weathercode,windspeed_10m',
                    daily: 'temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset',
                    timezone: 'auto'
                },
                timeout: 5000 // 5 second timeout
            });
        }, 3, 1000); // 3 retries with 1 second base delay

        res.json(weatherResponse.data);

    } catch (error) {
        let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        let errorMessage = 'Error fetching weather data';

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                statusCode = StatusCodes.GATEWAY_TIMEOUT;
                errorMessage = 'Weather API timeout after retries';
            } else if (error.response) {
                statusCode = error.response.status;
                errorMessage = `Weather API error: ${error.response.statusText}`;
            }

            console.error(`Weather API error after retries: ${errorMessage}`, {
                status: statusCode,
                message: error.message,
                url: error.config?.url,
                params: error.config?.params
            });
        } else {
            console.error('Unknown error fetching weather after retries:', error);
        }

        res.status(statusCode).json({ error: errorMessage });
    }
});
