"use client";

import { useState, useEffect } from "react";
import {
    Send,
    Terminal,
    CheckCircle,
    AlertCircle,
    Play,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = {
    id: string;
    name: string;
    clientSlug?: string;
};

export default function TestPage() {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [target, setTarget] = useState("");
    const [title, setTitle] = useState("Test Notifica");
    const [message, setMessage] = useState("Questa è una notifica di test inviata dalla dashboard.");
    const [color, setColor] = useState("info");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        fetch("/api/channels")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setChannels(data);
                    if (data.length > 0) setTarget(data[0].clientSlug || data[0].name);
                }
            });
    }, []);

    const handleSend = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target,
                    source: "Dashboard Test Tool",
                    title,
                    message,
                    color
                })
            });
            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setResult({ success: false, error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="pb-6 border-b border-border">
                <h1 className="text-2xl font-semibold tracking-tight text-white">System Tester</h1>
                <p className="text-sm text-muted-foreground mt-1">Manually trigger notifications to verify webhook configurations.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Panel */}
                <div className="technical-card p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target (Channel or Client)</label>
                            <select
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 appearance-none"
                            >
                                {channels.map(c => (
                                    <option key={c.id} value={c.clientSlug || c.name}>
                                        {c.name} {c.clientSlug ? `(@${c.clientSlug})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message</label>
                            <textarea
                                rows={4}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none font-sans"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Embed Color</label>
                            <div className="flex gap-2">
                                {['info', 'success', 'warning', 'error', 'task'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            "flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                                            color === c
                                                ? `bg-${c === 'info' ? 'blue' : c === 'success' ? 'emerald' : c === 'warning' ? 'amber' : c === 'error' ? 'red' : 'purple'}-500/10 border-${c === 'info' ? 'blue' : c === 'success' ? 'emerald' : c === 'warning' ? 'amber' : c === 'error' ? 'red' : 'purple'}-500/20 text-${c === 'info' ? 'blue' : c === 'success' ? 'emerald' : c === 'warning' ? 'amber' : c === 'error' ? 'red' : 'purple'}-500`
                                                : "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                                        )}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={loading || !target}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-white/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Send Test Notification</span>
                    </button>
                </div>

                {/* Console Panel */}
                <div className="technical-card p-0 flex flex-col bg-[#0c0c0e] border-zinc-800 overflow-hidden h-full">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                        <Terminal className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground font-mono">Output Console</span>
                    </div>

                    <div className="flex-1 p-4 font-mono text-xs overflow-auto">
                        {result ? (
                            <pre className={cn(
                                "whitespace-pre-wrap break-all",
                                result.success ? "text-emerald-400" : "text-red-400"
                            )}>
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-700">
                                <Play className="w-8 h-8 opacity-20" />
                                <span>Waiting for request...</span>
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-zinc-800 bg-zinc-900/30 flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                        <span>READY</span>
                        <span>POST /api/notify</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
