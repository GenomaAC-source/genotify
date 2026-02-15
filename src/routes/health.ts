/**
 * Health check endpoint
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    let databaseStatus = 'connected';

    try {
        // Test database connection
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        console.error('[Genotify] Database health check failed:', error);
        databaseStatus = 'disconnected';
    }

    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: databaseStatus,
    });
});

export default router;
