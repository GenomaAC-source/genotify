"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Bell,
    LayoutDashboard,
    Settings,
    History,
    PlusCircle,
    LogOut,
    ChevronRight,
    Search
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const menuItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Canali", href: "/channels", icon: Settings },
    { name: "Logs", href: "/logs", icon: History },
    { name: "System Tester", href: "/test", icon: PlusCircle },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-background border-r border-border flex flex-col z-50">
            {/* Header */}
            <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
                <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-bold">
                    G
                </div>
                <span className="font-semibold text-sm tracking-tight text-white">GenomaHub</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                <div className="px-3 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
                    Menu
                </div>
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.name} href={item.href}>
                            <div className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                                isActive
                                    ? "bg-accent text-white"
                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                            )}>
                                <item.icon className="w-4 h-4" />
                                <span>{item.name}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile / Footer */}
            <div className="p-4 border-t border-border">
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-zinc-900"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
