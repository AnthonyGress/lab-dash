import { NextFunction, Request, Response } from 'express';

import { CustomError } from '../types/custom-error';

export const errorHandler = (
    error: CustomError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    console.error(`🔥 Error: ${error.message}`);

    const status = error.statusCode || 500;
    res.status(status).json({
        success: false,
        message: error.message || 'Internal Server Error',
    });
};
