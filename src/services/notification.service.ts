/**
 * Notification orchestration service
 * Handles target resolution, notification creation, and sending
 */

import { prisma } from '../lib/prisma.js';
import { discordService } from './discord.service.js';
import { NotificationStatus, Prisma } from '@prisma/client';

interface NotificationPayload {
    target: string;
    source: string;
    title: string;
    message: string;
    color?: string;
    metadata?: Record<string, unknown>;
}

interface SendResult {
    success: boolean;
    notificationId?: string;
    error?: string;
}

interface BulkSendResult {
    success: boolean;
    results: Array<{
        target: string;
        success: boolean;
        notificationId?: string;
        error?: string;
    }>;
}

export class NotificationService {
    /**
     * Send a single notification
     */
    async send(payload: NotificationPayload): Promise<SendResult> {
        try {
            // Resolve target to channel
            const channel = await this.resolveTarget(payload.target);

            if (!channel) {
                return {
                    success: false,
                    error: `Target '${payload.target}' not found`,
                };
            }

            if (!channel.webhookUrl) {
                return {
                    success: false,
                    error: `Channel '${payload.target}' has no webhook configured`,
                };
            }

            // Create notification record
            const notification = await prisma.notification.create({
                data: {
                    channelId: channel.id,
                    target: payload.target,
                    source: payload.source,
                    title: payload.title,
                    message: payload.message,
                    color: payload.color || 'info',
                    metadata: (payload.metadata as Prisma.JsonValue) || undefined,
                    status: NotificationStatus.PENDING,
                },
            });

            // Send to Discord
            const result = await discordService.sendNotification(channel, {
                title: payload.title,
                message: payload.message,
                color: payload.color,
                source: payload.source,
                metadata: payload.metadata,
            });

            // Update notification status
            if (result.success) {
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: NotificationStatus.SENT,
                        sentAt: new Date(),
                        retries: result.retries,
                    },
                });

                return {
                    success: true,
                    notificationId: notification.id,
                };
            } else {
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: NotificationStatus.FAILED,
                        error: result.error,
                        retries: result.retries,
                    },
                });

                return {
                    success: false,
                    error: result.error,
                };
            }
        } catch (error) {
            console.error('[Genotify] Error sending notification:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Send to multiple targets
     */
    async sendBulk(
        targets: string[],
        payload: Omit<NotificationPayload, 'target'>
    ): Promise<BulkSendResult> {
        const results = await Promise.all(
            targets.map(async (target) => {
                const result = await this.send({ ...payload, target });
                return {
                    target,
                    success: result.success,
                    notificationId: result.notificationId,
                    error: result.error,
                };
            })
        );

        return {
            success: true,
            results,
        };
    }

    /**
     * Resolve target string to Channel
     * Priority: clientSlug (CLIENT type) -> name (any type)
     */
    private async resolveTarget(target: string) {
        // First try to find by clientSlug for CLIENT type channels
        let channel = await prisma.channel.findFirst({
            where: {
                clientSlug: target,
                type: 'CLIENT',
                active: true,
            },
        });

        // If not found, try by name (any type)
        if (!channel) {
            channel = await prisma.channel.findFirst({
                where: {
                    name: target,
                    active: true,
                },
            });
        }

        return channel;
    }
}

export const notificationService = new NotificationService();
