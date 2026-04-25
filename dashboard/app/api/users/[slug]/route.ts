import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
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

    const { slug } = await params;

    try {
        const res = await fetch(
            `${apiUrl.replace(/\/$/, "")}/users/${encodeURIComponent(slug)}`,
            {
                method: "DELETE",
                headers: { "x-api-key": apiKey },
            }
        );
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[Dashboard] Users DELETE proxy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete user" },
            { status: 502 }
        );
    }
}
