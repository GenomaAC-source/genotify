import { Client, Events, ChannelType } from 'discord.js';
import { syncChannel } from '../sync.js';
import { env } from '../../config/env.js';

export function registerChannelUpdateHandler(client: Client): void {
    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
        try {
            if (!('guild' in newChannel)) return;
            if (newChannel.guildId !== env.discordGuildId) return;
            if (newChannel.type !== ChannelType.GuildText) return;

            const oldName = 'name' in oldChannel ? oldChannel.name : 'unknown';
            console.log(`[Genotify] Channel updated: ${oldName} → ${newChannel.name}`);

            await syncChannel(newChannel.client, newChannel.id);
        } catch (error) {
            console.error('[Genotify] Error handling channelUpdate:', error);
        }
    });
}
