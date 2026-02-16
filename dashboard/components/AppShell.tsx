"use client";

import Sidebar from "@/components/Sidebar";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const pathname = usePathname();

    // Don't show shell on login page
    if (pathname === "/login") return <>{children}</>;

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans antialiased selection:bg-zinc-800 selection:text-white">
            <Sidebar />
            <main className="flex-1 ml-64 min-h-screen relative p-8 lg:p-12 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
