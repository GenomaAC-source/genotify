import { Client, Events, ChannelType } from 'discord.js';
import { syncChannel } from '../sync.js';
import { env } from '../../config/env.js';

export function registerChannelCreateHandler(client: Client): void {
    client.on(Events.ChannelCreate, async (channel) => {
        try {
            if (!('guildId' in channel) || channel.guildId !== env.discordGuildId) return;
            if (channel.type !== ChannelType.GuildText) return;

            console.log(`[Genotify] New channel created: ${channel.name}`);
            await syncChannel(client, channel.id);
        } catch (error) {
            console.error('[Genotify] Error handling channelCreate:', error);
        }
    });
}
