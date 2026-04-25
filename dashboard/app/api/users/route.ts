import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

function getGenotifyConfig() {
    const apiUrl = process.env.GENOTIFY_API_URL;
    const apiKey = process.env.GENOTIFY_API_KEY;
    if (!apiUrl || !apiKey) return null;
    return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = getGenotifyConfig();
    if (!cfg) {
        return NextResponse.json(
            { error: "GENOTIFY_API_URL or GENOTIFY_API_KEY not configured" },
            { status: 500 }
        );
    }

    try {
        const res = await fetch(`${cfg.apiUrl}/users`, {
            headers: { "x-api-key": cfg.apiKey },
            cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[Dashboard] Users GET proxy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch users" },
            { status: 502 }
        );
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = getGenotifyConfig();
    if (!cfg) {
        return NextResponse.json(
            { error: "GENOTIFY_API_URL or GENOTIFY_API_KEY not configured" },
            { status: 500 }
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const res = await fetch(`${cfg.apiUrl}/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": cfg.apiKey,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[Dashboard] Users POST proxy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to upsert user" },
            { status: 502 }
        );
    }
}
