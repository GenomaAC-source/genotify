import { Client, Events, GuildChannel, ChannelType } from "discord.js";
import { syncChannel } from "../sync.js";
import { env } from "../config/env.js";

export function registerChannelCreateHandler(client: Client): void {
  client.on(Events.ChannelCreate, async (channel: GuildChannel) => {
    try {
      // Ignora canali che non sono del server configurato
      if (channel.guildId !== env.DISCORD_GUILD_ID) return;

      // Ignora canali che non sono di testo
      if (channel.type !== ChannelType.GuildText) return;

      console.log(`[DiscordBot] New channel created: ${channel.name}`);

      // Sincronizza il canale
      await syncChannel(client, channel.id);
    } catch (error) {
      console.error("[DiscordBot] Error handling channelCreate:", error);
    }
  });
}
