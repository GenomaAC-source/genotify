import { Client, Events, ChannelType } from 'discord.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export function registerChannelDeleteHandler(client: Client): void {
    client.on(Events.ChannelDelete, async (channel) => {
        try {
            if (!('guild' in channel)) return;
            if (channel.guildId !== env.discordGuildId) return;
            if (channel.type !== ChannelType.GuildText) return;

            console.log(`[Genotify] Channel deleted: ${channel.name}`);

            await prisma.channel.updateMany({
                where: { discordId: channel.id },
                data: { active: false },
            });
        } catch (error) {
            console.error('[Genotify] Error handling channelDelete:', error);
        }
    });
}
