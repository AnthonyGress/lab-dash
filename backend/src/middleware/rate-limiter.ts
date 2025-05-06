import rateLimit from 'express-rate-limit';

// General API rate limiter - used as the default
export const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 500,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 5 minutes'
});

// Auth endpoints rate limiter - more restrictive for security
export const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Limit each IP to 50 auth requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again after 5 minutes'
});

// Internal/External API endpoints rate limiter - to prevent overwhelming third-party services
export const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many API requests, please try again after 5 minutes'
});

// Health check endpoints limiter - higher limits for monitoring tools
export const healthLimiter = rateLimit({
    windowMs: 30 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Health check rate limit exceeded, please try again later'
});

// Weather API specific limiter - weather APIs often have strict rate limits
export const weatherApiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Weather API rate limit exceeded, please try again later'
});

// Torrent client API limiter - prevent DDoS of torrent clients
export const torrentApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Torrent client API rate limit exceeded, please try again later'
});

// System monitor API limiter
export const systemMonitorLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'System monitor API rate limit exceeded, please try again later'
});
