"use client";

import { useState, useEffect } from "react";
import {
    Plus,
    Settings,
    Trash2,
    Search,
    Users,
    Building2,
    Shield,
    X,
    Loader2,
    MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = {
    id: string;
    name: string;
    type: 'CLIENT' | 'INTERNAL' | 'VENDOR';
    clientSlug?: string | null;
    clientName?: string | null;
    webhookUrl?: string | null;
    active: boolean;
};

export default function ChannelsPage() {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        type: "INTERNAL" as const,
        clientSlug: "",
        clientName: "",
        webhookUrl: ""
    });

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        try {
            const res = await fetch("/api/channels");
            const data = await res.json();
            if (Array.isArray(data)) setChannels(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/channels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                await fetchChannels();
                setIsModalOpen(false);
                setFormData({ name: "", type: "INTERNAL", clientSlug: "", clientName: "", webhookUrl: "" });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredChannels = channels.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.clientSlug || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.clientName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between pb-6 border-b border-border">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">Channels</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage notification destinations and webhooks.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Channel</span>
                </button>
            </header>

            <div className="flex items-center gap-4 py-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
                    />
                </div>
            </div>

            <div className="technical-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-border bg-zinc-900/50 text-xs text-muted-foreground uppercase tracking-wider">
                            <th className="px-6 py-3 font-medium w-12">Type</th>
                            <th className="px-6 py-3 font-medium">Name</th>
                            <th className="px-6 py-3 font-medium">Client / Slug</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-muted-foreground" />
                                </td>
                            </tr>
                        ) : filteredChannels.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">
                                    No channels found. Create one to get started.
                                </td>
                            </tr>
                        ) : filteredChannels.map((channel) => (
                            <tr key={channel.id} className="hover:bg-zinc-900/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className={cn(
                                        "w-8 h-8 rounded-md flex items-center justify-center border",
                                        channel.type === 'CLIENT' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                            channel.type === 'INTERNAL' ? "bg-purple-500/10 border-purple-500/20 text-purple-500" :
                                                "bg-orange-500/10 border-orange-500/20 text-orange-500"
                                    )}>
                                        {channel.type === 'CLIENT' ? <Building2 className="w-4 h-4" /> :
                                            channel.type === 'INTERNAL' ? <Shield className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-white">{channel.name}</div>
                                    <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                                        {channel.webhookUrl ? "Webhook Configured" : "No Webhook"}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-zinc-300">{channel.clientName || "-"}</span>
                                        {channel.clientSlug && (
                                            <span className="text-xs font-mono text-muted-foreground">@{channel.clientSlug}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "text-xs font-medium px-2.5 py-0.5 rounded-full border",
                                        channel.active
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                            : "bg-red-500/10 text-red-500 border-red-500/20"
                                    )}>
                                        {channel.active ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 hover:bg-zinc-800 rounded-md transition-colors text-muted-foreground hover:text-white">
                                            <Settings className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 hover:bg-red-900/20 rounded-md transition-colors text-muted-foreground hover:text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* NEW CHANNEL MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
                    <div className="technical-card w-full max-w-lg p-0 bg-background shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <header className="flex justify-between items-center p-6 border-b border-border">
                            <h2 className="text-lg font-semibold text-white">Create New Channel</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Channel Name</label>
                                    <input
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. general-notifications"
                                        className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 appearance-none"
                                    >
                                        <option value="INTERNAL">Internal</option>
                                        <option value="CLIENT">Client</option>
                                        <option value="VENDOR">Vendor</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Webhook URL</label>
                                    <input
                                        type="url"
                                        value={formData.webhookUrl}
                                        onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                                        placeholder="https://discord.com/api/webhooks/..."
                                        className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                    />
                                </div>

                                {formData.type === 'CLIENT' && (
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Slug</label>
                                            <input
                                                value={formData.clientSlug}
                                                onChange={(e) => setFormData({ ...formData, clientSlug: e.target.value })}
                                                placeholder="acme"
                                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Name</label>
                                            <input
                                                value={formData.clientName}
                                                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                                placeholder="Acme Inc."
                                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Create Channel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
