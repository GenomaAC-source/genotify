/**
 * Rate limiting middleware
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

function isWhitelisted(req: Request): boolean {
    if (env.rateLimitWhitelistKeys.length === 0) return false;
    const key = req.header('x-api-key');
    return !!key && env.rateLimitWhitelistKeys.includes(key);
}

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    message: {
        success: false,
        error: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: isWhitelisted,
});

export const notifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    message: {
        success: false,
        error: 'Rate limit exceeded: max 150 notifications per minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: isWhitelisted,
});

export const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Rate limit exceeded: max 10 requests per minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: isWhitelisted,
});
