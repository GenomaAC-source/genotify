/**
 * DM users endpoints
 * Manage Discord users that can be targeted via direct message
 */

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const router = Router();

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

router.get('/', async (_req: Request, res: Response) => {
    try {
        const users = await prisma.channel.findMany({
            where: { type: 'USER', active: true },
            orderBy: { name: 'asc' },
        });

        res.status(200).json({
            users: users.map((u) => ({
                slug: u.userSlug || '',
                name: u.name,
                discordUserId: u.discordUserId || '',
            })),
        });
    } catch (error) {
        console.error('[Genotify] Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;

    const slug = body.slug;
    const name = body.name;
    const discordUserId = body.discordUserId;

    const missing: string[] = [];
    if (!slug || typeof slug !== 'string') missing.push('slug');
    if (!name || typeof name !== 'string') missing.push('name');
    if (!discordUserId || typeof discordUserId !== 'string') missing.push('discordUserId');

    if (missing.length > 0) {
        res.status(400).json({
            success: false,
            error: `Missing required fields: ${missing.join(', ')}`,
        });
        return;
    }

    if (!SNOWFLAKE_REGEX.test(discordUserId as string)) {
        res.status(400).json({
            success: false,
            error: 'discordUserId must be a Discord snowflake (17-20 digits)',
        });
        return;
    }

    try {
        const user = await prisma.channel.upsert({
            where: { userSlug: slug as string },
            update: {
                name: name as string,
                discordUserId: discordUserId as string,
                type: 'USER',
                active: true,
                autoManaged: false,
            },
            create: {
                userSlug: slug as string,
                name: name as string,
                discordUserId: discordUserId as string,
                type: 'USER',
                active: true,
                autoManaged: false,
            },
        });

        res.status(200).json({
            success: true,
            user: {
                slug: user.userSlug,
                name: user.name,
                discordUserId: user.discordUserId,
            },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            res.status(409).json({
                success: false,
                error: 'discordUserId already in use by another user slug',
            });
            return;
        }
        console.error('[Genotify] Error upserting user:', error);
        res.status(500).json({ success: false, error: 'Failed to upsert user' });
    }
});

router.delete('/:slug', async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const user = await prisma.channel.findFirst({
            where: { userSlug: slug, type: 'USER' },
        });

        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }

        await prisma.channel.update({
            where: { id: user.id },
            data: { active: false },
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[Genotify] Error deactivating user:', error);
        res.status(500).json({ success: false, error: 'Failed to deactivate user' });
    }
});

export default router;
