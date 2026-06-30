import { useMemo, useState } from "react";
import { fmtTradeDate, toDate } from "@/lib/dateUtils";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics, DrawdownStats } from "@/engine/analyticsEngine";
import TradingSessions from "@/components/dashboard/TradingSessions";
import StreakCard from "@/components/dashboard/StreakCard";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, ComposedChart,
} from "recharts";
import PerformanceScoreCard from "@/components/dashboard/PerformanceScoreCard";
import EquityCurveCard from "@/components/dashboard/EquityCurveCard";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Target, BarChart2, Trophy, AlertCircle,
  Award, Flag, Pencil, Check, X, Wallet, DollarSign, Percent,
  ChevronLeft, ChevronRight, Settings2,
} from "lucide-react";
import { Trade } from "@/types";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, isSameMonth,
} from "date-fns";

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const val = entry?.value ?? 0;
  const key = entry?.dataKey;
  const isNeg = val < 0;
  return (
    <div style={{ background: "hsl(220 14% 11%)", border: "1px solid hsl(220 13% 22%)" }} className="rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1 font-medium">{label}</p>
      <p className={`font-bold text-sm ${isNeg ? "text-red-400" : "text-emerald-400"}`}>
        {key === "pnl" ? "P&L" : "Equity"}: {isNeg ? "-" : ""}${Math.abs(val).toFixed(2)}
      </p>
    </div>
  );
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function fmtPnLCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

// ── Accent-colored metric card ────────────────────────────────────────────────
type AccentColor = "emerald" | "blue" | "violet" | "amber" | "red" | "orange" | "cyan" | "pink";

const ACCENT_STYLES: Record<AccentColor, { border: string; bg: string; icon: string }> = {
  emerald: { border: "border-t-emerald-500/70",  bg: "bg-emerald-500/[0.04]",  icon: "text-emerald-400" },
  blue:    { border: "border-t-blue-500/70",     bg: "bg-blue-500/[0.04]",     icon: "text-blue-400"    },
  violet:  { border: "border-t-violet-500/70",   bg: "bg-violet-500/[0.04]",   icon: "text-violet-400"  },
  amber:   { border: "border-t-amber-500/70",    bg: "bg-amber-500/[0.04]",    icon: "text-amber-400"   },
  red:     { border: "border-t-red-500/70",      bg: "bg-red-500/[0.04]",      icon: "text-red-400"     },
  orange:  { border: "border-t-orange-500/70",   bg: "bg-orange-500/[0.04]",   icon: "text-orange-400"  },
  cyan:    { border: "border-t-cyan-500/70",     bg: "bg-cyan-500/[0.04]",     icon: "text-cyan-400"    },
  pink:    { border: "border-t-pink-500/70",     bg: "bg-pink-500/[0.04]",     icon: "text-pink-400"    },
};

function MetricCard({
  label, value, sub, icon: Icon, color, index, className, accent = "blue",
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color?: string; index: number; className?: string; accent?: AccentColor;
}) {
  const { border, bg, icon: iconColor } = ACCENT_STYLES[accent];
  const valFontClass = value.length > 10 ? "text-base" : value.length > 7 ? "text-xl" : "text-2xl";
  return (
    <motion.div
      custom={index} initial="hidden" animate="show" variants={FADE_UP}
      className={`glass-card border-t-2 ${border} ${bg} p-4 flex flex-col gap-1.5 hover:border-white/15 transition-colors ${className ?? ""}`}
    >
      <div className={`flex items-center gap-2 ${iconColor}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`font-bold leading-tight truncate ${valFontClass} ${color ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

// ── Balance card ──────────────────────────────────────────────────────────────
function BalanceCard({ startingBalance, currentBalance, totalProfit, totalLoss, drawdownStats, onSetBalance }: {
  startingBalance: number; currentBalance: number; totalProfit: number; totalLoss: number;
  drawdownStats: DrawdownStats; onSetBalance: (b: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(startingBalance || ""));
  const growth = startingBalance > 0 ? ((currentBalance - startingBalance) / startingBalance) * 100 : 0;
  const maxDrawdown = drawdownStats.drawdownPercent;

  function commit() {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) onSetBalance(v);
    setEditing(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="glass-card border-t-2 border-t-cyan-500/70 bg-cyan-500/[0.03] p-4 flex flex-col gap-3 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400"><Wallet className="w-3.5 h-3.5" /><span className="text-xs uppercase tracking-wider text-muted-foreground">Balance</span></div>
        <button onClick={() => { setDraft(String(startingBalance || "")); setEditing(true); }} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-white/5">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      {editing && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <input type="number" min="1" step="any" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus placeholder="e.g. 10000"
            className="flex-1 bg-secondary border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={commit} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {startingBalance > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Starting</p><p className="text-sm font-semibold text-foreground">{fmtMoney(startingBalance)}</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p><p className={`text-sm font-bold ${currentBalance >= startingBalance ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(currentBalance)}</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Growth</p><p className={`text-sm font-semibold ${growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{growth >= 0 ? "+" : ""}{growth.toFixed(2)}%</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Drawdown</p><p className="text-sm font-semibold text-orange-400">{maxDrawdown.toFixed(2)}%</p></div>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${growth >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(Math.abs(growth), 100)}%` }} />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Net P&L: {totalProfit - totalLoss >= 0 ? "+" : ""}{fmtMoney(totalProfit - totalLoss)}</span>
            <span>{growth >= 0 ? "+" : ""}{growth.toFixed(1)}% return</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <p className="text-sm text-muted-foreground text-center">Set your starting balance to track account growth</p>
          {!editing && <button onClick={() => setEditing(true)} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">+ Set balance</button>}
        </div>
      )}
    </motion.div>
  );
}

// ── Goal Tracking Card (% based with compound formulas) ───────────────────────
function GoalTrackingCard({
  monthlyGoalPct, tradingDaysPerMonth, startingBalance, trades,
  onSetGoalPct, onSetTradingDays,
}: {
  monthlyGoalPct: number; tradingDaysPerMonth: number; startingBalance: number;
  trades: Trade[]; onSetGoalPct: (g: number) => void; onSetTradingDays: (d: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(monthlyGoalPct || ""));
  const [showSettings, setShowSettings] = useState(false);

  function commit() {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) onSetGoalPct(v);
    setEditing(false);
  }

  const { dailyTargetPct, weeklyTargetPct, todayActualPct, weekActualPct, monthActualPct, baseBalance } = useMemo(() => {
    const monthlyFrac = monthlyGoalPct / 100;
    const td = tradingDaysPerMonth;
    const weekTradingDays = Math.round(td / (22 / 5));

    const dailyTarget = Math.pow(1 + monthlyFrac, 1 / td) - 1;
    const weeklyTarget = Math.pow(1 + monthlyFrac, weekTradingDays / td) - 1;

    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const dow = now.getDay();
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    const mondayStr = format(mondayDate, "yyyy-MM-dd");
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let prevMonthPnL = 0, prevWeekPnL = 0, prevDayPnL = 0;
    let todayPnL = 0, weekPnL = 0, monthPnL = 0;

    for (const t of trades) {
      if (!t.date) continue;
      const pnl = t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0;
      const td2 = new Date(t.date + "T12:00:00");
      if (td2 < monthStart) prevMonthPnL += pnl;
      else monthPnL += pnl;
      if (t.date < mondayStr) prevWeekPnL += pnl;
      else if (t.date >= mondayStr) weekPnL += pnl;
      if (t.date < todayStr) prevDayPnL += pnl;
      else if (t.date === todayStr) todayPnL += pnl;
    }

    const base = Math.max(startingBalance, 1);
    const monthBase = Math.max(base + prevMonthPnL, 1);
    const weekBase = Math.max(base + prevWeekPnL, 1);
    const dayBase = Math.max(base + prevDayPnL, 1);

    return {
      dailyTargetPct: dailyTarget * 100,
      weeklyTargetPct: weeklyTarget * 100,
      todayActualPct: (todayPnL / dayBase) * 100,
      weekActualPct: (weekPnL / weekBase) * 100,
      monthActualPct: (monthPnL / monthBase) * 100,
      baseBalance: base,
    };
  }, [monthlyGoalPct, tradingDaysPerMonth, startingBalance, trades]);

  function statusFor(actual: number, target: number) {
    if (actual >= target * 1.05) return { label: "✔ Ahead of Target", color: "text-emerald-400" };
    if (actual >= target * 0.85) return { label: "● On Track", color: "text-yellow-400" };
    return { label: "✖ Behind Target", color: "text-red-400" };
  }

  const monthProgress = monthlyGoalPct > 0 ? Math.min((monthActualPct / monthlyGoalPct) * 100, 100) : 0;
  const ringColor = monthProgress >= 100 ? "#10b981" : monthProgress >= 75 ? "#22c55e" : monthProgress >= 40 ? "#f59e0b" : "#ef4444";

  const remainingPct = Math.max(monthlyGoalPct - monthActualPct, 0);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingCalDays = daysInMonth - now.getDate();
  const dayFraction = tradingDaysPerMonth / 30;
  const remainingTradingDays = Math.round(remainingCalDays * dayFraction);
  const requiredPerDay = remainingTradingDays > 0 ? remainingPct / remainingTradingDays : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
      className="glass-card border-t-2 border-t-violet-500/70 bg-violet-500/[0.03] p-4 flex flex-col gap-3 hover:border-white/15 transition-colors">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-violet-400"><Flag className="w-3.5 h-3.5" /><span className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Goal</span></div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-white/5"><Settings2 className="w-3 h-3" /></button>
          <button onClick={() => { setDraft(String(monthlyGoalPct || "")); setEditing(true); }} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-white/5"><Pencil className="w-3 h-3" /></button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-secondary/40 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Trading days/month</span>
          <div className="flex gap-2">
            {[22, 30].map(d => (
              <button key={d} onClick={() => onSetTradingDays(d)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${tradingDaysPerMonth === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {d === 22 ? "Trading (22)" : "Calendar (30)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">%</span>
          <input type="number" min="0.1" max="100" step="0.1" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus placeholder="e.g. 3"
            className="flex-1 bg-secondary border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={commit} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {monthlyGoalPct > 0 ? (
        <>
          {/* Header: donut + goal pct */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={[{ value: Math.max(monthProgress, 0) }, { value: Math.max(100 - monthProgress, 0) }]}
                    cx="50%" cy="50%" innerRadius={28} outerRadius={40} startAngle={90} endAngle={-270}
                    dataKey="value" strokeWidth={0} isAnimationActive animationDuration={900}>
                    <Cell fill={ringColor} />
                    <Cell fill="rgba(255,255,255,0.05)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs font-bold" style={{ color: ringColor }}>{monthProgress.toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Target</span>
                <span className="text-sm font-bold text-foreground">{monthlyGoalPct.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</span>
                <span className={`text-sm font-bold ${monthActualPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{monthActualPct >= 0 ? "+" : ""}{monthActualPct.toFixed(2)}%</span>
              </div>
              <p className={`text-[10px] font-semibold ${statusFor(monthActualPct, monthlyGoalPct).color}`}>
                {statusFor(monthActualPct, monthlyGoalPct).label}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${monthProgress}%`, backgroundColor: ringColor }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span><span>{monthlyGoalPct.toFixed(1)}% target</span>
            </div>
          </div>

          {/* Daily & Weekly rows */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
            {/* Daily */}
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Daily Target</p>
              <p className="text-xs font-bold text-foreground">{dailyTargetPct.toFixed(4)}%</p>
              <p className="text-[9px] text-muted-foreground">Today</p>
              <p className={`text-xs font-bold ${todayActualPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{todayActualPct >= 0 ? "+" : ""}{todayActualPct.toFixed(3)}%</p>
              <p className={`text-[9px] font-medium ${statusFor(todayActualPct, dailyTargetPct).color}`}>{statusFor(todayActualPct, dailyTargetPct).label}</p>
            </div>
            {/* Weekly */}
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Weekly Target</p>
              <p className="text-xs font-bold text-foreground">{weeklyTargetPct.toFixed(3)}%</p>
              <p className="text-[9px] text-muted-foreground">This Week</p>
              <p className={`text-xs font-bold ${weekActualPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{weekActualPct >= 0 ? "+" : ""}{weekActualPct.toFixed(3)}%</p>
              <p className={`text-[9px] font-medium ${statusFor(weekActualPct, weeklyTargetPct).color}`}>{statusFor(weekActualPct, weeklyTargetPct).label}</p>
            </div>
          </div>

          {/* Remaining */}
          {remainingPct > 0 && (
            <div className="bg-secondary/30 rounded-lg px-3 py-2 border border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Remaining Goal</span>
                <span className="text-xs font-bold text-orange-400">{remainingPct.toFixed(2)}%</span>
              </div>
              {remainingTradingDays > 0 && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Need per trading day</span>
                  <span className="text-xs font-semibold text-foreground">{requiredPerDay.toFixed(4)}%</span>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground mt-1">{remainingTradingDays} trading days remaining</p>
            </div>
          )}
          {monthActualPct >= monthlyGoalPct && <p className="text-xs font-semibold text-emerald-400 text-center">🎯 Monthly goal reached!</p>}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <p className="text-sm text-muted-foreground text-center">Set a monthly return % target</p>
          <p className="text-[11px] text-muted-foreground/70 text-center">Daily & weekly targets calculated automatically</p>
          {!editing && <button onClick={() => setEditing(true)} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">+ Set % goal</button>}
        </div>
      )}
    </motion.div>
  );
}

// ── Calendar heatmap ──────────────────────────────────────────────────────────
function CalendarHeatmap({ tradesByDate }: { tradesByDate: Record<string, Trade[]> }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));
  const blanks = Array.from({ length: firstDayOfWeek });
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedTrades = selectedDate ? (tradesByDate[selectedDate] ?? []) : [];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
      className="glass-card p-4 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</span>
        <button onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {weekLabels.map((d) => (<div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5 tracking-wide">{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (<div key={`blank-${i}`} className="aspect-square rounded-lg" />))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTrades = tradesByDate[key] ?? [];
          const pnl = dayTrades.reduce((acc, t) => acc + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0);
          const wins = dayTrades.filter((t) => t.outcome === "WIN").length;
          const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
          const hasTrades = dayTrades.length > 0;
          const isSelected = selectedDate === key;
          const today = isToday(day);
          return (
            <button key={key} onClick={() => setSelectedDate(isSelected ? null : key)}
              className={["relative aspect-square rounded-lg p-1 text-left transition-all duration-150 focus:outline-none flex flex-col overflow-hidden w-full",
                hasTrades ? pnl > 0 ? "bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/50" : pnl < 0 ? "bg-red-800 hover:bg-red-700 border border-red-600/50" : "bg-white/10 hover:bg-white/15 border border-white/10"
                  : today ? "bg-primary/10 border border-primary/30 hover:bg-primary/15" : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]",
                isSelected ? "ring-2 ring-white/50 ring-offset-1 ring-offset-transparent scale-[1.03]" : ""].join(" ")}>
              <span className={["absolute top-0.5 right-1 text-[9px] sm:text-[11px] font-semibold leading-tight", hasTrades ? "text-white/80" : today ? "text-primary" : "text-muted-foreground/60"].join(" ")}>{format(day, "d")}</span>
              {today && !hasTrades && (<span className="absolute top-1 left-1 w-1 h-1 rounded-full bg-primary" />)}
              {hasTrades && (
                <div className="mt-auto pt-1 flex flex-col gap-0">
                  <p className="text-white font-bold text-[8px] sm:text-[10px] leading-tight truncate">{fmtPnLCompact(pnl)}</p>
                  <p className="text-white/70 text-[7px] sm:text-[9px] leading-tight">{dayTrades.length}t</p>
                  <p className="text-white/70 text-[7px] sm:text-[9px] leading-tight">{winRate.toFixed(0)}%</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedDate && selectedTrades.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-border overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground mb-3">{fmtTradeDate(selectedDate, "EEEE, MMMM d yyyy")}</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {selectedTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-secondary/40 gap-2">
                <span className="font-semibold text-foreground min-w-[60px]">{t.pair}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{t.direction}</span>
                <span className="text-muted-foreground text-[10px]">{t.rr.toFixed(2)}R</span>
                <span className={`font-semibold ml-auto ${t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"}`}>
                  {t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "BE"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const trades = useTradeStore((s) => s.trades);
  const monthlyGoal = useTradeStore((s) => s.monthlyGoal);
  const monthlyGoalPct = useTradeStore((s) => s.monthlyGoalPct);
  const tradingDaysPerMonth = useTradeStore((s) => s.tradingDaysPerMonth);
  const setMonthlyGoal = useTradeStore((s) => s.setMonthlyGoal);
  const setMonthlyGoalPct = useTradeStore((s) => s.setMonthlyGoalPct);
  const setTradingDaysPerMonth = useTradeStore((s) => s.setTradingDaysPerMonth);
  const startingBalance = useTradeStore((s) => s.startingBalance);
  const setStartingBalance = useTradeStore((s) => s.setStartingBalance);

  const analytics = useMemo(() => computeAnalytics(trades, startingBalance), [trades, startingBalance]);
  const currentBalance = startingBalance + analytics.totalProfit - analytics.totalLoss;

  const weeklyTrend = useMemo(() => {
    const weekMap: Record<string, { wins: number; total: number; profit: number; loss: number }> = {};
    trades.forEach((t) => {
      if (!t.date) return;
      const d = new Date(t.date + "T12:00:00");
      if (isNaN(d.getTime())) return;
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (!weekMap[key]) weekMap[key] = { wins: 0, total: 0, profit: 0, loss: 0 };
      weekMap[key].total++;
      if (t.outcome === "WIN") { weekMap[key].wins++; weekMap[key].profit += t.netProfit; }
      if (t.outcome === "LOSS") { weekMap[key].loss += t.netLoss; }
    });
    return Object.keys(weekMap).sort().slice(-6).map((key) => {
      const w = weekMap[key];
      const pnl = parseFloat((w.profit - w.loss).toFixed(2));
      const winRate = w.total > 0 ? Math.round((w.wins / w.total) * 100) : 0;
      const pf = w.loss > 0 ? parseFloat((w.profit / w.loss).toFixed(2)) : w.profit > 0 ? 4 : 0;
      return { week: `W${key.split("W")[1]}`, pnl, winRate, pf, trades: w.total };
    });
  }, [trades]);

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

  return (
    <div className="min-h-screen p-4 md:p-5 lg:p-6 space-y-5 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.08),transparent_18%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-1">Groeax</p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{analytics.totalTrades} trades tracked · premium workspace</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-semibold text-muted-foreground shrink-0">
          <span className="px-2.5 py-1 rounded-full border border-border bg-card text-foreground">Live</span>
          <span className="px-2.5 py-1 rounded-full border border-border bg-card text-foreground">Institutional UI</span>
        </div>
      </div>

      {/* Core metrics — 5 distinct colored cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard index={0} accent="emerald" label="Net P&L" value={fmtMoney(analytics.netBalance)} sub={`${fmtMoney(analytics.totalProfit)} won`} icon={analytics.netBalance >= 0 ? TrendingUp : TrendingDown} color={analytics.netBalance >= 0 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard index={1} accent="blue" label="Win Rate" value={fmtPct(analytics.winRate)} sub={`${analytics.totalTrades} trades`} icon={Target} color={analytics.winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard index={2} accent="violet" label="Avg Win" value={fmtMoney(analytics.avgWin)} sub={`Avg Loss: ${fmtMoney(analytics.avgLoss)}`} icon={BarChart2} />
        <MetricCard index={3} accent="amber" label="Best Trade" value={analytics.bestTrade ? fmtMoney(analytics.bestTrade.netProfit) : "—"} sub={analytics.bestTrade?.pair} icon={Trophy} color={analytics.bestTrade ? "text-amber-400" : undefined} />
        <MetricCard index={4} accent="red" label="Worst Trade" value={analytics.worstTrade ? `-${fmtMoney(analytics.worstTrade.netLoss)}` : "—"} sub={analytics.worstTrade?.pair} icon={AlertCircle} color={analytics.worstTrade ? "text-red-400" : undefined} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Balance metrics row — 5 distinct colored cards */}
      {startingBalance > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard index={0} accent="cyan" label="Starting Balance" value={fmtMoney(startingBalance)} icon={DollarSign} />
          <MetricCard index={1} accent="emerald" label="Current Balance" value={fmtMoney(currentBalance)} sub="auto-updated" icon={Wallet} color={currentBalance >= startingBalance ? "text-emerald-400" : "text-red-400"} />
          <MetricCard index={2} accent="violet" label="Peak Equity" value={fmtMoney(analytics.drawdownStats.peak)} sub="all-time high" icon={Trophy} color="text-violet-400" />
          <MetricCard index={3} accent="blue" label="Account Growth" value={`${startingBalance > 0 ? ((currentBalance - startingBalance) / startingBalance * 100).toFixed(2) : "0.00"}%`} sub="since start" icon={Percent} color={currentBalance >= startingBalance ? "text-emerald-400" : "text-red-400"} />
          <MetricCard index={4} accent="orange" label="Max Drawdown" value={`${analytics.drawdownStats.drawdownPercent.toFixed(2)}%`} sub={`${fmtMoney(analytics.drawdownStats.drawdownAmount)} from peak`} icon={TrendingDown} color="text-orange-400" className="col-span-2 sm:col-span-1" />
        </div>
      )}

      {/* Performance card + side cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-1 lg:col-span-2">
          <PerformanceScoreCard analytics={analytics} trades={trades} startingBalance={startingBalance} currentBalance={currentBalance} />
        </motion.div>
        <div className="flex flex-col gap-4">
          <BalanceCard startingBalance={startingBalance} currentBalance={currentBalance} totalProfit={analytics.totalProfit} totalLoss={analytics.totalLoss} drawdownStats={analytics.drawdownStats} onSetBalance={setStartingBalance} />
          <GoalTrackingCard monthlyGoalPct={monthlyGoalPct} tradingDaysPerMonth={tradingDaysPerMonth} startingBalance={startingBalance} trades={trades} onSetGoalPct={setMonthlyGoalPct} onSetTradingDays={setTradingDaysPerMonth} />
        </div>
      </div>

      <TradingSessions />
      <CalendarHeatmap tradesByDate={analytics.tradesByDate} />
      <StreakCard trades={trades} />
      <EquityCurveCard equityCurve={analytics.equityCurve} startingBalance={startingBalance} currentBalance={currentBalance} maxDrawdownPct={analytics.drawdownStats.drawdownPercent} netPnL={analytics.netBalance} />

      {/* Net Daily P&L */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="glass-card border-t-2 border-t-blue-500/60 bg-blue-500/[0.02] p-4 hover:border-white/15 transition-colors">
        <div className="flex items-center gap-2 mb-4"><BarChart2 className="w-3.5 h-3.5 text-blue-400" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Net Daily P&amp;L</h2></div>
        {analytics.dailyPnL.length > 0
          ? <ResponsiveContainer width="100%" height={200}><BarChart data={analytics.dailyPnL} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%"><CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmtTradeDate(v, "MMM d")} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} /><ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={2} /><Tooltip content={<DarkTooltip />} /><Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800} maxBarSize={36}>{analytics.dailyPnL.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={1} />)}</Bar></BarChart></ResponsiveContainer>
          : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No trade data yet</div>}
      </motion.div>

      {/* Weekly Performance Trend */}
      {weeklyTrend.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="glass-card border-t-2 border-t-emerald-500/60 bg-emerald-500/[0.02] p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Weekly Performance Trend</h2></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={weeklyTrend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pnl" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} />
              <ReferenceLine yAxisId="pnl" y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const pnlEntry = payload.find((p) => p.dataKey === "pnl");
                const pnlVal = (pnlEntry?.value as number) ?? 0;
                return (
                  <div style={{ background: "hsl(220 14% 11%)", border: "1px solid hsl(220 13% 22%)" }} className="rounded-lg px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[140px]">
                    <p className="text-muted-foreground font-semibold mb-1.5">{label}</p>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">P&L</span><span className={`font-bold ${pnlVal >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnlVal >= 0 ? "+" : ""}${Math.abs(pnlVal).toFixed(2)}</span></div>
                  </div>
                );
              }} />
              <Bar yAxisId="pnl" dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive animationDuration={800}>
                {weeklyTrend.map((entry, i) => (<Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />))}
              </Bar>
              <Bar yAxisId="pnl" dataKey="pf" hide />
              <Bar yAxisId="pnl" dataKey="trades" hide />
              <Bar yAxisId="pnl" dataKey="winRate" hide />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
            {(() => {
              const profitable = weeklyTrend.filter((w) => w.pnl > 0).length;
              const avgWR = weeklyTrend.length > 0 ? Math.round(weeklyTrend.reduce((a, w) => a + w.winRate, 0) / weeklyTrend.length) : 0;
              const totalPnL = weeklyTrend.reduce((a, w) => a + w.pnl, 0);
              return (
                <>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Profitable Weeks</p><p className={`text-base font-bold ${profitable >= weeklyTrend.length / 2 ? "text-emerald-400" : "text-red-400"}`}>{profitable} / {weeklyTrend.length}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Win Rate</p><p className={`text-base font-bold ${avgWR >= 50 ? "text-violet-400" : "text-yellow-400"}`}>{avgWR}%</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Period P&L</p><p className={`text-base font-bold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>{totalPnL >= 0 ? "+" : ""}${Math.abs(totalPnL).toFixed(2)}</p></div>
                </>
              );
            })()}
          </div>
        </motion.div>
      )}

      {analytics.totalTrades > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card border-t-2 border-t-amber-500/60 bg-amber-500/[0.02] p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4"><Award className="w-3.5 h-3.5 text-amber-400" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Trades</h2></div>
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
