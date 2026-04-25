/**
 * Discord helper endpoints
 * Exposes server-side queries against the embedded Discord bot.
 */

import { Router, Request, Response } from 'express';
import { getDiscordClient, isDiscordReady } from '../discord/client.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/members', async (req: Request, res: Response) => {
    if (!isDiscordReady()) {
        res.status(503).json({ success: false, error: 'Discord client not ready' });
        return;
    }

    const client = getDiscordClient();
    if (!client) {
        res.status(503).json({ success: false, error: 'Discord client not available' });
        return;
    }

    if (!env.discordGuildId) {
        res.status(500).json({ success: false, error: 'DISCORD_GUILD_ID not configured' });
        return;
    }

    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 10;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 25) : 10;

    if (rawQuery.length === 0) {
        res.status(200).json({ members: [] });
        return;
    }

    try {
        const guild = await client.guilds.fetch(env.discordGuildId);
        const members = await guild.members.fetch({ query: rawQuery, limit });

        const payload = Array.from(members.values()).map((member) => ({
            id: member.id,
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || member.user.username,
            avatarUrl: member.displayAvatarURL({ size: 64 }),
            bot: member.user.bot,
        }));

        res.status(200).json({ members: payload });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Genotify] Member search failed:', msg);
        res.status(500).json({ success: false, error: msg });
    }
});

export default router;
