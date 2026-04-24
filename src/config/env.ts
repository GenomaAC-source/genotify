/**
 * Environment configuration with validation
 */

import 'dotenv/config';

interface EnvConfig {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    apiKey: string;
    discordBotToken?: string;
    discordGuildId?: string;
    rateLimitWhitelistKeys: string[];
    plutioApiKey?: string;
    googleCalendarCredentials?: string;
}

function validateEnv(): EnvConfig {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    const nodeEnv = process.env.NODE_ENV || 'development';
    const databaseUrl = process.env.DATABASE_URL;
    const apiKey = process.env.API_KEY;

    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    if (!apiKey) {
        throw new Error('API_KEY environment variable is required');
    }

    return {
        port,
        nodeEnv,
        databaseUrl,
        apiKey,
        discordBotToken: process.env.DISCORD_BOT_TOKEN,
        discordGuildId: process.env.DISCORD_GUILD_ID,
        rateLimitWhitelistKeys: (process.env.RATE_LIMIT_WHITELIST_KEYS || '')
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
        plutioApiKey: process.env.PLUTIO_API_KEY,
        googleCalendarCredentials: process.env.GOOGLE_CALENDAR_CREDENTIALS,
    };
}

export const env = validateEnv();
