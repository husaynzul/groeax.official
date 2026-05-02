import { useMemo } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import SessionAnalytics from "@/components/analytics/SessionAnalytics";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell,
  ReferenceLine, PieChart, Pie, Legend, Line, LabelList,
} from "recharts";
import { motion } from "framer-motion";
import {
  Activity, Crosshair, TrendingDown, Info, Trophy, AlertTriangle,
  Zap, PieChartIcon, BarChart2, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

const FADE_UP = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);

const STRATEGY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899",
];

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-semibold ${color ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

const DrawdownTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number; payload: { date: string } }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{format(new Date(payload[0].payload.date + "T12:00:00"), "MMM d, yyyy")}</p>
      <p className="text-red-400 font-semibold">-{fmtMoney(payload[0].value)}</p>
    </div>
  );
};

const EquityTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number; payload: { date: string } }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{format(new Date(payload[0].payload.date + "T12:00:00"), "MMM d, yyyy")}</p>
      <p className={`font-semibold ${payload[0].value >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(payload[0].value)}</p>
    </div>
  );
};

const ScatterTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { rr: number; profit: number; pair: string; outcome: string } }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-foreground">{d.pair}</p>
      <p className="text-muted-foreground">R:R — {d.rr.toFixed(2)}</p>
      <p className={d.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
        {d.profit >= 0 ? "+" : ""}{fmtMoney(d.profit)}
      </p>
      <p className={`text-[10px] font-medium ${d.outcome === "WIN" ? "text-emerald-400" : d.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"}`}>
        {d.outcome}
      </p>
    </div>
  );
};

const PeriodTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className={`font-semibold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {v >= 0 ? "+" : ""}{fmtMoney(v)}
      </p>
    </div>
  );
};

const StrategyTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; netPnL: number; winRate: number; count: number } }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className={d.netPnL >= 0 ? "text-emerald-400" : "text-red-400"}>Net: {fmtMoney(d.netPnL)}</p>
      <p className="text-muted-foreground">Win Rate: {d.winRate}%</p>
      <p className="text-muted-foreground">{d.count} trades</p>
    </div>
  );
};

export default function Analytics() {
  const trades = useTradeStore((s) => s.trades);
  const analytics = useMemo(() => computeAnalytics(trades), [trades]);

  const maxDrawdown = useMemo(
    () => analytics.drawdownCurve.length > 0 ? Math.max(...analytics.drawdownCurve.map((d) => d.drawdown)) : 0,
    [analytics.drawdownCurve]
  );

  const avgRR = useMemo(
    () => trades.length > 0 ? trades.reduce((s, t) => s + t.rr, 0) / trades.length : 0,
    [trades]
  );

  const profitFactor = useMemo(
    () => analytics.totalLoss > 0 ? analytics.totalProfit / analytics.totalLoss : analytics.totalProfit > 0 ? Infinity : 0,
    [analytics]
  );

  const scatterWithOutcome = useMemo(
    () => trades.map((t) => ({
      rr: t.rr,
      profit: t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0,
      pair: t.pair,
      outcome: t.outcome ?? "BE",
    })),
    [trades]
  );

  const rrBuckets = useMemo(() => {
    const buckets: Record<string, { wins: number; losses: number; total: number }> = {
      "0–1R": { wins: 0, losses: 0, total: 0 },
      "1–2R": { wins: 0, losses: 0, total: 0 },
      "2–3R": { wins: 0, losses: 0, total: 0 },
      "3R+": { wins: 0, losses: 0, total: 0 },
    };
    trades.forEach((t) => {
      const key = t.rr < 1 ? "0–1R" : t.rr < 2 ? "1–2R" : t.rr < 3 ? "2–3R" : "3R+";
      buckets[key].total++;
      if (t.outcome === "WIN") buckets[key].wins++;
      else if (t.outcome === "LOSS") buckets[key].losses++;
    });
    return Object.entries(buckets).map(([label, v]) => ({
      label, ...v, wr: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
    }));
  }, [trades]);

  const strategyPieData = useMemo(
    () => analytics.strategyStats.map((s, i) => ({
      name: s.name.length > 18 ? s.name.slice(0, 16) + "…" : s.name,
      fullName: s.name,
      value: s.count,
      fill: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
    })),
    [analytics.strategyStats]
  );

  const bestStrategy = analytics.strategyStats[0] ?? null;
  const worstStrategy = analytics.strategyStats.length > 1
    ? analytics.strategyStats[analytics.strategyStats.length - 1]
    : null;

  const empty = trades.length === 0;
  const hasStrategy = analytics.strategyStats.length > 0;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Full performance breakdown — strategy, drawdown, R:R, and period analysis
        </p>
      </div>

      {/* ── Top stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Max Drawdown", value: maxDrawdown > 0 ? `-${fmtMoney(maxDrawdown)}` : "—", color: maxDrawdown > 0 ? "text-red-400" : "text-muted-foreground" },
          { label: "Profit Factor", value: profitFactor === Infinity ? "∞" : profitFactor > 0 ? profitFactor.toFixed(2) : "—", color: profitFactor >= 1.5 ? "text-emerald-400" : profitFactor > 0 ? "text-yellow-400" : "text-muted-foreground" },
          { label: "Avg R:R", value: avgRR > 0 ? `${avgRR.toFixed(2)}R` : "—", color: avgRR >= 2 ? "text-emerald-400" : avgRR >= 1 ? "text-yellow-400" : "text-muted-foreground" },
          { label: "Total Trades", value: trades.length > 0 ? `${trades.length}` : "—", color: "text-foreground" },
        ].map((s, i) => (
          <motion.div key={s.label} custom={i} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-4">
            <StatBadge label={s.label} value={s.value} color={s.color} />
          </motion.div>
        ))}
      </div>

      {/* ── Strategy insight banners ── */}
      {hasStrategy && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bestStrategy && bestStrategy.netPnL > 0 && (
            <motion.div custom={0} initial="hidden" animate="show" variants={FADE_UP}
              className="glass-card p-4 flex items-start gap-3 border-l-2 border-emerald-500">
              <Trophy className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Best Strategy</p>
                <p className="text-sm font-semibold text-foreground">{bestStrategy.name}</p>
                <p className="text-xs text-emerald-400 mt-0.5">
                  {fmtMoney(bestStrategy.netPnL)} net · {bestStrategy.winRate}% win rate · {bestStrategy.count} trades
                </p>
              </div>
            </motion.div>
          )}
          {worstStrategy && worstStrategy.netPnL < 0 && (
            <motion.div custom={1} initial="hidden" animate="show" variants={FADE_UP}
              className="glass-card p-4 flex items-start gap-3 border-l-2 border-red-500">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Needs Work</p>
                <p className="text-sm font-semibold text-foreground">{worstStrategy.name}</p>
                <p className="text-xs text-red-400 mt-0.5">
                  {fmtMoney(worstStrategy.netPnL)} net · {worstStrategy.winRate}% win rate · {worstStrategy.count} trades
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Strategy distribution + P&L by strategy ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie — strategy usage */}
        <motion.div custom={2} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Strategy Usage</h2>
          </div>
          {hasStrategy ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={strategyPieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  dataKey="value"
                  isAnimationActive animationDuration={800}
                >
                  {strategyPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-foreground">{d.fullName}</p>
                        <p className="text-muted-foreground">{d.value} trade{d.value !== 1 ? "s" : ""}</p>
                      </div>
                    );
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  formatter={(value) => (
                    <span style={{ fontSize: 10, color: "hsl(215 20% 55%)" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Tag trades with a strategy to see distribution
            </div>
          )}
        </motion.div>

        {/* Bar — net P&L per strategy */}
        <motion.div custom={3} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">P&L per Strategy</h2>
          </div>
          {hasStrategy ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.strategyStats} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis
                  type="number" tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  type="category" dataKey="name" width={110}
                  tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                  tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                />
                <Tooltip content={<StrategyTooltip />} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
                <Bar dataKey="netPnL" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800}>
                  {analytics.strategyStats.map((entry, i) => (
                    <Cell key={i} fill={entry.netPnL >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Tag trades with a strategy to see P&L breakdown
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Strategy performance table ── */}
      {hasStrategy && (
        <motion.div custom={4} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Strategy Performance Heatmap</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Strategy", "Trades", "Win Rate", "Net P&L", "Avg R:R", "Best/Worst"].map((h) => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground pb-2 font-medium pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.strategyStats.map((s, i) => {
                  const wr = s.winRate;
                  const wrColor = wr >= 60 ? "text-emerald-400" : wr >= 40 ? "text-yellow-400" : "text-red-400";
                  const pnlColor = s.netPnL >= 0 ? "text-emerald-400" : "text-red-400";
                  const bgIntensity = Math.min(Math.abs(s.netPnL) / Math.max(...analytics.strategyStats.map(x => Math.abs(x.netPnL)), 1), 1);
                  return (
                    <tr key={s.name} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }} />
                          <span className="font-medium text-foreground">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.count}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${wrColor}`}>{wr}%</span>
                          <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${wr}%`, backgroundColor: wr >= 60 ? "#10b981" : wr >= 40 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                        </div>
                      </td>
                      <td className={`py-2.5 pr-4 font-semibold ${pnlColor}`}>
                        <div
                          className="px-2 py-0.5 rounded text-xs inline-block"
                          style={{
                            backgroundColor: s.netPnL >= 0
                              ? `rgba(16,185,129,${bgIntensity * 0.2})`
                              : `rgba(239,68,68,${bgIntensity * 0.2})`,
                          }}
                        >
                          {s.netPnL >= 0 ? "+" : ""}{fmtMoney(s.netPnL)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.avgRR.toFixed(2)}R</td>
                      <td className="py-2.5 text-muted-foreground">
                        {fmtMoney(s.totalProfit)} / {fmtMoney(s.totalLoss)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Equity curve ── */}
      <motion.div custom={5} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Equity Curve</h2>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Cumulative P&L over time
        </p>
        {!empty && analytics.equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics.equityCurve} margin={{ top: 32, right: 28, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="eqGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }}
                tickFormatter={(v) => format(new Date(v + "T12:00:00"), "MMM d")}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#64748b" }}
                tickFormatter={(v) => `$${v.toFixed(0)}`} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<EquityTooltip />} />
              <Area
                type="linear"
                dataKey="equity"
                stroke="#4ade80"
                strokeWidth={2}
                fill="url(#eqGradA)"
                dot={{ r: 5, fill: "#4ade80", stroke: "#0f172a", strokeWidth: 2 }}
                activeDot={{ r: 7, fill: "#4ade80", stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive animationDuration={900}
              >
                <LabelList
                  dataKey="equity"
                  position="top"
                  style={{ fontSize: 10, fill: "#86efac", fontWeight: 700 }}
                  formatter={(v: number) => `$${v.toFixed(0)}`}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to see your equity curve
          </div>
        )}
      </motion.div>

      {/* ── Weekly / Monthly performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div custom={6} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Weekly P&L</h2>
          </div>
          {analytics.weeklyPnL.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.weeklyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }} tickFormatter={(v) => `$${v}`} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                <Tooltip content={<PeriodTooltip />} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800}>
                  {analytics.weeklyPnL.map((e, i) => (
                    <Cell key={i} fill={e.pnl >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </motion.div>

        <motion.div custom={7} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Monthly P&L</h2>
          </div>
          {analytics.monthlyPnL.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.monthlyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }} tickFormatter={(v) => `$${v}`} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                <Tooltip content={<PeriodTooltip />} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800}>
                  {analytics.monthlyPnL.map((e, i) => (
                    <Cell key={i} fill={e.pnl >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </motion.div>
      </div>

      {/* ── Drawdown curve ── */}
      <motion.div custom={8} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Drawdown Curve</h2>
          </div>
          {maxDrawdown > 0 && (
            <span className="text-xs text-red-400 font-semibold">Max: -{fmtMoney(maxDrawdown)}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/60 mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Distance below peak equity at each point in time
        </p>
        {!empty && analytics.drawdownCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics.drawdownCurve} margin={{ top: 32, right: 28, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }}
                tickFormatter={(v) => format(new Date(v + "T12:00:00"), "MMM d")}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#64748b" }}
                tickFormatter={(v) => v === 0 ? "$0" : `-$${Math.abs(v).toFixed(0)}`}
                axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<DrawdownTooltip />} />
              <Area
                type="linear"
                dataKey="drawdown"
                stroke="#f87171"
                strokeWidth={2}
                fill="url(#ddGrad)"
                dot={(props: { cx: number; cy: number; payload: { drawdown: number } }) => {
                  const isMax = props.payload.drawdown === maxDrawdown && maxDrawdown > 0;
                  return (
                    <circle
                      key={`dd-${props.cx}`}
                      cx={props.cx} cy={props.cy}
                      r={isMax ? 6 : 4}
                      fill={isMax ? "#fbbf24" : "#f87171"}
                      stroke="#0f172a" strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: "#f87171", stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive animationDuration={900}
              >
                <LabelList
                  dataKey="drawdown"
                  position="top"
                  style={{ fontSize: 10, fill: "#fca5a5", fontWeight: 700 }}
                  formatter={(v: number) => v > 0 ? `-$${v.toFixed(0)}` : "$0"}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to see your drawdown curve
          </div>
        )}
      </motion.div>

      {/* ── R:R Scatter ── */}
      <motion.div custom={9} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Crosshair className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">R:R vs P&L Scatter</h2>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Each dot is a trade. X-axis = planned R:R, Y-axis = actual P&L. Green = win, red = loss.
        </p>
        {!empty ? (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="rr" name="R:R" type="number"
                tick={{ fontSize: 9, fill: "#64748b" }}
                axisLine={false} tickLine={false}
                label={{ value: "R:R Ratio", position: "insideBottom", offset: -12, style: { fontSize: 10, fill: "#64748b" } }}
              />
              <YAxis
                dataKey="profit" name="P&L" type="number"
                tick={{ fontSize: 9, fill: "#64748b" }}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                axisLine={false} tickLine={false} width={52}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeDasharray="6 4" />
              <ReferenceLine x={1} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 4" />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={scatterWithOutcome} isAnimationActive animationDuration={800}
                shape={(props: { cx: number; cy: number; payload: { outcome?: string } }) => {
                  const { cx, cy, payload } = props;
                  const isWin = payload.outcome === "WIN";
                  const isLoss = payload.outcome === "LOSS";
                  const fill = isWin ? "#22c55e" : isLoss ? "#ef4444" : "#6b7280";
                  const glow = isWin ? "#22c55e44" : isLoss ? "#ef444444" : "#6b728044";
                  return (
                    <g key={`scatter-${cx}-${cy}`}>
                      <circle cx={cx} cy={cy} r={11} fill={glow} />
                      <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#0f172a" strokeWidth={1.5} />
                    </g>
                  );
                }}
              >
                {scatterWithOutcome.map((_entry, i) => (
                  <Cell key={i} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to populate the scatter plot
          </div>
        )}
        <div className="flex items-center gap-5 mt-3 text-[11px] text-muted-foreground">
          {[["bg-emerald-500", "Win"], ["bg-red-500", "Loss"], ["bg-gray-500", "Breakeven"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${c} inline-block`} />
              {l}
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── Session Performance ── */}
      <SessionAnalytics trades={trades} />

      {/* ── Win rate by R:R bucket ── */}
      <motion.div custom={10} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Win Rate by R:R Bucket</h2>
        </div>
        {!empty ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {rrBuckets.map((bucket) => (
              <div key={bucket.label} className="p-4 rounded-xl border border-border bg-secondary/30 space-y-2">
                <p className="text-xs font-semibold text-foreground">{bucket.label}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-xl font-bold ${bucket.wr >= 60 ? "text-emerald-400" : bucket.wr >= 40 ? "text-yellow-400" : bucket.wr > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {bucket.total > 0 ? `${bucket.wr}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{bucket.wins}W / {bucket.losses}L</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{bucket.total} trade{bucket.total !== 1 ? "s" : ""}</p>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${bucket.wr}%`, background: bucket.wr >= 60 ? "#10b981" : bucket.wr >= 40 ? "#f59e0b" : "#ef4444" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to see R:R breakdown
          </div>
        )}
      </motion.div>
    </div>
  );
}
