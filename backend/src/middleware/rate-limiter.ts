import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

// Helper function to log rate limit hits with consistent format
const logRateLimitHit = (req: Request, limiterName: string) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const method = req.method;
    const path = req.originalUrl || req.url;

    console.error(`Rate limit hit [${limiterName}] at ${timestamp}, Method: ${method}, Path: ${path}`);
};

// General API rate limiter - used as the default
export const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3000,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'GENERAL');
        res.status(429).json({
            success: false,
            message: 'Too many requests from this general IP, please try again after 5 minutes',
            error_source: 'labdash_api'
        });
    }
});

// Auth endpoints rate limiter - more restrictive for security
export const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'AUTH');
        res.status(429).json({
            success: false,
            message: 'Too many authentication attempts, please try again after 5 minutes',
            error_source: 'labdash_api'
        });
    }
});

// Internal/External API endpoints rate limiter - to prevent overwhelming third-party services
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'API');
        res.status(429).json({
            success: false,
            message: 'Too many API requests, please try again after 1 minutes',
            error_source: 'labdash_api'
        });
    }
});

// Health check endpoints limiter - higher limits for monitoring tools
export const healthLimiter = rateLimit({
    windowMs: 30 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'HEALTH');
        res.status(429).json({
            success: false,
            message: 'Health check rate limit exceeded, please try again later',
            error_source: 'labdash_api'
        });
    }
});

// Weather API specific limiter - weather APIs often have strict rate limits
export const weatherApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'WEATHER');
        res.status(429).json({
            success: false,
            message: 'Weather API rate limit exceeded, please try again later',
            error_source: 'labdash_api'
        });
    }
});

// Timezone API specific limiter
export const timezoneApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'TIMEZONE');
        res.status(429).json({
            success: false,
            message: 'Timezone API rate limit exceeded, please try again later',
            error_source: 'labdash_api'
        });
    }
});

// Torrent client API limiter - prevent DDoS of torrent clients
export const torrentApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'TORRENT');
        res.status(429).json({
            success: false,
            message: 'Torrent client API rate limit exceeded, please try again later',
            error_source: 'labdash_api'
        });
    }
});

// System monitor API limiter
export const systemMonitorLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logRateLimitHit(req, 'SYSTEM');
        res.status(429).json({
            success: false,
            message: 'System monitor API rate limit exceeded, please try again later',
            error_source: 'labdash_api'
        });
    }
});
