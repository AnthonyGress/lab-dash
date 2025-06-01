import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SECRET || '@jZCgtn^qg8So*^^6A2M'; // Same secret used in auth.route.ts

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

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    // Check for token in cookies first (for login/logout/refresh routes)
    // console.log('#### req', req);
    const tokenFromCookie = req.cookies?.access_token;
    // console.log('#### req.token', req.cookies);

    // Then check Authorization header (for API routes that don't use cookies)
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];

    // Use cookie token if available, otherwise use header token
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            res.status(401).json({ message: 'Invalid or expired token' });
            return;
        }

        // Add user to request
        req.user = user;
        next();
    });
};

// Middleware to check if user is an admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    // authenticateToken must be called before this middleware
    // console.log('#### req', req);

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
