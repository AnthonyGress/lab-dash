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
        const { latitude, longitude } = req.query;

        if (!latitude || !longitude) {
            res.status(StatusCodes.BAD_REQUEST).json({
                message: 'Please provide both latitude and longitude as query parameters.'
            });
        }

        // Construct the Open-Meteo API URL:
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto`;

        // Fetch data from the Open-Meteo API using Axios
        const { data, status } = await axios.get(apiUrl);

        // If status is not 200, treat it as an error
        if (status !== StatusCodes.OK) {
            res.status(StatusCodes.BAD_REQUEST).json({
                message: 'Failed to fetch data from Open-Meteo'
            });
        }

        // Return the JSON data from Open-Meteo
        res.status(StatusCodes.OK).json(data);

    } catch (error) {
        // Handle unexpected errors (e.g., network issues)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error fetching weather data',
            error: (error as Error).message,
        });
    }
});
