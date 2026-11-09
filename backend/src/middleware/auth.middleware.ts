import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { isItemPublic } from '../utils/config-lookup';
import { SECRET } from '../utils/secret';

const JWT_SECRET = SECRET;

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

/** Returns the verified payload of an access token, or undefined when it is missing or invalid. */
export const verifyAccessToken = (token: string | undefined): Request['user'] => {
    if (!token) return undefined;

    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        return typeof payload === 'object' ? payload as Request['user'] : undefined;
    } catch {
        return undefined;
    }
};

/** Returns the caller's verified token payload, or undefined for guests and bad tokens. */
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

/**
 * Guards the integration proxy routers, which all address a saved dashboard item
 * through `?itemId=`. Admins may do anything. Everyone else may only read items
 * that are visible without logging in.
 */
export const itemAccess = (req: Request, res: Response, next: NextFunction): void => {
    const user = getOptionalUser(req);
    if (user?.role === 'admin') {
        next();
        return;
    }

    const itemId = req.query.itemId;
    if (req.method === 'GET' && typeof itemId === 'string' && isItemPublic(itemId)) {
        next();
        return;
    }

    if (user) {
        res.status(403).json({ message: 'Admin access required' });
    } else {
        res.status(401).json({ message: 'Authentication required' });
    }
};
