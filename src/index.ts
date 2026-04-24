/**
 * Genotify - Main Entry Point
 * Centralized notification service for routing messages to Discord channels
 */

import express from 'express';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { authMiddleware } from './middleware/auth.js';
import { apiLimiter, notifyLimiter } from './middleware/rateLimit.js';
import { initializeScheduler } from './jobs/scheduler.js';
import { queueService } from './services/queue.service.js';
import { startDiscordClient, stopDiscordClient, isDiscordConfigured } from './discord/client.js';

// Import routes
import healthRouter from './routes/health.js';
import channelsRouter from './routes/channels.js';
import notifyRouter from './routes/notify.js';

const app = express();

// Middleware
app.use(express.json());

// Routes (health check doesn't require auth or rate limiting)
app.use('/health', healthRouter);

// Apply auth and general rate limiting to all other routes
app.use(authMiddleware);
app.use(apiLimiter);

// Routes with specific rate limits
app.use('/channels', channelsRouter);
app.use('/notify', notifyLimiter, notifyRouter);

// Start server
const server = app.listen(env.port, () => {
    console.log(`[Genotify] Server running on port ${env.port}`);
    console.log(`[Genotify] Environment: ${env.nodeEnv}`);

    // Initialize cron jobs
    initializeScheduler();

    // Start notification queue worker
    queueService.start();

    // Start Discord client (non-blocking; tollera credenziali mancanti)
    if (isDiscordConfigured()) {
        startDiscordClient().catch((error) => {
            console.error('[Genotify] Discord client startup failed:', error);
        });
    } else {
        console.warn('[Genotify] Discord integration disabled (env missing)');
    }
});

// Graceful shutdown
const shutdown = async (signal: string) => {
    console.log(`[Genotify] ${signal} received, shutting down gracefully...`);

    server.close(async () => {
        console.log('[Genotify] HTTP server closed');
        queueService.stop();

        try {
            await stopDiscordClient();
            await prisma.$disconnect();
            console.log('[Genotify] Database connection closed');
            process.exit(0);
        } catch (error) {
            console.error('[Genotify] Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('[Genotify] Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('[Genotify] Uncaught exception:', error);
    // Don't exit - log and continue (graceful degradation)
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Genotify] Unhandled rejection at:', promise, 'reason:', reason);
    // Don't exit - log and continue (graceful degradation)
});
