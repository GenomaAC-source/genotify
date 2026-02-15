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
    private readonly maxRetries = 3;
    private readonly retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

    /**
     * Send a notification to a Discord webhook
     */
    async sendNotification(
        channel: Channel,
        notification: NotificationData
    ): Promise<{ success: boolean; error?: string; retries: number }> {
        if (!channel.webhookUrl) {
            return {
                success: false,
                error: 'Channel has no webhook URL configured',
                retries: 0,
            };
        }

        const payload = this.buildPayload(channel, notification);
        let lastError: string = '';
        let retries = 0;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(channel.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    console.log(
                        `[Genotify] Successfully sent notification to ${channel.name}`
                    );
                    return { success: true, retries };
                }

                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after');
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.retryDelays[attempt] || 5000;

                    console.log(
                        `[Genotify] Rate limited on ${channel.name}, waiting ${waitTime}ms`
                    );

                    await this.sleep(waitTime);
                    retries++;
                    continue;
                }

                // Handle server errors (5xx)
                if (response.status >= 500) {
                    lastError = `Discord server error: ${response.status} ${response.statusText}`;
                    console.error(`[Genotify] ${lastError}`);

                    if (attempt < this.maxRetries) {
                        await this.sleep(this.retryDelays[attempt]);
                        retries++;
                        continue;
                    }
                }

                // Client errors (4xx) - don't retry
                lastError = `Discord client error: ${response.status} ${response.statusText}`;
                console.error(`[Genotify] ${lastError}`);
                return { success: false, error: lastError, retries };
            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown network error';
                console.error(`[Genotify] Network error: ${lastError}`);

                if (attempt < this.maxRetries) {
                    await this.sleep(this.retryDelays[attempt]);
                    retries++;
                    continue;
                }
            }
        }

        return {
            success: false,
            error: lastError || 'Max retries exceeded',
            retries,
        };
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

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const discordService = new DiscordService();
