import { Client, Events, GuildChannel, ChannelType } from "discord.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export function registerChannelDeleteHandler(client: Client): void {
  client.on(Events.ChannelDelete, async (channel) => {
    try {
      // Verifica che sia un canale del server (non DM)
      if (!('guild' in channel)) return;

      // Ignora canali che non sono del server configurato
      if (channel.guildId !== env.DISCORD_GUILD_ID) return;

      // Ignora canali che non sono di testo
      if (channel.type !== ChannelType.GuildText) return;

      console.log(`[DiscordBot] Channel deleted: ${channel.name}`);

      // Disattiva il canale nel database (non eliminarlo, per mantenere lo storico)
      await prisma.channel.updateMany({
        where: { discordId: channel.id },
        data: { active: false },
      });

      console.log(`[DiscordBot] Deactivated channel in database: ${channel.name}`);
    } catch (error) {
      console.error("[DiscordBot] Error handling channelDelete:", error);
    }
  });
}
