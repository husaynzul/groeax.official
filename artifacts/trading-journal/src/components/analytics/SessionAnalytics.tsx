import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell,
} from "recharts";
import { Globe } from "lucide-react";
import { Trade, TRADING_SESSIONS, SESSION_LABELS, TradingSession } from "@/types";

const SESSION_CONFIG: Record<TradingSession, {
  color: string;
  bg: string;
  border: string;
  text: string;
  flag: string;
}> = {
  ASIA:     { color: "#06b6d4", bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    text: "text-cyan-400",    flag: "🌏" },
  TOKYO:    { color: "#8b5cf6", bg: "bg-violet-500/10",  border: "border-violet-500/25",  text: "text-violet-400",  flag: "🗼" },
  LONDON:   { color: "#3b82f6", bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400",    flag: "🇬🇧" },
  NEW_YORK: { color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", flag: "🗽" },
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

interface SessionStats {
  session: TradingSession;
  label: string;
  flag: string;
  trades: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  avgRR: number;
  totalPnL: number;
  avgPnL: number;
  biggestWin: number;
  biggestLoss: number;
}

function computeSessionStats(trades: Trade[]): SessionStats[] {
  return TRADING_SESSIONS.map((session) => {
    const ts = trades.filter((t) => t.session === session);
    const wins = ts.filter((t) => t.outcome === "WIN").length;
    const losses = ts.filter((t) => t.outcome === "LOSS").length;
    const be = ts.filter((t) => t.outcome === "BE").length;
    const decided = wins + losses;
    const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;
    const rrSum = ts.reduce((acc, t) => acc + (t.rr ?? 0), 0);
    const avgRR = ts.length > 0 ? +(rrSum / ts.length).toFixed(2) : 0;
    const totalPnL = ts.reduce((acc, t) => acc + ((t.netProfit ?? 0) - (t.netLoss ?? 0)), 0);
    const avgPnL = ts.length > 0 ? totalPnL / ts.length : 0;
    const biggestWin = ts.length > 0 ? Math.max(0, ...ts.map((t) => t.netProfit ?? 0)) : 0;
    const biggestLoss = ts.length > 0 ? Math.max(0, ...ts.map((t) => t.netLoss ?? 0)) : 0;
    return {
      session,
      label: SESSION_LABELS[session],
      flag: SESSION_CONFIG[session].flag,
      trades: ts.length,
      wins,
      losses,
      be,
      winRate,
      avgRR,
      totalPnL,
      avgPnL,
      biggestWin,
      biggestLoss,
    };
  });
}

const PnLTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-semibold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {v >= 0 ? "+" : ""}{fmtMoney(v)}
      </p>
    </div>
  );
};

const RadarTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: { payload: { subject: string }; value: number }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="text-muted-foreground">{payload[0].payload.subject}</p>
      <p className="font-semibold text-emerald-400">{payload[0].value}%</p>
    </div>
  );
};

export default function SessionAnalytics({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => computeSessionStats(trades), [trades]);
  const hasTagged = stats.some((s) => s.trades > 0);

  const barData = stats.map((s) => ({
    name: s.label,
    pnl: +s.totalPnL.toFixed(2),
    trades: s.trades,
    session: s.session,
  }));

  const radarData = stats.map((s) => ({
    subject: s.label,
    value: s.winRate,
    fullMark: 100,
  }));

  const bestSession = hasTagged
    ? stats.filter((s) => s.trades > 0).sort((a, b) => b.totalPnL - a.totalPnL)[0]
    : null;
  const mostActive = hasTagged
    ? stats.filter((s) => s.trades > 0).sort((a, b) => b.trades - a.trades)[0]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Session Performance
        </h2>
      </div>

      {!hasTagged ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          No session data yet — tag trades with a session when logging them to see a breakdown here.
        </div>
      ) : (
        <>
          {/* Summary banners */}
          {(bestSession || mostActive) && (
            <div className="flex flex-wrap gap-3">
              {bestSession && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                  <span className="text-base">{SESSION_CONFIG[bestSession.session].flag}</span>
                  <span>
                    <span className="font-semibold">{bestSession.label}</span> is your most profitable session
                    ({bestSession.totalPnL >= 0 ? "+" : ""}{fmtMoney(bestSession.totalPnL)})
                  </span>
                </div>
              )}
              {mostActive && mostActive.session !== bestSession?.session && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                  <span className="text-base">{SESSION_CONFIG[mostActive.session].flag}</span>
                  <span>
                    <span className="font-semibold">{mostActive.label}</span> is your most active session
                    ({mostActive.trades} trades)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Session stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => {
              const cfg = SESSION_CONFIG[s.session];
              const pnlPos = s.totalPnL >= 0;
              return (
                <div
                  key={s.session}
                  className={`glass-card p-4 border ${cfg.border} space-y-3`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{cfg.flag}</span>
                      <span className={`text-xs font-semibold ${cfg.text}`}>{s.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {s.trades} trade{s.trades !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* P&L */}
                  <div>
                    <p className={`text-xl font-bold ${s.trades === 0 ? "text-muted-foreground" : pnlPos ? "text-emerald-400" : "text-red-400"}`}>
                      {s.trades === 0 ? "—" : `${pnlPos ? "+" : ""}${fmtMoney(s.totalPnL)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Total P&L</p>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                    <div>
                      <p className={`text-sm font-semibold ${s.trades === 0 ? "text-muted-foreground" : s.winRate >= 60 ? "text-emerald-400" : s.winRate >= 40 ? "text-yellow-400" : s.winRate > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {s.trades === 0 ? "—" : `${s.winRate}%`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Win Rate</p>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${s.avgRR >= 2 ? "text-emerald-400" : s.avgRR >= 1 ? "text-yellow-400" : s.avgRR > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {s.trades === 0 ? "—" : `${s.avgRR.toFixed(2)}R`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Avg R:R</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {s.trades === 0 ? "—" : `${s.wins}W/${s.losses}L`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">W/L Split</p>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${s.trades === 0 ? "text-muted-foreground" : s.avgPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.trades === 0 ? "—" : `${s.avgPnL >= 0 ? "+" : ""}${fmtMoney(s.avgPnL)}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Avg P&L</p>
                    </div>
                  </div>

                  {/* Win rate progress bar */}
                  {s.trades > 0 && (
                    <div className="space-y-1">
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${s.winRate}%`,
                            background: cfg.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* P&L Bar chart */}
            <div className="glass-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Total P&L by Session
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 20% 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(215 20% 50%)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<PnLTooltip />} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {barData.map((entry) => (
                      <Cell
                        key={entry.session}
                        fill={entry.pnl >= 0 ? SESSION_CONFIG[entry.session as TradingSession].color : "#ef4444"}
                        fillOpacity={entry.trades === 0 ? 0.2 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Win rate radar */}
            <div className="glass-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Win Rate by Session
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.07)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: "hsl(215 20% 50%)" }}
                  />
                  <Radar
                    name="Win Rate"
                    dataKey="value"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    isAnimationActive
                  />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Biggest win / biggest loss table */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Session Extremes
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Session", "Trades", "Win Rate", "Avg R:R", "Biggest Win", "Biggest Loss", "Net P&L"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const cfg = SESSION_CONFIG[s.session];
                    return (
                      <tr key={s.session} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{cfg.flag}</span>
                            <span className={`font-medium ${cfg.text}`}>{s.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{s.trades > 0 ? s.trades : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3">
                          {s.trades > 0 ? (
                            <span className={s.winRate >= 60 ? "text-emerald-400" : s.winRate >= 40 ? "text-yellow-400" : "text-red-400"}>
                              {s.winRate}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {s.trades > 0 ? (
                            <span className={s.avgRR >= 1.5 ? "text-emerald-400" : s.avgRR >= 1 ? "text-yellow-400" : "text-red-400"}>
                              {s.avgRR.toFixed(2)}R
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-emerald-400">
                          {s.biggestWin > 0 ? `+${fmtMoney(s.biggestWin)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-red-400">
                          {s.biggestLoss > 0 ? `-${fmtMoney(s.biggestLoss)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {s.trades > 0 ? (
                            <span className={s.totalPnL >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                              {s.totalPnL >= 0 ? "+" : ""}{fmtMoney(s.totalPnL)}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
