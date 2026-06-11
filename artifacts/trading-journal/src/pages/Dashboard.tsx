import { useMemo, useState } from "react";
import { fmtTradeDate, toDate } from "@/lib/dateUtils";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics, DrawdownStats } from "@/engine/analyticsEngine";
import TradingSessions from "@/components/dashboard/TradingSessions";
import StreakCard from "@/components/dashboard/StreakCard";
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
  PieChart,
  Pie,
  Cell,
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
  Wallet,
  DollarSign,
  Percent,
  ChevronLeft,
  ChevronRight,
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

/** Format PnL as compact: $9.4K / -$20.6K / $340 */
function fmtPnLCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function MetricCard({ label, value, sub, icon: Icon, color = "text-foreground", index }: { label: string; value: string; sub?: string; icon: React.ElementType; color?: string; index: number; }) {
  return (
    <motion.div custom={index} initial="hidden" animate="show" variants={FADE_UP} className="glass-card p-4 flex flex-col gap-1.5 hover:border-white/15 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="w-3.5 h-3.5" /><span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

function BalanceCard({
  startingBalance,
  currentBalance,
  totalProfit,
  totalLoss,
  drawdownStats,
  onSetBalance,
}: {
  startingBalance: number;
  currentBalance: number;
  totalProfit: number;
  totalLoss: number;
  drawdownStats: DrawdownStats;
  onSetBalance: (b: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(startingBalance || ""));

  const growth = startingBalance > 0 ? ((currentBalance - startingBalance) / startingBalance) * 100 : 0;
  // Peak-equity based drawdown: how far below the peak are we right now (as % of peak)
  const maxDrawdown = drawdownStats.drawdownPercent;

  function commit() {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) onSetBalance(v);
    setEditing(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-4 flex flex-col gap-3 hover:border-white/15 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs uppercase tracking-wider">Balance</span>
        </div>
        <button
          onClick={() => { setDraft(String(startingBalance || "")); setEditing(true); }}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-white/5"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {editing && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min="1"
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
            placeholder="e.g. 10000"
            className="flex-1 bg-secondary border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={commit} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {startingBalance > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Starting</p>
              <p className="text-sm font-semibold text-foreground">{fmtMoney(startingBalance)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p>
              <p className={`text-sm font-bold ${currentBalance >= startingBalance ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(currentBalance)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Growth</p>
              <p className={`text-sm font-semibold ${growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{growth >= 0 ? "+" : ""}{growth.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Drawdown</p>
              <p className="text-sm font-semibold text-orange-400">{maxDrawdown.toFixed(2)}%</p>
            </div>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${growth >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(Math.abs(growth), 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Net P&L: {totalProfit - totalLoss >= 0 ? "+" : ""}{fmtMoney(totalProfit - totalLoss)}</span>
            <span>{growth >= 0 ? "+" : ""}{growth.toFixed(1)}% return</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <p className="text-sm text-muted-foreground text-center">Set your starting balance to track account growth</p>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              + Set balance
            </button>
          )}
        </div>
      )}
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
                  <Cell fill={ringColor} />
                  <Cell fill="rgba(255,255,255,0.05)" />
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

function CalendarHeatmap({ tradesByDate }: { tradesByDate: Record<string, Trade[]> }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));
  const blanks = Array.from({ length: firstDayOfWeek });
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedTrades = selectedDate ? (tradesByDate[selectedDate] ?? []) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="glass-card p-4 hover:border-white/15 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</span>
        <button
          onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Week-day headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekLabels.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5 tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square rounded-lg" />
        ))}

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTrades = tradesByDate[key] ?? [];
          const pnl = dayTrades.reduce(
            (acc, t) => acc + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0),
            0,
          );
          const wins = dayTrades.filter((t) => t.outcome === "WIN").length;
          const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
          const hasTrades = dayTrades.length > 0;
          const isSelected = selectedDate === key;
          const today = isToday(day);

          return (
            <button
              key={key}
              onClick={() => setSelectedDate(isSelected ? null : key)}
              className={[
                "relative aspect-square rounded-lg p-1 text-left transition-all duration-150 focus:outline-none flex flex-col overflow-hidden w-full",
                hasTrades
                  ? pnl > 0
                    ? "bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/50"
                    : pnl < 0
                      ? "bg-red-800 hover:bg-red-700 border border-red-600/50"
                      : "bg-white/10 hover:bg-white/15 border border-white/10"
                  : today
                    ? "bg-primary/10 border border-primary/30 hover:bg-primary/15"
                    : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]",
                isSelected ? "ring-2 ring-white/50 ring-offset-1 ring-offset-transparent scale-[1.03]" : "",
              ].join(" ")}
            >
              {/* Day number – top right */}
              <span
                className={[
                  "absolute top-0.5 right-1 text-[9px] sm:text-[11px] font-semibold leading-tight",
                  hasTrades ? "text-white/80" : today ? "text-primary" : "text-muted-foreground/60",
                ].join(" ")}
              >
                {format(day, "d")}
              </span>

              {/* Today dot */}
              {today && !hasTrades && (
                <span className="absolute top-1 left-1 w-1 h-1 rounded-full bg-primary" />
              )}

              {/* Trade data — always visible, sizes adapt to cell */}
              {hasTrades && (
                <div className="mt-auto pt-1 flex flex-col gap-0">
                  <p className="text-white font-bold text-[8px] sm:text-[10px] leading-tight truncate">
                    {fmtPnLCompact(pnl)}
                  </p>
                  <p className="text-white/70 text-[7px] sm:text-[9px] leading-tight">
                    {dayTrades.length}t
                  </p>
                  <p className="text-white/70 text-[7px] sm:text-[9px] leading-tight">
                    {winRate.toFixed(0)}%
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDate && selectedTrades.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-border overflow-hidden"
        >
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            {fmtTradeDate(selectedDate, "EEEE, MMMM d yyyy")}
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {selectedTrades.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-secondary/40 gap-2"
              >
                <span className="font-semibold text-foreground min-w-[60px]">{t.pair}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.direction === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {t.direction}
                </span>
                <span className="text-muted-foreground text-[10px]">{t.rr.toFixed(2)}R</span>
                <span
                  className={`font-semibold ml-auto ${
                    t.outcome === "WIN"
                      ? "text-emerald-400"
                      : t.outcome === "LOSS"
                        ? "text-red-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {t.outcome === "WIN"
                    ? `+${fmtMoney(t.netProfit)}`
                    : t.outcome === "LOSS"
                      ? `-${fmtMoney(t.netLoss)}`
                      : "BE"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Dashboard() {
  const trades = useTradeStore((s) => s.trades);
  const monthlyGoal = useTradeStore((s) => s.monthlyGoal);
  const setMonthlyGoal = useTradeStore((s) => s.setMonthlyGoal);
  const startingBalance = useTradeStore((s) => s.startingBalance);
  const setStartingBalance = useTradeStore((s) => s.setStartingBalance);

  const analytics = useMemo(() => computeAnalytics(trades), [trades]);

  const currentBalance = startingBalance + analytics.totalProfit - analytics.totalLoss;

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
    <div className="min-h-screen p-4 md:p-5 lg:p-6 space-y-5 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.08),transparent_18%)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-1.5">Groeax</p>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">{analytics.totalTrades} trades tracked · premium trading workspace</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="px-2.5 py-1 rounded-full border border-gray-300 bg-white/60">Live</span>
          <span className="px-2.5 py-1 rounded-full border border-gray-300 bg-white/60">Institutional UI</span>
        </div>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <MetricCard index={0} label="Net P&L" value={fmtMoney(analytics.netBalance)} sub={`${fmtMoney(analytics.totalProfit)} won`} icon={analytics.netBalance >= 0 ? TrendingUp : TrendingDown} color={analytics.netBalance >= 0 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard index={1} label="Win Rate" value={fmtPct(analytics.winRate)} sub={`${analytics.totalTrades} trades`} icon={Target} color={analytics.winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard index={2} label="Avg Win" value={fmtMoney(analytics.avgWin)} sub={`Avg Loss: ${fmtMoney(analytics.avgLoss)}`} icon={BarChart2} />
        <MetricCard index={3} label="Best Trade" value={analytics.bestTrade ? fmtMoney(analytics.bestTrade.netProfit) : "—"} sub={analytics.bestTrade?.pair} icon={Trophy} color="text-emerald-400" />
        <MetricCard index={4} label="Worst Trade" value={analytics.worstTrade ? `-${fmtMoney(analytics.worstTrade.netLoss)}` : "—"} sub={analytics.worstTrade?.pair} icon={AlertCircle} color="text-red-400" />
      </div>

      {/* Balance metrics row (only when balance is set) */}
      {startingBalance > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard index={0} label="Starting Balance" value={fmtMoney(startingBalance)} icon={DollarSign} />
          <MetricCard index={1} label="Current Balance" value={fmtMoney(currentBalance)} sub="auto-updated" icon={Wallet} color={currentBalance >= startingBalance ? "text-emerald-400" : "text-red-400"} />
          <MetricCard index={2} label="Account Growth" value={`${startingBalance > 0 ? ((currentBalance - startingBalance) / startingBalance * 100).toFixed(2) : "0.00"}%`} sub="since start" icon={Percent} color={currentBalance >= startingBalance ? "text-emerald-400" : "text-red-400"} />
          <MetricCard index={3} label="Max Drawdown" value={`${analytics.drawdownStats.drawdownPercent.toFixed(2)}%`} sub={`${fmtMoney(analytics.drawdownStats.drawdownAmount)} from peak`} icon={TrendingDown} color="text-orange-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 lg:col-span-2 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><Zap className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Performance Score</h2></div>
          {analytics.totalTrades > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}><PolarGrid stroke="rgba(255,255,255,0.07)" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(215 20% 50%)" }} /><Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} isAnimationActive /></RadarChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Add trades to see your performance</div>}
        </motion.div>

        <div className="flex flex-col gap-4">
          <BalanceCard
            startingBalance={startingBalance}
            currentBalance={currentBalance}
            totalProfit={analytics.totalProfit}
            totalLoss={analytics.totalLoss}
            drawdownStats={analytics.drawdownStats}
            onSetBalance={setStartingBalance}
          />
          <MonthlyGoalCard monthlyPnL={monthlyPnL} goal={monthlyGoal} onSetGoal={setMonthlyGoal} />
        </div>
      </div>

      <TradingSessions />

      {/* Professional trading calendar */}
      <CalendarHeatmap tradesByDate={analytics.tradesByDate} />

      <StreakCard trades={trades} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Equity Curve</h2></div>
          {analytics.equityCurve.length > 0 ? <ResponsiveContainer width="100%" height={200}><AreaChart data={analytics.equityCurve} margin={{ top: 28, right: 24, bottom: 4, left: 0 }}><defs><linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={0.18} /><stop offset="100%" stopColor="#4ade80" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmtTradeDate(v, "MMM d")} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} /><Tooltip content={undefined} /><Area type="linear" dataKey="equity" stroke="#4ade80" strokeWidth={2} fill="url(#equityGrad)" dot={{ r: 4, fill: "#4ade80", stroke: "#0f172a", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#4ade80", stroke: "#fff", strokeWidth: 1.5 }} isAnimationActive animationDuration={900} /></AreaChart></ResponsiveContainer> : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No trade data yet</div>}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><BarChart2 className="w-3.5 h-3.5 text-primary" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Net Daily P&amp;L</h2></div>
          {analytics.dailyPnL.length > 0 ? <ResponsiveContainer width="100%" height={200}><BarChart data={analytics.dailyPnL} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%"><CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmtTradeDate(v, "MMM d")} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} /><ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={2} /><Tooltip content={undefined} /><Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800} maxBarSize={36}>{analytics.dailyPnL.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={1} />)}</Bar></BarChart></ResponsiveContainer> : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No trade data yet</div>}
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
