import { Request, Response, Router } from 'express';
import { find as findTimezone } from 'geo-tz';
import StatusCodes from 'http-status-codes';

export const timezoneRoute = Router();

/**
 * GET /timezone
 * Requires query parameters `latitude` and `longitude`.
 * Example request:
 *   GET /timezone?latitude=27.87&longitude=-82.626
 * Returns:
 *   { timezone: "America/New_York" }
 */
timezoneRoute.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate required parameters
        if (!req.query.latitude || !req.query.longitude) {
            res.status(StatusCodes.BAD_REQUEST).json({
                error: 'Both latitude and longitude are required parameters'
            });
            return;
        }

        const latitude = parseFloat(req.query.latitude as string);
        const longitude = parseFloat(req.query.longitude as string);

        // Validate latitude and longitude
        if (isNaN(latitude) || isNaN(longitude)) {
            res.status(StatusCodes.BAD_REQUEST).json({
                error: 'Latitude and longitude must be valid numbers'
            });
            return;
        }

        if (latitude < -90 || latitude > 90) {
            res.status(StatusCodes.BAD_REQUEST).json({
                error: 'Latitude must be between -90 and 90'
            });
            return;
        }

        if (longitude < -180 || longitude > 180) {
            res.status(StatusCodes.BAD_REQUEST).json({
                error: 'Longitude must be between -180 and 180'
            });
            return;
        }

        // Use geo-tz to find the timezone for the coordinates
        const timezones = findTimezone(latitude, longitude);

        // Use the first timezone found (geo-tz can return multiple)
        const timezone = timezones.length > 0 ? timezones[0] : null;

        if (!timezone) {
            res.status(StatusCodes.NOT_FOUND).json({
                error: 'Could not determine timezone for the provided coordinates'
            });
            return;
        }

        res.json({ timezone });

    } catch (error) {
        console.error('Error determining timezone:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            error: 'Error processing timezone request'
        });
    }
});
