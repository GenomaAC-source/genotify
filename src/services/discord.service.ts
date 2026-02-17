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

interface DiscordWebhookPayload {
    username: string;
    embeds: DiscordEmbed[];
}

interface NotificationData {
    title: string;
    message: string;
    color?: string;
    source: string;
    metadata?: Record<string, unknown>;
}

const colorMap: Record<string, number> = {
    info: 0x5865f2, // Blu Discord
    success: 0x57f287, // Verde
    warning: 0xfee75c, // Giallo
    error: 0xed4245, // Rosso
    task: 0xeb459e, // Viola
};

export class DiscordService {
    /**
     * Send a single notification attempt to Discord (no retry — queue handles retries)
     * Returns success, error, and whether it was a rate limit (429)
     */
    async sendSingle(
        channel: Channel,
        notification: NotificationData
    ): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
        if (!channel.webhookUrl) {
            return { success: false, error: 'Channel has no webhook URL configured' };
        }

        const payload = this.buildPayload(channel, notification);

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

    /**
     * Build Discord webhook payload
     */
    private buildPayload(
        channel: Channel,
        notification: NotificationData
    ): DiscordWebhookPayload {
        const fields: Array<{ name: string; value: string; inline?: boolean }> = [
            { name: 'Fonte', value: notification.source, inline: true },
        ];

        // Add client name for CLIENT type channels
        if (channel.type === 'CLIENT' && (channel.clientName || channel.clientSlug)) {
            fields.push({
                name: 'Cliente',
                value: channel.clientName || channel.clientSlug || '',
                inline: true,
            });
        }

        const embed: DiscordEmbed = {
            title: notification.title,
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
