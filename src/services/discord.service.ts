/**
 * Discord webhook service
 * Handles sending messages to Discord via webhooks with rate limiting and retry logic
 */

import { Channel } from '@prisma/client';

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

    private buildEmbedPayload(
        channel: Channel,
        notification: NotificationData
    ): EmbedPayload {
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

        const embed: DiscordEmbed = {
            title: notification.title || '',
            description: notification.message,
            color: colorMap[notification.color || 'info'] || colorMap.info,
            fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'GeNotify' },
        };

        return {
            username: 'GeNotify',
            embeds: [embed],
        };
    }
}

export const discordService = new DiscordService();
