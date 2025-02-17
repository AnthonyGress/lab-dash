import { NextFunction, Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';

import { getSystemInfo } from '../system-monitor';
import { CustomError } from '../types/custom-error';
export const systemRoute = Router();

systemRoute.get('/', async (_req: Request, res: Response) => {
    const response = await getSystemInfo();

    if (response) {
        res.json(response);
    } else {
        res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ message: 'Error fetching system info' });
    }
});

// Example of throwing an error
systemRoute.get('/error', (req: Request, res: Response, next: NextFunction) => {
    next(new CustomError('This is an example error', 400));
});
