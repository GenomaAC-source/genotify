/**
 * Notification orchestration service
 * Handles target resolution and notification creation.
 * Actual sending is handled by the queue worker.
 */

import { prisma } from '../lib/prisma.js';
import { NotificationStatus, Prisma } from '@prisma/client';

interface NotificationPayload {
    target: string;
    source: string;
    title?: string;
    message: string;
    color?: string;
    senderAvatarUrl?: string;
    metadata?: Record<string, unknown>;
}

interface SendResult {
    success: boolean;
    notificationId?: string;
    status?: string;
    error?: string;
}

interface BulkSendResult {
    success: boolean;
    results: Array<{
        target: string;
        success: boolean;
        notificationId?: string;
        status?: string;
        error?: string;
    }>;
}

export class NotificationService {
    async send(payload: NotificationPayload): Promise<SendResult> {
        try {
            const channel = await this.resolveTarget(payload.target);

            if (!channel) {
                return { success: false, error: `Target '${payload.target}' not found` };
            }

            if (!channel.webhookUrl) {
                return {
                    success: false,
                    error: `Channel '${payload.target}' has no webhook configured`,
                };
            }

            const notification = await prisma.notification.create({
                data: {
                    channelId: channel.id,
                    target: payload.target,
                    source: payload.source,
                    title: payload.title ?? '',
                    message: payload.message,
                    color: payload.color ?? null,
                    senderAvatarUrl: payload.senderAvatarUrl ?? null,
                    metadata: (payload.metadata as Prisma.JsonValue) || undefined,
                    status: NotificationStatus.PENDING,
                },
            });

            console.log(
                `[Genotify] Notification ${notification.id} queued for ${channel.name}`
            );

            return {
                success: true,
                notificationId: notification.id,
                status: 'queued',
            };
        } catch (error) {
            console.error('[Genotify] Error queuing notification:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

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
                    status: result.status,
                    error: result.error,
                };
            })
        );

        return { success: true, results };
    }

    /**
     * Priority: clientSlug (CLIENT type) -> name (any type)
     */
    private async resolveTarget(target: string) {
        let channel = await prisma.channel.findFirst({
            where: { clientSlug: target, type: 'CLIENT', active: true },
        });

        if (!channel) {
            channel = await prisma.channel.findFirst({
                where: { name: target, active: true },
            });
        }

        return channel;
    }
}

export const notificationService = new NotificationService();
