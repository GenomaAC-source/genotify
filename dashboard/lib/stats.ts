import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getStats() {
    const totalNotifications = await prisma.notification.count();
    const failedNotifications = await prisma.notification.count({ where: { status: 'FAILED' } });
    const activeChannels = await prisma.channel.count({ where: { active: true } });
    const recentLogs = await prisma.notification.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { channel: true }
    });

    return {
        totalNotifications,
        failedNotifications,
        activeChannels,
        recentLogs
    };
}
