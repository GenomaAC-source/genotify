/**
 * Discord webhook service
 * Handles sending messages to Discord via webhooks with rate limiting and retry logic
 */

import { Channel } from '@prisma/client';
import { getDiscordClient, isDiscordReady } from '../discord/client.js';

interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp: string;
    footer: { text: string };
}

interface EmbedPayload {
    username: string;
    embeds: DiscordEmbed[];
}

interface PlainTextPayload {
    content: string;
    username?: string;
    avatar_url?: string;
    allowed_mentions: { parse: string[] };
}

interface NotificationData {
    title?: string | null;
    message: string;
    color?: string | null;
    source: string;
    senderAvatarUrl?: string | null;
    metadata?: Record<string, unknown>;
}

const colorMap: Record<string, number> = {
    info: 0x5865f2,
    success: 0x57f287,
    warning: 0xfee75c,
    error: 0xed4245,
    task: 0xeb459e,
};

function shouldSendAsPlainText(notification: NotificationData): boolean {
    const hasTitle = notification.title !== null && notification.title !== undefined && notification.title !== '';
    const hasColor = notification.color !== null && notification.color !== undefined && notification.color !== '';
    return !hasTitle && !hasColor;
}

export class DiscordService {
    async sendSingle(
        channel: Channel,
        notification: NotificationData
    ): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
        if (!channel.webhookUrl) {
            return { success: false, error: 'Channel has no webhook URL configured' };
        }

        const payload = shouldSendAsPlainText(notification)
            ? this.buildPlainTextPayload(notification)
            : this.buildEmbedPayload(channel, notification);

        try {
            const response = await fetch(channel.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`[Genotify] Sent notification to ${channel.name}`);
                return { success: true };
            }

            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                console.log(
                    `[Genotify] Rate limited on ${channel.name} (retry-after: ${retryAfter}s)`
                );
                return { success: false, rateLimited: true, error: 'Rate limited by Discord' };
            }

            const error = `Discord error: ${response.status} ${response.statusText}`;
            console.error(`[Genotify] ${error}`);
            return { success: false, error };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown network error';
            console.error(`[Genotify] Network error: ${msg}`);
            return { success: false, error: msg };
        }
    }

    private buildPlainTextPayload(notification: NotificationData): PlainTextPayload {
        const payload: PlainTextPayload = {
            content: notification.message,
            username: notification.source,
            allowed_mentions: { parse: [] },
        };

        if (notification.senderAvatarUrl) {
            payload.avatar_url = notification.senderAvatarUrl;
        }

        return payload;
    }

    private buildEmbed(channel: Channel, notification: NotificationData): DiscordEmbed {
        const fields: Array<{ name: string; value: string; inline?: boolean }> = [
            { name: 'Fonte', value: notification.source, inline: true },
        ];

        if (channel.type === 'CLIENT' && (channel.clientName || channel.clientSlug)) {
            fields.push({
                name: 'Cliente',
                value: channel.clientName || channel.clientSlug || '',
                inline: true,
            });
        }

        return {
            title: notification.title || '',
            description: notification.message,
            color: colorMap[notification.color || 'info'] || colorMap.info,
            fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'GeNotify' },
        };
    }

    private buildEmbedPayload(
        channel: Channel,
        notification: NotificationData
    ): EmbedPayload {
        return {
            username: 'GeNotify',
            embeds: [this.buildEmbed(channel, notification)],
        };
    }

    async sendDM(
        channel: Channel,
        notification: NotificationData
    ): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
        if (!channel.discordUserId) {
            return { success: false, error: 'Channel has no Discord user ID configured' };
        }

        if (!isDiscordReady()) {
            return { success: false, error: 'Discord client not ready' };
        }

        const client = getDiscordClient();
        if (!client) {
            return { success: false, error: 'Discord client not available' };
        }

        try {
            const user = await client.users.fetch(channel.discordUserId);
            const dm = await user.createDM();

            const isPlain = shouldSendAsPlainText(notification);
            if (isPlain) {
                await dm.send({
                    content: notification.message,
                    allowedMentions: { parse: [] },
                });
            } else {
                await dm.send({
                    embeds: [this.buildEmbed(channel, notification)],
                });
            }

            console.log(
                `[Genotify] Sent DM to ${channel.name} (${channel.discordUserId})`
            );
            return { success: true };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown DM error';
            const lower = msg.toLowerCase();

            if (lower.includes('rate limit') || lower.includes('rate-limit')) {
                console.log(`[Genotify] Rate limited on DM to ${channel.discordUserId}`);
                return { success: false, rateLimited: true, error: msg };
            }

            console.error(
                `[Genotify] DM error to ${channel.discordUserId}: ${msg}`
            );
            return { success: false, error: msg };
        }
    }
}

export const discordService = new DiscordService();
