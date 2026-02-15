/**
 * API Key authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== env.apiKey) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or missing API key',
        });
        return;
    }

    next();
}
