import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const channels = await prisma.channel.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(channels);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, type, clientSlug, clientName, webhookUrl, discordId } = body;

        const channel = await prisma.channel.create({
            data: {
                name,
                type,
                clientSlug: clientSlug || null,
                clientName: clientName || null,
                webhookUrl: webhookUrl || null,
                discordId: discordId || `manual-${Date.now()}`,
            }
        });

        return NextResponse.json(channel);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
    }
}
