/**
 * Notification endpoints
 */

import { Router, Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';

const router = Router();

const VALID_COLORS = ['info', 'success', 'warning', 'error', 'task'];

interface ValidatedPayload {
    target: string;
    source: string;
    title?: string;
    message: string;
    color?: string;
    senderAvatarUrl?: string;
    metadata?: Record<string, unknown>;
}

function validateNotificationPayload(body: unknown): {
    valid: boolean;
    error?: string;
    data?: ValidatedPayload;
} {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Request body must be an object' };
    }

    const payload = body as Record<string, unknown>;
    const missing: string[] = [];

    if (!payload.target || typeof payload.target !== 'string') missing.push('target');
    if (!payload.source || typeof payload.source !== 'string') missing.push('source');
    if (!payload.message || typeof payload.message !== 'string') missing.push('message');

    if (missing.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missing.join(', ')}`,
        };
    }

    if (payload.title !== undefined && typeof payload.title !== 'string') {
        return { valid: false, error: 'title must be a string' };
    }

    const color = payload.color as string | undefined;
    if (color !== undefined && !VALID_COLORS.includes(color)) {
        return {
            valid: false,
            error: `Invalid color. Must be one of: ${VALID_COLORS.join(', ')}`,
        };
    }

    const senderAvatarUrl = payload.senderAvatarUrl;
    if (senderAvatarUrl !== undefined) {
        if (typeof senderAvatarUrl !== 'string' || !/^https?:\/\//i.test(senderAvatarUrl)) {
            return { valid: false, error: 'senderAvatarUrl must be an http(s) URL' };
        }
    }

    return {
        valid: true,
        data: {
            target: payload.target as string,
            source: payload.source as string,
            title: payload.title as string | undefined,
            message: payload.message as string,
            color,
            senderAvatarUrl: senderAvatarUrl as string | undefined,
            metadata: payload.metadata as Record<string, unknown> | undefined,
        },
    };
}

router.post('/', async (req: Request, res: Response) => {
    const validation = validateNotificationPayload(req.body);

    if (!validation.valid || !validation.data) {
        res.status(400).json({ success: false, error: validation.error });
        return;
    }

    const result = await notificationService.send(validation.data);

    if (!result.success) {
        if (result.error?.includes('not found')) {
            res.status(404).json(result);
        } else if (result.error?.includes('no webhook')) {
            res.status(422).json(result);
        } else {
            res.status(500).json(result);
        }
        return;
    }

    res.status(200).json(result);
});

router.post('/bulk', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    if (!body.targets || !Array.isArray(body.targets) || body.targets.length === 0) {
        res.status(400).json({ success: false, error: 'Missing or invalid targets array' });
        return;
    }

    const missing: string[] = [];
    if (!body.source || typeof body.source !== 'string') missing.push('source');
    if (!body.message || typeof body.message !== 'string') missing.push('message');

    if (missing.length > 0) {
        res.status(400).json({
            success: false,
            error: `Missing required fields: ${missing.join(', ')}`,
        });
        return;
    }

    if (body.title !== undefined && typeof body.title !== 'string') {
        res.status(400).json({ success: false, error: 'title must be a string' });
        return;
    }

    const color = body.color as string | undefined;
    if (color !== undefined && !VALID_COLORS.includes(color)) {
        res.status(400).json({
            success: false,
            error: `Invalid color. Must be one of: ${VALID_COLORS.join(', ')}`,
        });
        return;
    }

    const senderAvatarUrl = body.senderAvatarUrl;
    if (senderAvatarUrl !== undefined) {
        if (typeof senderAvatarUrl !== 'string' || !/^https?:\/\//i.test(senderAvatarUrl)) {
            res.status(400).json({
                success: false,
                error: 'senderAvatarUrl must be an http(s) URL',
            });
            return;
        }
    }

    const result = await notificationService.sendBulk(body.targets as string[], {
        source: body.source as string,
        title: body.title as string | undefined,
        message: body.message as string,
        color,
        senderAvatarUrl: senderAvatarUrl as string | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
    });

    res.status(200).json(result);
});

export default router;
