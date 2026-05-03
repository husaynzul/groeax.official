import { useMemo, useState } from "react";
import { fmtTradeDate, toDate } from "@/lib/dateUtils";
import { useTradeStore } from "@/store/tradeStore";
import OpenPositions from "@/components/dashboard/OpenPositions";
import { computeAnalytics } from "@/engine/analyticsEngine";
import TradingSessions from "@/components/dashboard/TradingSessions";
import StreakCard from "@/components/dashboard/StreakCard";
import LiveTradingSignals from "@/components/dashboard/LiveTradingSignals";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  PieCell,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart2,
  Trophy,
  AlertCircle,
  Zap,
  Award,
  Flag,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Trade } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameMonth,
} from "date-fns";

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function MetricCard({ label, value, sub, icon: Icon, color = "text-foreground", index }: { label: string; value: string; sub?: string; icon: React.ElementType; color?: string; index: number; }) {
  return (
    <motion.div custom={index} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-4 flex flex-col gap-1.5 hover:border-white/15 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="w-3.5 h-3.5" /><span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

function MonthlyGoalCard({ monthlyPnL, goal, onSetGoal }: { monthlyPnL: number; goal: number; onSetGoal: (g: number) => void; }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal || ""));
  const pct = goal > 0 ? Math.min((monthlyPnL / goal) * 100, 100) : 0;
  const over = goal > 0 && monthlyPnL >= goal;
  const remaining = goal > 0 ? Math.max(goal - monthlyPnL, 0) : 0;
  const filled = Math.max(pct, 0);
  const donutData = [{ value: filled }, { value: Math.max(100 - filled, 0) }];
  const ringColor = over ? "#10b981" : pct >= 75 ? "#f59e0b" : pct >= 40 ? "#3b82f6" : "#6b7280";
  function commitGoal() { const v = parseFloat(draft); if (!isNaN(v) && v > 0) onSetGoal(v); setEditing(false); }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="glass-card p-4 flex flex-col gap-3 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground"><Flag className="w-3.5 h-3.5 text-primary" /><span className="text-xs uppercase tracking-wider">Monthly Goal</span></div>
        <button onClick={() => { setDraft(String(goal || "")); setEditing(true); }} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-white/5"><Pencil className="w-3 h-3" /></button>
      </div>
      {editing && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <input type="number" min="1" step="any" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitGoal(); if (e.key === "Escape") setEditing(false); }} autoFocus placeholder="e.g. 500" className="flex-1 bg-secondary border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={commitGoal} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {goal > 0 ? (
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={32} outerRadius={44} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0} isAnimationActive animationDuration={900}>
                  <PieCell fill={ringColor} />
                  <PieCell fill="rgba(255,255,255,0.05)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-sm font-bold" style={{ color: ringColor }}>{pct.toFixed(0)}%</span></div>
          </div>
          <div className="flex-1 space-y-2">
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">This Month</p><p className={`text-xl font-bold ${monthlyPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>{monthlyPnL >= 0 ? "+" : ""}{fmtMoney(monthlyPnL)}</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Goal</p><p className="text-sm font-semibold text-foreground">{fmtMoney(goal)}</p></div>
            {!over && remaining > 0 && <p className="text-[10px] text-muted-foreground">{fmtMoney(remaining)} remaining</p>}
            {over && <p className="text-[10px] font-semibold text-emerald-400">Goal reached!</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <p className="text-sm text-muted-foreground text-center">Set a monthly profit goal to track progress</p>
          {!editing && <button onClick={() => setEditing(true)} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">+ Set goal</button>}
        </div>
      )}
      {goal > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: ringColor }} /></div>
          <div className="flex justify-between text-[9px] text-muted-foreground"><span>$0</span><span>{fmtMoney(goal)}</span></div>
        </div>
      )}
    </motion.div>
  );
}

function CalendarHeatmap({ tradesByDate }: { tradesByDate: Record<string, Trade[]>; }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));
  const blanks = Array.from({ length: firstDayOfWeek });
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="glass-card p-4 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))} className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded">‹</button>
        <span className="text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</span>
        <button onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))} className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">{weekLabels.map((d) => <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTrades = tradesByDate[key] ?? [];
          const pnl = dayTrades.reduce((acc, t) => acc + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0);
          const hasTrades = dayTrades.length > 0;
          const isSelected = selectedDate === key;
          return (
            <button key={key} onClick={() => setSelectedDate(isSelected ? null : key)} className={`relative rounded-md p-1 min-h-[50px] text-left transition-all border ${isSelected ? "border-primary/60 ring-1 ring-primary/40" : "border-transparent hover:border-white/10"} ${hasTrades ? pnl > 0 ? "bg-emerald-500/15" : pnl < 0 ? "bg-red-500/15" : "bg-white/[0.03]" : isToday(day) ? "bg-primary/10 border-primary/20" : "bg-transparent"}`}>
              <span className={`text-[10px] font-medium ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</span>
              {hasTrades && <div className="mt-0.5"><p className={`text-[9px] font-semibold truncate ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-muted-foreground"}`}>{pnl > 0 ? "+" : ""}{fmtMoney(pnl)}</p><p className="text-[9px] text-muted-foreground">{dayTrades.length}T</p></div>}
            </button>
          );
        })}
      </div>
      {selectedDate && tradesByDate[selectedDate] && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">{fmtTradeDate(selectedDate, "MMM d, yyyy")}</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {tradesByDate[selectedDate].map((t) => <div key={t.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-secondary/40"><span className="font-medium">{t.pair}</span><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{t.direction}</span><span className={t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"}>{t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "BE"}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const trades = useTradeStore((s) => s.trades);
  const monthlyGoal = useTradeStore((s) => s.monthlyGoal);
  const setMonthlyGoal = useTradeStore((s) => s.setMonthlyGoal);
  const analytics = useMemo(() => computeAnalytics(trades), [trades]);
  const monthlyPnL = useMemo(() => {
    const now = new Date();
    return trades.reduce((acc, t) => {
      if (!t.date) return acc;
      const tradeDate = toDate(t.date);
      if (!tradeDate || !isSameMonth(tradeDate, now)) return acc;
      if (t.outcome === "WIN") return acc + t.netProfit;
      if (t.outcome === "LOSS") return acc - t.netLoss;
      return acc;
    }, 0);
  }, [trades]);

  const radarData = [
    { subject: "Win Rate", value: analytics.winRate },
    { subject: "Profit Factor", value: Math.min(analytics.totalLoss > 0 ? (analytics.totalProfit / analytics.totalLoss) * 20 : analytics.totalProfit > 0 ? 100 : 0, 100) },
    { subject: "Consistency", value: analytics.totalTrades > 0 ? Math.min((analytics.winRate / 100) * (analytics.equityCurve.length > 0 ? 80 : 50) + 20, 100) : 0 },
    { subject: "Max Drawdown", value: analytics.drawdownCurve.length > 0 ? Math.max(100 - Math.min((Math.max(...analytics.drawdownCurve.map((d) => Math.abs(d.drawdown))), 100) as number), 0) : 100 },
  ];

  return (
    <div className="min-h-screen p-5 lg:p-6 space-y-5 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.08),transparent_18%)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-1.5">TradeLog</p>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">{analytics.totalTrades} trades tracked · premium trading workspace</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]">Live</span>
          <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]">Institutional UI</span>
        </div>
      </div>

      <OpenPositions />
      <LiveTradingSignals />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <MetricCard index={0} label="Net P&L" value={fmtMoney(analytics.netBalance)} sub={`${fmtMoney(analytics.totalProfit)} won`} icon={analytics.netBalance >= 0 ? TrendingUp : TrendingDown} color={analytics.netBalance >= 0 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard index={1} label="Win Rate" value={fmtPct(analytics.winRate)} sub={`${analytics.totalTrades} trades`} icon={Target} color={analytics.winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard index={2} label="Avg Win" value={fmtMoney(analytics.avgWin)} sub={`Avg Loss: ${fmtMoney(analytics.avgLoss)}`} icon={BarChart2} />
        <MetricCard index={3} label="Best Trade" value={analytics.bestTrade ? fmtMoney(analytics.bestTrade.netProfit) : "—"} sub={analytics.bestTrade?.pair} icon={Trophy} color="text-emerald-400" />
        <MetricCard index={4} label="Worst Trade" value={analytics.worstTrade ? `-${fmtMoney(analytics.worstTrade.netLoss)}` : "—"} sub={analytics.worstTrade?.pair} icon={AlertCircle} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 lg:col-span-2 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><Zap className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Performance Score</h2></div>
          {analytics.totalTrades > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}><PolarGrid stroke="rgba(255,255,255,0.07)" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(215 20% 50%)" }} /><Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} isAnimationActive /></RadarChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Add trades to see your performance</div>}
        </motion.div>
        <MonthlyGoalCard monthlyPnL={monthlyPnL} goal={monthlyGoal} onSetGoal={setMonthlyGoal} />
      </div>

      <TradingSessions />
      <CalendarHeatmap tradesByDate={analytics.tradesByDate} />
      <StreakCard trades={trades} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Equity Curve</h2></div>
          {analytics.equityCurve.length > 0 ? <ResponsiveContainer width="100%" height={200}><AreaChart data={analytics.equityCurve} margin={{ top: 28, right: 24, bottom: 4, left: 0 }}><defs><linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={0.18} /><stop offset="100%" stopColor="#4ade80" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmtTradeDate(v, "MMM d")} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} /><Tooltip content={undefined} /><Area type="linear" dataKey="equity" stroke="#4ade80" strokeWidth={2} fill="url(#equityGrad)" dot={{ r: 4, fill: "#4ade80", stroke: "#0f172a", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#4ade80", stroke: "#fff", strokeWidth: 1.5 }} isAnimationActive animationDuration={900} /></AreaChart></ResponsiveContainer> : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No trade data yet</div>}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><BarChart2 className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Net Daily P&amp;L</h2></div>
          {analytics.dailyPnL.length > 0 ? <ResponsiveContainer width="100%" height={200}><BarChart data={analytics.dailyPnL} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%"><CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmtTradeDate(v, "MMM d")} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} /><ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={2} /><Tooltip content={undefined} /><Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800} maxBarSize={36}>{analytics.dailyPnL.map((entry, i) => <PieCell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={1} />)}</Bar></BarChart></ResponsiveContainer> : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No trade data yet</div>}
        </motion.div>
      </div>

      {analytics.totalTrades > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><Award className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Trades</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border"><th className="text-left text-xs text-muted-foreground pb-2 font-medium">Date</th><th className="text-left text-xs text-muted-foreground pb-2 font-medium">Pair</th><th className="text-left text-xs text-muted-foreground pb-2 font-medium">Dir</th><th className="text-right text-xs text-muted-foreground pb-2 font-medium">P&amp;L</th><th className="text-right text-xs text-muted-foreground pb-2 font-medium">R:R</th><th className="text-right text-xs text-muted-foreground pb-2 font-medium">Result</th></tr></thead>
              <tbody>
                {[...trades].filter((t) => t.date && !isNaN(new Date(t.date).getTime())).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8).map((t) => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-white/[0.03] transition-colors">
                    <td className="py-2 text-muted-foreground text-xs">{fmtTradeDate(t.date, "MM/dd/yy")}</td>
                    <td className="py-2 font-medium text-xs">{t.pair}</td>
                    <td className="py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{t.direction}</span></td>
                    <td className={`py-2 text-right text-xs font-semibold ${t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"}`}>{t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "BE"}</td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{t.rr.toFixed(2)}R</td>
                    <td className="py-2 text-right"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.outcome === "WIN" ? "bg-emerald-500/20 text-emerald-400" : t.outcome === "LOSS" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-muted-foreground"}`}>{t.outcome ?? "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
