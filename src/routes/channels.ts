/**
 * Channels listing endpoint
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { isDiscordReady, resyncAllChannels } from '../discord/client.js';

const router = Router();

router.post('/resync', async (_req: Request, res: Response) => {
    if (!isDiscordReady()) {
        return res.status(503).json({
            success: false,
            error: 'Discord client not ready',
        });
    }

    try {
        const report = await resyncAllChannels();
        return res.status(200).json({ success: true, ...report });
    } catch (error) {
        console.error('[Genotify] Resync failed:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Resync failed',
        });
    }
});

router.get('/', async (req: Request, res: Response) => {
    try {
        const channels = await prisma.channel.findMany({
            where: { active: true },
            orderBy: { name: 'asc' },
        });

        const clients = channels
            .filter((ch) => ch.type === 'CLIENT')
            .map((ch) => ({
                slug: ch.clientSlug || '',
                name: ch.clientName || '',
                channelName: ch.name,
                active: ch.active,
            }));

        const internal = channels
            .filter((ch) => ch.type === 'INTERNAL')
            .map((ch) => ({
                name: ch.name,
                channelName: ch.name,
            }));

        const vendors = channels
            .filter((ch) => ch.type === 'VENDOR')
            .map((ch) => ({
                name: ch.name,
                channelName: ch.name,
            }));

        res.status(200).json({
            clients,
            internal,
            vendors,
        });
    } catch (error) {
        console.error('[Genotify] Error fetching channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch channels',
        });
    }
});

export default router;
