import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiUrl = process.env.GENOTIFY_API_URL;
    const apiKey = process.env.GENOTIFY_API_KEY;

    if (!apiUrl || !apiKey) {
        return NextResponse.json(
            { success: false, error: "GENOTIFY_API_URL or GENOTIFY_API_KEY not configured" },
            { status: 500 }
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/notify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[Dashboard] Notify proxy error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Notify failed",
            },
            { status: 502 }
        );
    }
}
