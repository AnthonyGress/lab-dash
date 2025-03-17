import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Same secret used in auth.route.ts

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    // Check for token in cookies first (for login/logout/refresh routes)
    const tokenFromCookie = req.cookies?.access_token;

    // Then check Authorization header (for API routes that don't use cookies)
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];

    // Use cookie token if available, otherwise use header token
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        // @ts-ignore - add user to request
        req.user = user;
        next();
    });
};
