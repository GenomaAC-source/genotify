/**
 * API Key authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
}

/**
 * API Key authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'];
    const clientIp = getClientIp(req);

    console.log(`[Auth] Request from IP: ${clientIp} to ${req.method} ${req.path}`);

    // Check API key
    if (!apiKey || apiKey !== env.apiKey) {
        console.log(`[Auth] ❌ Invalid API key from ${clientIp}`);
        res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or missing API key',
        });
        return;
    }

    console.log(`[Auth] ✅ Authorized: ${clientIp}`);
    next();
}
