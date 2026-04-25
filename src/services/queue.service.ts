/**
 * Notification Queue Service
 * Background worker that processes PENDING notifications with per-webhook rate limiting.
 * Respects Discord's 30 msg/min per webhook limit by spacing sends ~2.5s apart per webhook.
 */

import { prisma } from '../lib/prisma.js';
import { discordService } from './discord.service.js';
import { NotificationStatus, Channel } from '@prisma/client';

const POLL_INTERVAL_MS = 2000; // Check for new notifications every 2s
const MAX_PER_BUCKET_PER_MIN = 25; // Stay safely under Discord's 30/min limit
const SEND_INTERVAL_MS = Math.ceil(60000 / MAX_PER_BUCKET_PER_MIN); // ~2400ms between sends per bucket
const MAX_RETRIES = 3;
const ORPHAN_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes — RETRYING older than this is considered orphaned

interface RateBucket {
    lastSentAt: number;
    sentThisMinute: number;
    windowStart: number;
}

type DeliveryKind = 'webhook' | 'dm';

class QueueService {
    private running = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private processing = false;
    private rateBuckets: Map<string, RateBucket> = new Map();

    /**
     * Start the queue worker
     */
    start(): void {
        if (this.running) return;
        this.running = true;

        console.log('[Genotify] Queue worker started');

        // Process immediately on start (recover orphans)
        this.tick();

        this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    }

    /**
     * Stop the queue worker
     */
    stop(): void {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('[Genotify] Queue worker stopped');
    }

    /**
     * Single processing tick
     */
    private async tick(): Promise<void> {
        // Prevent overlapping ticks
        if (this.processing) return;
        this.processing = true;

        try {
            await this.processQueue();
        } catch (error) {
            console.error('[Genotify] Queue tick error:', error);
        } finally {
            this.processing = false;
        }
    }

    /**
     * Process all pending notifications, grouped by webhook
     */
    private async processQueue(): Promise<void> {
        // Fetch PENDING notifications with their channel info
        const pending = await prisma.notification.findMany({
            where: {
                status: NotificationStatus.PENDING,
            },
            include: {
                channel: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
            take: 50, // Process in batches
        });

        if (pending.length === 0) return;

        console.log(`[Genotify] Queue: processing ${pending.length} pending notifications`);

        // Group by bucket key (webhook URL or "dm:<userId>")
        const byBucket = new Map<
            string,
            { kind: DeliveryKind; notifications: typeof pending }
        >();

        for (const notification of pending) {
            const channel = notification.channel;

            if (!channel) {
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: NotificationStatus.FAILED,
                        error: 'Notification has no associated channel',
                    },
                });
                continue;
            }

            let bucketKey: string | null = null;
            let kind: DeliveryKind = 'webhook';

            if (channel.type === 'USER') {
                if (!channel.discordUserId) {
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: NotificationStatus.FAILED,
                            error: 'User channel has no Discord user ID configured',
                        },
                    });
                    continue;
                }
                bucketKey = `dm:${channel.discordUserId}`;
                kind = 'dm';
            } else {
                if (!channel.webhookUrl) {
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: NotificationStatus.FAILED,
                            error: 'Channel has no webhook configured',
                        },
                    });
                    continue;
                }
                bucketKey = channel.webhookUrl;
                kind = 'webhook';
            }

            const group = byBucket.get(bucketKey) || { kind, notifications: [] };
            group.notifications.push(notification);
            byBucket.set(bucketKey, group);
        }

        // Process each bucket concurrently, sequential within each
        const bucketPromises = Array.from(byBucket.entries()).map(
            ([bucketKey, { kind, notifications }]) =>
                this.processBucket(bucketKey, kind, notifications)
        );

        await Promise.all(bucketPromises);
    }

    /**
     * Process notifications for a single bucket sequentially with rate limiting
     */
    private async processBucket(
        bucketKey: string,
        kind: DeliveryKind,
        notifications: Array<{
            id: string;
            target: string;
            source: string;
            title: string;
            message: string;
            color: string | null;
            senderAvatarUrl: string | null;
            retries: number;
            channel: Channel | null;
        }>
    ): Promise<void> {
        for (const notification of notifications) {
            if (!this.running) break;
            if (!notification.channel) continue;

            // Wait for rate limit window
            await this.waitForRateLimit(bucketKey);

            // Mark as RETRYING
            await prisma.notification.update({
                where: { id: notification.id },
                data: { status: NotificationStatus.RETRYING },
            });

            try {
                const data = {
                    title: notification.title,
                    message: notification.message,
                    color: notification.color,
                    source: notification.source,
                    senderAvatarUrl: notification.senderAvatarUrl,
                };

                const result =
                    kind === 'dm'
                        ? await discordService.sendDM(notification.channel, data)
                        : await discordService.sendSingle(notification.channel, data);

                if (result.success) {
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: NotificationStatus.SENT,
                            sentAt: new Date(),
                            retries: notification.retries,
                        },
                    });
                    this.recordSend(bucketKey);
                } else if (result.rateLimited) {
                    // Put back to PENDING, will be retried next tick
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: NotificationStatus.PENDING,
                            retries: notification.retries + 1,
                        },
                    });
                    console.log(`[Genotify] Rate limited on ${kind} bucket, pausing group`);
                    break;
                } else {
                    // Error — check retry count
                    const newRetries = notification.retries + 1;
                    if (newRetries >= MAX_RETRIES) {
                        await prisma.notification.update({
                            where: { id: notification.id },
                            data: {
                                status: NotificationStatus.FAILED,
                                error: result.error,
                                retries: newRetries,
                            },
                        });
                        console.error(
                            `[Genotify] Notification ${notification.id} failed after ${newRetries} retries: ${result.error}`
                        );
                    } else {
                        await prisma.notification.update({
                            where: { id: notification.id },
                            data: {
                                status: NotificationStatus.PENDING,
                                error: result.error,
                                retries: newRetries,
                            },
                        });
                    }
                }
            } catch (error) {
                const newRetries = notification.retries + 1;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';

                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: newRetries >= MAX_RETRIES
                            ? NotificationStatus.FAILED
                            : NotificationStatus.PENDING,
                        error: errorMsg,
                        retries: newRetries,
                    },
                });
            }
        }
    }

    /**
     * Wait until we can send to this bucket without exceeding rate limit
     */
    private async waitForRateLimit(bucketKey: string): Promise<void> {
        const bucket = this.getBucket(bucketKey);
        const now = Date.now();

        // Reset counter if window has passed
        if (now - bucket.windowStart > 60000) {
            bucket.sentThisMinute = 0;
            bucket.windowStart = now;
        }

        // If we've hit the limit, wait for window reset
        if (bucket.sentThisMinute >= MAX_PER_BUCKET_PER_MIN) {
            const waitTime = 60000 - (now - bucket.windowStart) + 100;
            console.log(`[Genotify] Rate limit reached for bucket, waiting ${waitTime}ms`);
            await this.sleep(waitTime);
            bucket.sentThisMinute = 0;
            bucket.windowStart = Date.now();
        }

        // Ensure minimum spacing between sends
        const timeSinceLastSend = now - bucket.lastSentAt;
        if (timeSinceLastSend < SEND_INTERVAL_MS) {
            await this.sleep(SEND_INTERVAL_MS - timeSinceLastSend);
        }
    }

    /**
     * Record a successful send for rate limiting
     */
    private recordSend(bucketKey: string): void {
        const bucket = this.getBucket(bucketKey);
        bucket.lastSentAt = Date.now();
        bucket.sentThisMinute++;
    }

    /**
     * Get or create a rate limit bucket
     */
    private getBucket(bucketKey: string): RateBucket {
        let bucket = this.rateBuckets.get(bucketKey);
        if (!bucket) {
            bucket = { lastSentAt: 0, sentThisMinute: 0, windowStart: Date.now() };
            this.rateBuckets.set(bucketKey, bucket);
        }
        return bucket;
    }

    /**
     * Recover orphaned notifications (RETRYING for too long)
     * Called periodically by the scheduler
     */
    async recoverOrphans(): Promise<number> {
        const threshold = new Date(Date.now() - ORPHAN_THRESHOLD_MS);

        const result = await prisma.notification.updateMany({
            where: {
                status: NotificationStatus.RETRYING,
                createdAt: {
                    lt: threshold,
                },
            },
            data: {
                status: NotificationStatus.PENDING,
            },
        });

        if (result.count > 0) {
            console.log(`[Genotify] Recovered ${result.count} orphaned notifications`);
        }

        return result.count;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const queueService = new QueueService();
