"use client";

import { useState, useEffect, useRef } from "react";
import {
    Plus,
    Trash2,
    Search,
    UserCircle2,
    X,
    Loader2,
    Send,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DmUser = {
    slug: string;
    name: string;
    discordUserId: string;
};

type DiscordMember = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    bot?: boolean;
};

type FeedbackKind = "ok" | "err";
type Feedback = { kind: FeedbackKind; text: string } | null;

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32);
}

export default function UsersPage() {
    const [users, setUsers] = useState<DmUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [testingSlug, setTestingSlug] = useState<string | null>(null);
    const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        slug: "",
        name: "",
        discordUserId: "",
    });

    const [memberQuery, setMemberQuery] = useState("");
    const [memberResults, setMemberResults] = useState<DiscordMember[]>([]);
    const [memberSearchLoading, setMemberSearchLoading] = useState(false);
    const [memberSearchError, setMemberSearchError] = useState<string | null>(null);
    const [selectedMember, setSelectedMember] = useState<DiscordMember | null>(null);
    const memberDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (memberDebounceRef.current) clearTimeout(memberDebounceRef.current);

        const q = memberQuery.trim();
        if (q.length === 0 || selectedMember) {
            setMemberResults([]);
            setMemberSearchLoading(false);
            setMemberSearchError(null);
            return;
        }

        setMemberSearchLoading(true);
        memberDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/discord/members?q=${encodeURIComponent(q)}&limit=10`,
                    { cache: "no-store" }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setMemberSearchError(data?.error || `Errore (${res.status})`);
                    setMemberResults([]);
                } else {
                    setMemberSearchError(null);
                    const list: DiscordMember[] = Array.isArray(data?.members) ? data.members : [];
                    setMemberResults(list.filter((m) => !m.bot));
                }
            } catch (err) {
                setMemberSearchError(err instanceof Error ? err.message : "Errore di rete");
                setMemberResults([]);
            } finally {
                setMemberSearchLoading(false);
            }
        }, 300);

        return () => {
            if (memberDebounceRef.current) clearTimeout(memberDebounceRef.current);
        };
    }, [memberQuery, selectedMember]);

    const pickMember = (member: DiscordMember) => {
        setSelectedMember(member);
        setMemberQuery(member.displayName);
        setMemberResults([]);
        setFormData({
            slug: slugify(member.displayName || member.username),
            name: member.displayName || member.username,
            discordUserId: member.id,
        });
    };

    const clearMember = () => {
        setSelectedMember(null);
        setMemberQuery("");
        setFormData({ slug: "", name: "", discordUserId: "" });
    };

    const showFeedback = (f: Feedback, ttl = 5000) => {
        setFeedback(f);
        if (f) setTimeout(() => setFeedback(null), ttl);
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users", { cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            if (Array.isArray(data?.users)) {
                setUsers(data.users);
            } else {
                setUsers([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ slug: "", name: "", discordUserId: "" });
        setFormError(null);
        setMemberQuery("");
        setMemberResults([]);
        setMemberSearchError(null);
        setSelectedMember(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const slug = formData.slug.trim();
        const name = formData.name.trim();
        const discordUserId = formData.discordUserId.trim();

        if (!slug || !name || !discordUserId) {
            setFormError("Tutti i campi sono obbligatori.");
            return;
        }
        if (!SNOWFLAKE_REGEX.test(discordUserId)) {
            setFormError("Discord User ID non valido (deve essere uno snowflake da 17–20 cifre).");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, name, discordUserId }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok || data?.success === false) {
                setFormError(data?.error || `Errore (${res.status})`);
                return;
            }

            await fetchUsers();
            setIsModalOpen(false);
            resetForm();
            showFeedback({ kind: "ok", text: `Utente "${slug}" salvato.` });
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Errore di rete");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendTest = async (user: DmUser) => {
        setTestingSlug(user.slug);
        try {
            const res = await fetch("/api/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target: user.slug,
                    source: "Dashboard Test",
                    title: "Test DM",
                    message: `Ciao ${user.name}, questo è un messaggio di prova inviato da Genotify.`,
                    color: "info",
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok || data?.success === false) {
                showFeedback({
                    kind: "err",
                    text: `Test fallito per ${user.slug}: ${data?.error || res.status}`,
                });
            } else {
                showFeedback({
                    kind: "ok",
                    text: `Test accodato per ${user.slug}. Notification ID: ${data?.notificationId || "—"}`,
                });
            }
        } catch (err) {
            showFeedback({
                kind: "err",
                text: err instanceof Error ? err.message : "Errore di rete",
            });
        } finally {
            setTestingSlug(null);
        }
    };

    const handleDelete = async (user: DmUser) => {
        if (!confirm(`Disattivare l'utente "${user.slug}"? Non riceverà più DM finché non lo riaggiungi.`)) {
            return;
        }
        setDeletingSlug(user.slug);
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(user.slug)}`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok || data?.success === false) {
                showFeedback({
                    kind: "err",
                    text: `Errore: ${data?.error || res.status}`,
                });
                return;
            }
            await fetchUsers();
            showFeedback({ kind: "ok", text: `Utente "${user.slug}" disattivato.` });
        } catch (err) {
            showFeedback({
                kind: "err",
                text: err instanceof Error ? err.message : "Errore di rete",
            });
        } finally {
            setDeletingSlug(null);
        }
    };

    const filtered = users.filter((u) => {
        const q = searchTerm.toLowerCase();
        return (
            u.slug.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q) ||
            u.discordUserId.includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between pb-6 border-b border-border">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">Utenti DM</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Persone del server Discord a cui inviare messaggi privati. Lista separata dai canali.
                    </p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>Aggiungi utente</span>
                </button>
            </header>

            {feedback && (
                <div
                    className={cn(
                        "text-sm px-4 py-3 rounded-md border flex items-center gap-2",
                        feedback.kind === "ok"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border-red-500/20 text-red-400"
                    )}
                >
                    {feedback.kind === "ok" ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <AlertCircle className="w-4 h-4" />
                    )}
                    {feedback.text}
                </div>
            )}

            <div className="flex items-center gap-4 py-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Cerca utenti..."
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
                            <th className="px-6 py-3 font-medium w-12"></th>
                            <th className="px-6 py-3 font-medium">Nome</th>
                            <th className="px-6 py-3 font-medium">Slug</th>
                            <th className="px-6 py-3 font-medium">Discord User ID</th>
                            <th className="px-6 py-3 font-medium text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-muted-foreground" />
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">
                                    Nessun utente. Aggiungi il primo con il pulsante in alto a destra.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((user) => (
                                <tr key={user.slug} className="hover:bg-zinc-900/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="w-8 h-8 rounded-md flex items-center justify-center border bg-pink-500/10 border-pink-500/20 text-pink-400">
                                            <UserCircle2 className="w-4 h-4" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-white">{user.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-mono text-muted-foreground">@{user.slug}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-mono text-zinc-400">{user.discordUserId}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleSendTest(user)}
                                                disabled={testingSlug === user.slug}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-border rounded-md transition-colors disabled:opacity-50"
                                            >
                                                {testingSlug === user.slug ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Send className="w-3.5 h-3.5" />
                                                )}
                                                <span>Invia test</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                disabled={deletingSlug === user.slug}
                                                className="p-2 hover:bg-red-900/20 rounded-md transition-colors text-muted-foreground hover:text-red-400 disabled:opacity-50"
                                                title="Disattiva utente"
                                            >
                                                {deletingSlug === user.slug ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
                    <div className="technical-card w-full max-w-lg p-0 bg-background shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <header className="flex justify-between items-center p-6 border-b border-border">
                            <h2 className="text-lg font-semibold text-white">Aggiungi utente DM</h2>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    resetForm();
                                }}
                                className="text-muted-foreground hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2 relative">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Cerca utente nel server Discord
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={memberQuery}
                                            onChange={(e) => {
                                                setSelectedMember(null);
                                                setMemberQuery(e.target.value);
                                            }}
                                            placeholder="Inizia a digitare un nome..."
                                            autoComplete="off"
                                            className="w-full pl-9 pr-9 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                        />
                                        {selectedMember && (
                                            <button
                                                type="button"
                                                onClick={clearMember}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white"
                                                aria-label="Pulisci selezione"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        {memberSearchLoading && !selectedMember && (
                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                                        )}
                                    </div>

                                    {!selectedMember && memberResults.length > 0 && (
                                        <ul className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-auto bg-zinc-950 border border-border rounded-md shadow-lg divide-y divide-border">
                                            {memberResults.map((m) => (
                                                <li key={m.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => pickMember(m)}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-900"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={m.avatarUrl}
                                                            alt=""
                                                            className="w-7 h-7 rounded-full bg-zinc-800"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm text-white truncate">
                                                                {m.displayName}
                                                            </div>
                                                            <div className="text-[11px] font-mono text-muted-foreground truncate">
                                                                @{m.username} · {m.id}
                                                            </div>
                                                        </div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {memberSearchError && (
                                        <p className="text-[11px] text-red-400">{memberSearchError}</p>
                                    )}

                                    {!selectedMember && !memberSearchLoading && memberQuery.trim().length > 0 && memberResults.length === 0 && !memberSearchError && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Nessun membro trovato. Verifica che l&apos;utente sia nel server.
                                        </p>
                                    )}
                                </div>

                                {selectedMember && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Nome
                                            </label>
                                            <input
                                                required
                                                value={formData.name}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, name: e.target.value })
                                                }
                                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Slug
                                            </label>
                                            <input
                                                required
                                                value={formData.slug}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, slug: e.target.value })
                                                }
                                                className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-md text-sm font-mono text-foreground focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Identificatore breve usato come <code className="text-zinc-300">target</code> nelle API.
                                            </p>
                                        </div>

                                        <div className="text-[11px] font-mono text-muted-foreground bg-zinc-900/60 border border-border rounded-md px-3 py-2">
                                            Discord ID: <span className="text-zinc-300">{formData.discordUserId}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {formError && (
                                <div className="text-sm px-3 py-2 rounded-md border bg-red-500/10 border-red-500/20 text-red-400">
                                    {formError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !selectedMember}
                                    className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Salva utente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
