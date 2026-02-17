import { Client, Events, GuildChannel, ChannelType } from "discord.js";
import { syncChannel } from "../sync.js";
import { env } from "../config/env.js";

export function registerChannelUpdateHandler(client: Client): void {
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    try {
      // Verifica che sia un canale del server (non DM)
      if (!('guild' in newChannel)) return;

      // Ignora canali che non sono del server configurato
      if (newChannel.guildId !== env.DISCORD_GUILD_ID) return;

      // Ignora canali che non sono di testo
      if (newChannel.type !== ChannelType.GuildText) return;

      const oldName = 'name' in oldChannel ? oldChannel.name : 'unknown';
      console.log(`[DiscordBot] Channel updated: ${oldName} → ${newChannel.name}`);

      // Ri-sincronizza il canale
      await syncChannel(client, newChannel.id);
    } catch (error) {
      console.error("[DiscordBot] Error handling channelUpdate:", error);
    }
  });
}
