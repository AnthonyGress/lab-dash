import { NextFunction, Request, Response } from 'express';

import { CustomError } from '../types/custom-error';

export const errorHandler = (
    error: CustomError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    console.error(`🔥 Error: ${error.message}`);

    // Multer reports too many, too large or unexpected files without a status code
    const status = error.statusCode || (error.name === 'MulterError' ? 400 : 500);
    res.status(status).json({
        success: false,
        message: error.message || 'Internal Server Error',
    });
};
