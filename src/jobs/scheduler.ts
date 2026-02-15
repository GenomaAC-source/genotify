/**
 * Cron job scheduler
 * Registers and manages scheduled tasks
 */

import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { NotificationStatus } from '@prisma/client';

export function initializeScheduler(): void {
    console.log('[Genotify] Initializing cron jobs...');

    // Daily cleanup: Remove SENT notifications older than 30 days
    // Runs every day at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('[Genotify] Running daily cleanup job...');

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await prisma.notification.deleteMany({
                where: {
                    status: NotificationStatus.SENT,
                    createdAt: {
                        lt: thirtyDaysAgo,
                    },
                },
            });

            console.log(
                `[Genotify] Cleanup complete: deleted ${result.count} old notifications`
            );
        } catch (error) {
            console.error('[Genotify] Error in cleanup job:', error);
        }
    });

    // Channel sync backup placeholder
    // Runs every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        try {
            console.log('[Genotify] Channel sync backup triggered');
            // This is a placeholder - the actual sync is handled by the Discord bot
            // managed separately. This job can be used for backup/verification purposes.
        } catch (error) {
            console.error('[Genotify] Error in channel sync backup:', error);
        }
    });

    console.log('[Genotify] Cron jobs initialized');
}
