import { Client, GatewayIntentBits, Events } from "discord.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { syncAllChannels } from "./sync.js";
import { registerChannelCreateHandler } from "./events/channelCreate.js";
import { registerChannelUpdateHandler } from "./events/channelUpdate.js";
import { registerChannelDeleteHandler } from "./events/channelDelete.js";

// Crea il client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Event: bot pronto
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[DiscordBot] ✅ Logged in as ${readyClient.user.tag}`);
  console.log(`[DiscordBot] Environment: ${env.NODE_ENV}`);

  // Sincronizza tutti i canali all'avvio
  await syncAllChannels(client, env.DISCORD_GUILD_ID);

  console.log("[DiscordBot] 🚀 Bot is ready and listening for events");
});

// Registra gli event handlers
registerChannelCreateHandler(client);
registerChannelUpdateHandler(client);
registerChannelDeleteHandler(client);

// Gestisci gli errori
client.on(Events.Error, (error) => {
  console.error("[DiscordBot] Client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[DiscordBot] Unhandled promise rejection:", error);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[DiscordBot] SIGTERM received, shutting down gracefully...");
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[DiscordBot] SIGINT received, shutting down gracefully...");
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

// Avvia il bot
console.log("[DiscordBot] Starting bot...");
client.login(env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("[DiscordBot] Failed to login:", error);
  process.exit(1);
});
