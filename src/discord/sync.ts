import { Client, ChannelType, TextChannel } from 'discord.js';
import { prisma } from '../lib/prisma.js';
import type { Channel as PrismaChannel } from '@prisma/client';

export type SyncReport = {
    synced: number;
    failed: number;
    deactivated: number;
};

function determineChannelType(categoryName: string | null): 'CLIENT' | 'INTERNAL' | 'VENDOR' {
    if (!categoryName) return 'INTERNAL';
    const lower = categoryName.toLowerCase();
    if (lower.includes('client') || lower.includes('progetti')) return 'CLIENT';
    if (lower.includes('fornitore') || lower.includes('vendor')) return 'VENDOR';
    return 'INTERNAL';
}

function extractClientSlug(
    channelName: string,
    channelType: 'CLIENT' | 'INTERNAL' | 'VENDOR'
): string | null {
    if (channelType !== 'CLIENT') return null;
    const patterns = [/^cliente-(.+)$/, /^progetto-(.+)$/, /^client-(.+)$/];
    for (const pattern of patterns) {
        const match = channelName.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function ensureWebhook(channel: TextChannel): Promise<{ id: string; url: string } | null> {
    try {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find((wh) => wh.name === 'Genotify');
        if (!webhook) {
            console.log(`[Genotify] Creating webhook for channel: ${channel.name}`);
            webhook = await channel.createWebhook({
                name: 'Genotify',
                reason: 'Automated webhook creation by Genotify',
            });
        }
        return { id: webhook.id, url: webhook.url };
    } catch (error) {
        console.error(`[Genotify] Failed to create webhook for ${channel.name}:`, error);
        return null;
    }
}

export async function syncChannel(client: Client, channelId: string): Promise<PrismaChannel | null> {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) return null;

        const textChannel = channel as TextChannel;
        const categoryName = textChannel.parent?.name || null;
        const channelType = determineChannelType(categoryName);
        const clientSlug = extractClientSlug(textChannel.name, channelType);
        const webhook = await ensureWebhook(textChannel);

        const dbChannel = await prisma.channel.upsert({
            where: { discordId: channelId },
            update: {
                name: textChannel.name,
                categoryName,
                type: channelType,
                clientSlug,
                clientName: clientSlug ? clientSlug.charAt(0).toUpperCase() + clientSlug.slice(1) : null,
                webhookId: webhook?.id,
                webhookUrl: webhook?.url,
                active: true,
                updatedAt: new Date(),
            },
            create: {
                discordId: channelId,
                name: textChannel.name,
                categoryName,
                type: channelType,
                clientSlug,
                clientName: clientSlug ? clientSlug.charAt(0).toUpperCase() + clientSlug.slice(1) : null,
                webhookId: webhook?.id,
                webhookUrl: webhook?.url,
                active: true,
                autoManaged: true,
            },
        });

        console.log(`[Genotify] Synced channel: ${textChannel.name} (${channelType})`);
        return dbChannel;
    } catch (error) {
        console.error(`[Genotify] Error syncing channel ${channelId}:`, error);
        return null;
    }
}

export async function syncAllChannels(client: Client, guildId: string): Promise<SyncReport> {
    console.log('[Genotify] Starting full channel sync...');

    const report: SyncReport = { synced: 0, failed: 0, deactivated: 0 };

    try {
        const guild = await client.guilds.fetch(guildId);
        const channels = await guild.channels.fetch();
        const textChannels = channels.filter((ch) => ch?.type === ChannelType.GuildText);

        console.log(`[Genotify] Found ${textChannels.size} text channels to sync`);

        for (const [channelId] of textChannels) {
            const result = await syncChannel(client, channelId);
            if (result) report.synced++;
            else report.failed++;
        }

        const allDbChannels = await prisma.channel.findMany({
            where: { autoManaged: true, NOT: { type: 'USER' } },
        });
        const discordChannelIds = new Set(textChannels.keys());

        for (const dbChannel of allDbChannels) {
            if (!dbChannel.discordId) continue;
            if (!discordChannelIds.has(dbChannel.discordId) && dbChannel.active) {
                await prisma.channel.update({
                    where: { id: dbChannel.id },
                    data: { active: false },
                });
                report.deactivated++;
                console.log(`[Genotify] Deactivated deleted channel: ${dbChannel.name}`);
            }
        }

        console.log(
            `[Genotify] Sync complete: ${report.synced} synced, ${report.failed} failed, ${report.deactivated} deactivated`
        );
    } catch (error) {
        console.error('[Genotify] Error during full sync:', error);
        throw error;
    }

    return report;
}
