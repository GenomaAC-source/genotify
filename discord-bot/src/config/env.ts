import { config } from "dotenv";

config();

interface Env {
  DISCORD_BOT_TOKEN: string;
  DISCORD_GUILD_ID: string;
  DATABASE_URL: string;
  NODE_ENV: string;
}

function loadEnv(): Env {
  const required = ["DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID", "DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN!,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID!,
    DATABASE_URL: process.env.DATABASE_URL!,
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}

export const env = loadEnv();
