import { getStats } from "@/lib/stats";
import {
  Activity,
  Settings,
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    {
      label: "Total Notifications",
      value: stats.totalNotifications,
      icon: Activity,
      trend: "+12%"
    },
    {
      label: "Active Channels",
      value: stats.activeChannels,
      icon: Settings,
      trend: "Stable"
    },
    {
      label: "Failed (24h)",
      value: stats.failedNotifications,
      icon: AlertCircle,
      trend: "-2%",
      alert: stats.failedNotifications > 0
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">System status and recent activity.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors">
            Download Report
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="technical-card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
              <card.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-tight text-white">{card.value}</span>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                card.alert
                  ? "bg-red-500/10 text-red-500"
                  : "bg-emerald-500/10 text-emerald-500"
              )}>
                {card.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 technical-card flex flex-col">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-sm text-white">Recent Activity</h3>
            <Link href="/logs" className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-zinc-900/50 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Target</th>
                  <th className="px-6 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          log.status === 'SENT' ? "bg-emerald-500" :
                            log.status === 'FAILED' ? "bg-red-500" : "bg-amber-500"
                        )} />
                        <span className="text-xs font-medium text-zinc-300">{log.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{log.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-zinc-300">{log.target}</span>
                        <span className="text-xs text-muted-foreground">{log.channel?.name || "Direct"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.recentLogs.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No recent activity found.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="technical-card p-6">
            <h3 className="font-medium text-sm text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/channels" className="flex items-center justify-between p-3 rounded-lg border border-border bg-zinc-900/30 hover:bg-zinc-900 transition-colors group">
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white">New Channel</span>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-white" />
              </Link>
              <Link href="/test" className="flex items-center justify-between p-3 rounded-lg border border-border bg-zinc-900/30 hover:bg-zinc-900 transition-colors group">
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white">Send Test</span>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-white" />
              </Link>
            </div>
          </div>

          <div className="technical-card p-6 min-h-[200px] flex flex-col justify-between bg-gradient-to-br from-zinc-900 to-black">
            <div>
              <h3 className="font-medium text-sm text-white mb-2">System Status</h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-emerald-500">All Systems Operational</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Last check: Just now
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
