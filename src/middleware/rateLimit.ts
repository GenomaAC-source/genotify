/**
 * Rate limiting middleware
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Max 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        error: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Notification endpoint rate limiter
 * Max 30 requests per minute (Discord webhook limit)
 */
export const notifyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: {
        success: false,
        error: 'Rate limit exceeded: max 30 notifications per minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Strict limiter for sensitive operations
 * Max 10 requests per minute
 */
export const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: {
        success: false,
        error: 'Rate limit exceeded: max 10 requests per minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
