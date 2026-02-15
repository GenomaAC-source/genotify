import { Client, ChannelType, TextChannel } from "discord.js";
import { prisma } from "./lib/prisma.js";
import type { Channel as PrismaChannel } from "@prisma/client";

/**
 * Determina il tipo di canale basandosi sul nome della categoria
 */
function determineChannelType(categoryName: string | null): "CLIENT" | "INTERNAL" | "VENDOR" {
  if (!categoryName) return "INTERNAL";

  const lower = categoryName.toLowerCase();

  if (lower.includes("client") || lower.includes("progetti")) {
    return "CLIENT";
  }
  if (lower.includes("fornitore") || lower.includes("vendor")) {
    return "VENDOR";
  }

  return "INTERNAL";
}

/**
 * Estrae lo slug del cliente dal nome del canale
 * Esempio: "cliente-acme" → "acme", "progetto-beta" → "beta"
 */
function extractClientSlug(channelName: string, channelType: "CLIENT" | "INTERNAL" | "VENDOR"): string | null {
  if (channelType !== "CLIENT") return null;

  const patterns = [
    /^cliente-(.+)$/,
    /^progetto-(.+)$/,
    /^client-(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = channelName.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Crea o ottiene un webhook per un canale Discord
 */
async function ensureWebhook(channel: TextChannel): Promise<{ id: string; url: string } | null> {
  try {
    // Cerca webhook esistenti
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((wh) => wh.name === "Genotify");

    // Se non esiste, crealo
    if (!webhook) {
      console.log(`[DiscordBot] Creating webhook for channel: ${channel.name}`);
      webhook = await channel.createWebhook({
        name: "Genotify",
        avatar: undefined,
        reason: "Automated webhook creation by Genotify bot",
      });
    }

    return {
      id: webhook.id,
      url: webhook.url,
    };
  } catch (error) {
    console.error(`[DiscordBot] Failed to create webhook for ${channel.name}:`, error);
    return null;
  }
}

/**
 * Sincronizza un singolo canale Discord → database
 */
export async function syncChannel(client: Client, channelId: string): Promise<PrismaChannel | null> {
  try {
    const channel = await client.channels.fetch(channelId);

    // Supportiamo solo canali di testo
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }

    const textChannel = channel as TextChannel;
    const categoryName = textChannel.parent?.name || null;
    const channelType = determineChannelType(categoryName);
    const clientSlug = extractClientSlug(textChannel.name, channelType);

    // Crea o ottieni webhook
    const webhook = await ensureWebhook(textChannel);

    // Upsert nel database
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

    console.log(`[DiscordBot] Synced channel: ${textChannel.name} (${channelType})`);
    return dbChannel;
  } catch (error) {
    console.error(`[DiscordBot] Error syncing channel ${channelId}:`, error);
    return null;
  }
}

/**
 * Sincronizza tutti i canali del server Discord → database
 */
export async function syncAllChannels(client: Client, guildId: string): Promise<void> {
  try {
    console.log("[DiscordBot] Starting full channel sync...");

    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();

    const textChannels = channels.filter(
      (ch) => ch?.type === ChannelType.GuildText
    );

    console.log(`[DiscordBot] Found ${textChannels.size} text channels to sync`);

    let synced = 0;
    let failed = 0;

    for (const [channelId, _] of textChannels) {
      const result = await syncChannel(client, channelId);
      if (result) {
        synced++;
      } else {
        failed++;
      }
    }

    // Disattiva canali che non esistono più su Discord
    const allDbChannels = await prisma.channel.findMany({
      where: { autoManaged: true },
    });

    const discordChannelIds = new Set(textChannels.keys());

    for (const dbChannel of allDbChannels) {
      if (!discordChannelIds.has(dbChannel.discordId)) {
        await prisma.channel.update({
          where: { id: dbChannel.id },
          data: { active: false },
        });
        console.log(`[DiscordBot] Deactivated deleted channel: ${dbChannel.name}`);
      }
    }

    console.log(`[DiscordBot] Sync complete: ${synced} synced, ${failed} failed`);
  } catch (error) {
    console.error("[DiscordBot] Error during full sync:", error);
  }
}
