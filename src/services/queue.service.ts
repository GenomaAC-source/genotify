/**
 * Notification Queue Service
 * Background worker that processes PENDING notifications with per-webhook rate limiting.
 * Respects Discord's 30 msg/min per webhook limit by spacing sends ~2.5s apart per webhook.
 */

import { prisma } from '../lib/prisma.js';
import { discordService } from './discord.service.js';
import { NotificationStatus, Channel } from '@prisma/client';

const POLL_INTERVAL_MS = 2000; // Check for new notifications every 2s
const MAX_PER_WEBHOOK_PER_MIN = 25; // Stay safely under Discord's 30/min limit
const SEND_INTERVAL_MS = Math.ceil(60000 / MAX_PER_WEBHOOK_PER_MIN); // ~2400ms between sends per webhook
const MAX_RETRIES = 3;
const ORPHAN_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes — RETRYING older than this is considered orphaned

interface WebhookBucket {
    lastSentAt: number;
    sentThisMinute: number;
    windowStart: number;
}

class QueueService {
    private running = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private processing = false;
    private webhookBuckets: Map<string, WebhookBucket> = new Map();

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

        // Group by webhookUrl
        const byWebhook = new Map<string, typeof pending>();

        for (const notification of pending) {
            if (!notification.channel?.webhookUrl) {
                // No webhook — mark as FAILED
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: NotificationStatus.FAILED,
                        error: 'Channel has no webhook configured',
                    },
                });
                continue;
            }

            const url = notification.channel.webhookUrl;
            const group = byWebhook.get(url) || [];
            group.push(notification);
            byWebhook.set(url, group);
        }

        // Process each webhook group concurrently, but sequential within each group
        const webhookPromises = Array.from(byWebhook.entries()).map(
            ([webhookUrl, notifications]) =>
                this.processWebhookGroup(webhookUrl, notifications)
        );

        await Promise.all(webhookPromises);
    }

    /**
     * Process notifications for a single webhook sequentially with rate limiting
     */
    private async processWebhookGroup(
        webhookUrl: string,
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
            await this.waitForRateLimit(webhookUrl);

            // Mark as RETRYING
            await prisma.notification.update({
                where: { id: notification.id },
                data: { status: NotificationStatus.RETRYING },
            });

            try {
                const result = await discordService.sendSingle(
                    notification.channel,
                    {
                        title: notification.title,
                        message: notification.message,
                        color: notification.color,
                        source: notification.source,
                        senderAvatarUrl: notification.senderAvatarUrl,
                    }
                );

                if (result.success) {
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: NotificationStatus.SENT,
                            sentAt: new Date(),
                            retries: notification.retries,
                        },
                    });
                    this.recordSend(webhookUrl);
                } else if (result.rateLimited) {
                    // Put back to PENDING, will be retried next tick
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: NotificationStatus.PENDING,
                            retries: notification.retries + 1,
                        },
                    });
                    // Stop processing this webhook group — we're rate limited
                    console.log(`[Genotify] Rate limited on webhook, pausing group`);
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
     * Wait until we can send to this webhook without exceeding rate limit
     */
    private async waitForRateLimit(webhookUrl: string): Promise<void> {
        const bucket = this.getBucket(webhookUrl);
        const now = Date.now();

        // Reset counter if window has passed
        if (now - bucket.windowStart > 60000) {
            bucket.sentThisMinute = 0;
            bucket.windowStart = now;
        }

        // If we've hit the limit, wait for window reset
        if (bucket.sentThisMinute >= MAX_PER_WEBHOOK_PER_MIN) {
            const waitTime = 60000 - (now - bucket.windowStart) + 100;
            console.log(`[Genotify] Rate limit reached for webhook, waiting ${waitTime}ms`);
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
    private recordSend(webhookUrl: string): void {
        const bucket = this.getBucket(webhookUrl);
        bucket.lastSentAt = Date.now();
        bucket.sentThisMinute++;
    }

    /**
     * Get or create a rate limit bucket for a webhook
     */
    private getBucket(webhookUrl: string): WebhookBucket {
        let bucket = this.webhookBuckets.get(webhookUrl);
        if (!bucket) {
            bucket = { lastSentAt: 0, sentThisMinute: 0, windowStart: Date.now() };
            this.webhookBuckets.set(webhookUrl, bucket);
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
