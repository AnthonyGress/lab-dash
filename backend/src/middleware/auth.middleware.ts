import { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../services/users';

// Define custom Request interface with user property

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            username: string;
            role: string;
            [key: string]: any;
        };
    }
}

const getRequestToken = (req: Request): string | undefined => {
    // Check for token in cookies first (for login/logout/refresh routes)
    const tokenFromCookie = req.cookies?.access_token;

    // Then check Authorization header (for API routes that don't use cookies)
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];

    // Use cookie token if available, otherwise use header token
    return tokenFromCookie || tokenFromHeader;
};

/** Returns the caller's account, or undefined for guests and bad tokens. */
export const getOptionalUser = (req: Request): Request['user'] => verifyAccessToken(getRequestToken(req));

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    if (!getRequestToken(req)) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    const user = getOptionalUser(req);
    if (!user) {
        res.status(401).json({ message: 'Invalid or expired token' });
        return;
    }

    // Add user to request
    req.user = user;
    next();
};

// Middleware to check if user is an admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    // authenticateToken must be called before this middleware

    if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    if (req.user.role !== 'admin') {
        res.status(403).json({ message: 'Admin access required' });
        return;
    }

    next();
};
