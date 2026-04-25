import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiUrl = process.env.GENOTIFY_API_URL;
    const apiKey = process.env.GENOTIFY_API_KEY;
    if (!apiUrl || !apiKey) {
        return NextResponse.json(
            { error: "GENOTIFY_API_URL or GENOTIFY_API_KEY not configured" },
            { status: 500 }
        );
    }

    const incoming = new URL(req.url);
    const search = incoming.searchParams.toString();
    const target = `${apiUrl.replace(/\/$/, "")}/discord/members${search ? `?${search}` : ""}`;

    try {
        const res = await fetch(target, {
            headers: { "x-api-key": apiKey },
            cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[Dashboard] Discord members proxy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch members" },
            { status: 502 }
        );
    }
}
