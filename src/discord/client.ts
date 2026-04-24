import { Client, GatewayIntentBits, Events } from 'discord.js';
import { env } from '../config/env.js';
import { syncAllChannels, type SyncReport } from './sync.js';
import { registerChannelCreateHandler } from './events/channelCreate.js';
import { registerChannelUpdateHandler } from './events/channelUpdate.js';
import { registerChannelDeleteHandler } from './events/channelDelete.js';

let client: Client | null = null;
let ready = false;

export function isDiscordConfigured(): boolean {
    return Boolean(env.discordBotToken && env.discordGuildId);
}

export function getDiscordClient(): Client | null {
    return client;
}

export function isDiscordReady(): boolean {
    return ready && client !== null;
}

export async function startDiscordClient(): Promise<void> {
    if (!isDiscordConfigured()) {
        console.warn('[Genotify] DISCORD_BOT_TOKEN or DISCORD_GUILD_ID missing — Discord client not started');
        return;
    }

    client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    client.once(Events.ClientReady, async (readyClient) => {
        ready = true;
        console.log(`[Genotify] Discord logged in as ${readyClient.user.tag}`);
        try {
            await syncAllChannels(readyClient, env.discordGuildId!);
        } catch (error) {
            console.error('[Genotify] Initial sync failed:', error);
        }
    });

    registerChannelCreateHandler(client);
    registerChannelUpdateHandler(client);
    registerChannelDeleteHandler(client);

    client.on(Events.Error, (error) => {
        console.error('[Genotify] Discord client error:', error);
    });

    try {
        await client.login(env.discordBotToken!);
    } catch (error) {
        console.error('[Genotify] Discord login failed:', error);
        client = null;
    }
}

export async function stopDiscordClient(): Promise<void> {
    if (client) {
        await client.destroy();
        client = null;
        ready = false;
    }
}

export async function resyncAllChannels(): Promise<SyncReport> {
    if (!client || !ready) {
        throw new Error('Discord client not ready');
    }
    if (!env.discordGuildId) {
        throw new Error('DISCORD_GUILD_ID not configured');
    }
    return syncAllChannels(client, env.discordGuildId);
}
