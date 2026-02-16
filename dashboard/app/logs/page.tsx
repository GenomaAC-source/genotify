"use client";

import { useState, useEffect } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Search,
    Filter,
    Eye,
    Info,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
    id: string;
    target: string;
    source: string;
    title: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
    sentAt: string | null;
    error: string | null;
    createdAt: string;
    channel?: { name: string };
};

export default function LogsPage() {
    const [logs, setLogs] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/logs");
            const data = await res.json();
            if (Array.isArray(data)) setLogs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        filter === "ALL" || log.status === filter
    );

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between pb-6 border-b border-border">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">System Logs</h1>
                    <p className="text-sm text-muted-foreground mt-1">Real-time notification delivery history.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="p-2 border border-border rounded-md hover:bg-zinc-800 transition-colors text-muted-foreground hover:text-white"
                    title="Refresh Logs"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </header>

            <div className="flex gap-2 pb-4 overflow-x-auto">
                {["ALL", "SENT", "FAILED", "PENDING", "RETRYING"].map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                            filter === s
                                ? "bg-white text-black border-white"
                                : "bg-transparent text-muted-foreground border-border hover:border-zinc-600 hover:text-white"
                        )}
                    >
                        {s}
                    </button>
                ))}
            </div>

            <div className="technical-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-border bg-zinc-900/50 text-xs text-muted-foreground uppercase tracking-wider">
                            <th className="px-6 py-3 font-medium w-32">Status</th>
                            <th className="px-6 py-3 font-medium">Details</th>
                            <th className="px-6 py-3 font-medium">Target</th>
                            <th className="px-6 py-3 font-medium text-right">Timestamp</th>
                            <th className="px-6 py-3 font-medium w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white mx-auto opacity-50" />
                                </td>
                            </tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">
                                    No logs found matching your criteria.
                                </td>
                            </tr>
                        ) : filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors group text-sm">
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                        log.status === 'SENT' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                            log.status === 'FAILED' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                log.status === 'PENDING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                    "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                    )}>
                                        {log.status === 'SENT' && <CheckCircle2 className="w-3 h-3" />}
                                        {log.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                                        {log.status === 'PENDING' && <Clock className="w-3 h-3" />}
                                        {log.status === 'RETRYING' && <RefreshCw className="w-3 h-3 animate-spin" />}
                                        {log.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium text-white">{log.title}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                            <span className="font-mono bg-zinc-800 px-1 rounded text-[10px]">SRC:{log.source}</span>
                                            {log.error && <span className="text-red-400">Error: {log.error}</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-300">{log.target}</span>
                                        <span className="text-xs text-muted-foreground">{log.channel?.name || "Direct Webhook"}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground">
                                    {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 hover:bg-zinc-800 rounded-md transition-colors text-muted-foreground hover:text-white opacity-0 group-hover:opacity-100">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination / Footer Placeholder */}
                <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-zinc-900/30">
                    <span>Showing recent 50 logs</span>
                    <div className="flex gap-2">
                        <button disabled className="p-1 rounded hover:bg-zinc-800 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                        <button disabled className="p-1 rounded hover:bg-zinc-800 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
