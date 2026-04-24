import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST() {
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

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/channels/resync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return NextResponse.json(
                { error: data.error || "Resync failed", status: res.status },
                { status: res.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("[Dashboard] Resync proxy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Resync failed" },
            { status: 502 }
        );
    }
}
