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
  ChevronLeft, ChevronRight, Settings2, Activity, ShieldAlert,
  AlertTriangle, Heart, Zap, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";
import { Trade } from "@/types";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, isSameMonth,
} from "date-fns";

const FADE_UP = {
  hidden: { opacity: 0 },
  show: (i: number) => ({ opacity: 1, transition: { delay: i * 0.05, duration: 0.35 } }),
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
      className="glass-card border-t-2 border-t-cyan-500/70 p-4 flex flex-col gap-3 hover:border-white/15 transition-colors">
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

  const calc = useMemo(() => {
    const monthlyFrac = monthlyGoalPct / 100;
    const td = tradingDaysPerMonth;
    const weekTradingDays = Math.round(td * (5 / 22));

    // Compound targets
    const dailyTargetFrac  = Math.pow(1 + monthlyFrac, 1 / td) - 1;
    const weeklyTargetFrac = Math.pow(1 + monthlyFrac, weekTradingDays / td) - 1;

    const now      = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const dow      = now.getDay();
    const monday   = new Date(now); monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    const monStr   = format(monday, "yyyy-MM-dd");
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let prevMonthPnL = 0, prevWeekPnL = 0, prevDayPnL = 0;
    let todayPnL = 0, weekPnL = 0, monthPnL = 0;

    for (const t of trades) {
      if (!t.date) continue;
      const pnl = t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0;
      const td2 = new Date(t.date + "T12:00:00");
      if (td2 < monthStart) prevMonthPnL += pnl; else monthPnL += pnl;
      if (t.date < monStr) prevWeekPnL += pnl; else weekPnL += pnl;
      if (t.date < todayStr) prevDayPnL += pnl; else if (t.date === todayStr) todayPnL += pnl;
    }

    const base      = Math.max(startingBalance, 0.01);
    const monthBase = Math.max(base + prevMonthPnL, 0.01);
    const weekBase  = Math.max(base + prevWeekPnL, 0.01);
    const dayBase   = Math.max(base + prevDayPnL, 0.01);

    const targetAmountMonth = base * monthlyFrac;
    const targetAmountDay   = dayBase * dailyTargetFrac;
    const targetAmountWeek  = weekBase * weeklyTargetFrac;

    const dailyTargetPct  = dailyTargetFrac  * 100;
    const weeklyTargetPct = weeklyTargetFrac * 100;
    const todayActualPct  = (todayPnL / dayBase) * 100;
    const weekActualPct   = (weekPnL  / weekBase)  * 100;
    const monthActualPct  = (monthPnL / monthBase) * 100;

    // Progress = actual profit vs target amount (can exceed 100%)
    const rawProgress = targetAmountMonth !== 0 ? (monthPnL / targetAmountMonth) * 100 : 0;
    const cappedProgress = Math.min(rawProgress, 100);

    const daysInMonth       = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed       = now.getDate();
    const remainingCalDays  = daysInMonth - daysElapsed;
    const remainingTD       = Math.round(remainingCalDays * (td / 30));
    const remainingGoalPct  = Math.max(monthlyGoalPct - monthActualPct, 0);
    const requiredPerDay    = remainingTD > 0 ? remainingGoalPct / remainingTD : 0;

    // Ratios: actual achieved vs period target (for daily/weekly)
    const dailyAchievedRatio  = targetAmountDay  > 0 ? todayPnL / targetAmountDay  : (todayPnL  > 0 ? 2 : 0);
    const weeklyAchievedRatio = targetAmountWeek > 0 ? weekPnL  / targetAmountWeek : (weekPnL   > 0 ? 2 : 0);

    return {
      base, monthBase, weekBase, dayBase,
      dailyTargetPct, weeklyTargetPct,
      todayActualPct, weekActualPct, monthActualPct,
      targetAmountMonth, targetAmountDay, targetAmountWeek,
      monthPnL, weekPnL, todayPnL,
      rawProgress, cappedProgress,
      remainingTD, remainingGoalPct, requiredPerDay,
      daysElapsed, daysInMonth,
      dailyAchievedRatio, weeklyAchievedRatio,
    };
  }, [monthlyGoalPct, tradingDaysPerMonth, startingBalance, trades]);

  // Monthly status: compare actual progress vs expected calendar progress
  function calendarStatus(rawProgress: number, daysElapsed: number, daysInMonth: number) {
    const expectedPct = (daysElapsed / daysInMonth) * 100;
    if (expectedPct <= 0) return { label: "Month just started", color: "text-blue-400" };
    if (rawProgress >= expectedPct * 1.1) return { label: "✔ Ahead of Schedule", color: "text-emerald-400" };
    if (rawProgress >= expectedPct * 0.85) return { label: "● On Track", color: "text-yellow-400" };
    return { label: "✖ Behind Schedule", color: "text-red-400" };
  }

  // Period status (daily/weekly): how much of the period target was achieved
  function periodStatus(achievedRatio: number) {
    if (achievedRatio >= 1.05) return { label: "✔ Ahead of Schedule", color: "text-emerald-400" };
    if (achievedRatio >= 0.80) return { label: "● On Track", color: "text-yellow-400" };
    return { label: "✖ Behind", color: "text-red-400" };
  }

  const ringColor = calc.cappedProgress >= 100 ? "#10b981"
    : calc.cappedProgress >= 75 ? "#22c55e"
    : calc.cappedProgress >= 40 ? "#f59e0b"
    : "#ef4444";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
      className="glass-card border-t-2 border-t-violet-500/70 p-4 flex flex-col gap-3 hover:border-white/15 transition-colors">

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
          <input type="number" min="0.1" max="200" step="0.1" value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus placeholder="e.g. 5"
            className="flex-1 bg-secondary border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={commit} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {monthlyGoalPct > 0 ? (
        <>
          {/* Donut + key numbers */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 w-[88px] h-[88px]">
              <PieChart width={88} height={88}>
                <Pie data={[{ value: Math.max(calc.cappedProgress, 0) }, { value: Math.max(100 - calc.cappedProgress, 0) }]}
                  cx="50%" cy="50%" innerRadius={27} outerRadius={40} startAngle={90} endAngle={-270}
                  dataKey="value" strokeWidth={0} isAnimationActive animationDuration={900}>
                  <Cell fill={ringColor} />
                  <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                <span className="text-[10px] font-bold leading-tight" style={{ color: ringColor }}>
                  {calc.rawProgress >= 1000 ? `${(calc.rawProgress/1000).toFixed(1)}K` : calc.rawProgress.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Starting Balance</span>
                <span className="text-[11px] font-semibold text-foreground">{fmtMoney(calc.base)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Monthly Target</span>
                <span className="text-[11px] font-bold text-foreground">{monthlyGoalPct.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Target Amount</span>
                <span className="text-[11px] font-semibold text-violet-400">{fmtMoney(calc.targetAmountMonth)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Current Profit</span>
                <span className={`text-[11px] font-bold ${calc.monthPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {calc.monthPnL >= 0 ? "+" : ""}{fmtMoney(calc.monthPnL)}
                </span>
              </div>
              <p className={`text-[10px] font-semibold ${calendarStatus(calc.rawProgress, calc.daysElapsed, calc.daysInMonth).color}`}>
                {calendarStatus(calc.rawProgress, calc.daysElapsed, calc.daysInMonth).label}
              </p>
            </div>
          </div>

          {/* Progress bar — shows raw progress vs target amount */}
          <div className="space-y-1">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${calc.cappedProgress}%`, backgroundColor: ringColor }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>$0</span>
              <span>Progress: {calc.rawProgress >= 100 ? calc.rawProgress.toFixed(0) : calc.rawProgress.toFixed(1)}% of target</span>
              <span>{fmtMoney(calc.targetAmountMonth)}</span>
            </div>
          </div>

          {/* Daily & Weekly with dollar amounts */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
            <div className="bg-secondary/20 rounded-lg p-2 space-y-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Daily Target</p>
              <p className="text-xs font-bold text-foreground">{calc.dailyTargetPct.toFixed(3)}%</p>
              <p className="text-[9px] text-violet-400 font-medium">{fmtMoney(calc.targetAmountDay)}/day</p>
              <div className="border-t border-border/30 pt-1 mt-1">
                <p className="text-[9px] text-muted-foreground">Today's Return</p>
                <p className={`text-xs font-bold ${calc.todayPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {calc.todayPnL >= 0 ? "+" : ""}{fmtMoney(calc.todayPnL)}
                </p>
                <p className={`text-[9px] font-medium ${calc.todayActualPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {calc.todayActualPct >= 0 ? "+" : ""}{calc.todayActualPct.toFixed(2)}%
                </p>
                {calc.todayPnL !== 0 && (
                  <p className="text-[9px] text-muted-foreground font-medium">
                    {calc.dailyAchievedRatio >= 10
                      ? `${(calc.dailyAchievedRatio * 100).toFixed(0)}%`
                      : `${(calc.dailyAchievedRatio * 100).toFixed(1)}%`} of daily target
                  </p>
                )}
                <p className={`text-[9px] font-semibold ${periodStatus(calc.dailyAchievedRatio).color}`}>
                  {calc.todayPnL === 0 ? "No trades today" : periodStatus(calc.dailyAchievedRatio).label}
                </p>
              </div>
            </div>
            <div className="bg-secondary/20 rounded-lg p-2 space-y-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Weekly Target</p>
              <p className="text-xs font-bold text-foreground">{calc.weeklyTargetPct.toFixed(3)}%</p>
              <p className="text-[9px] text-violet-400 font-medium">{fmtMoney(calc.targetAmountWeek)}/week</p>
              <div className="border-t border-border/30 pt-1 mt-1">
                <p className="text-[9px] text-muted-foreground">This Week</p>
                <p className={`text-xs font-bold ${calc.weekPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {calc.weekPnL >= 0 ? "+" : ""}{fmtMoney(calc.weekPnL)}
                </p>
                <p className={`text-[9px] font-medium ${calc.weekActualPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {calc.weekActualPct >= 0 ? "+" : ""}{calc.weekActualPct.toFixed(2)}%
                </p>
                {calc.weekPnL !== 0 && (
                  <p className="text-[9px] text-muted-foreground font-medium">
                    {calc.weeklyAchievedRatio >= 10
                      ? `${(calc.weeklyAchievedRatio * 100).toFixed(0)}%`
                      : `${(calc.weeklyAchievedRatio * 100).toFixed(1)}%`} of weekly target
                  </p>
                )}
                <p className={`text-[9px] font-semibold ${periodStatus(calc.weeklyAchievedRatio).color}`}>
                  {calc.weekPnL === 0 ? "No trades this week" : periodStatus(calc.weeklyAchievedRatio).label}
                </p>
              </div>
            </div>
          </div>

          {/* Remaining / achieved */}
          {calc.monthPnL >= calc.targetAmountMonth ? (
            <p className="text-xs font-semibold text-emerald-400 text-center">🎯 Monthly goal reached! {fmtMoney(calc.monthPnL - calc.targetAmountMonth)} above target</p>
          ) : (
            <div className="bg-secondary/20 rounded-lg px-3 py-2 border border-border/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Remaining to target</span>
                <span className="text-xs font-bold text-orange-400">{fmtMoney(Math.max(calc.targetAmountMonth - calc.monthPnL, 0))}</span>
              </div>
              {calc.remainingTD > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Required/day ({calc.remainingTD} days left)</span>
                  <span className="text-[10px] font-semibold text-foreground">{calc.requiredPerDay.toFixed(4)}%</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <p className="text-sm text-muted-foreground text-center">Set a monthly return % target</p>
          <p className="text-[11px] text-muted-foreground/70 text-center">Daily & weekly compound targets auto-calculated</p>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
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

// ── Funding account templates ──────────────────────────────────────────────────
const FUNDING_TEMPLATES: { name: string; profitTarget: number; dailyLoss: number; maxLoss: number; minDays: number; consistency: boolean }[] = [
  { name: "FTMO",         profitTarget: 10, dailyLoss: 5,  maxLoss: 10, minDays: 4,  consistency: false },
  { name: "FundingPips",  profitTarget: 8,  dailyLoss: 4,  maxLoss: 8,  minDays: 5,  consistency: false },
  { name: "The5ers",      profitTarget: 6,  dailyLoss: 4,  maxLoss: 6,  minDays: 0,  consistency: false },
  { name: "Alpha Capital",profitTarget: 10, dailyLoss: 5,  maxLoss: 10, minDays: 5,  consistency: false },
  { name: "FundedNext",   profitTarget: 10, dailyLoss: 5,  maxLoss: 10, minDays: 5,  consistency: true  },
];

// ── Risk Monitor Card ─────────────────────────────────────────────────────────
function RiskMonitorCard({
  startingBalance, currentBalance, dailyLossLimit, maxLossLimit,
  profitTargetPct, minTradingDays, consistencyRule, trades,
  onSetDailyLoss, onSetMaxLoss, onSetProfitTarget, onSetMinDays, onSetConsistency,
}: {
  startingBalance: number; currentBalance: number; dailyLossLimit: number; maxLossLimit: number;
  profitTargetPct: number; minTradingDays: number; consistencyRule: boolean; trades: Trade[];
  onSetDailyLoss: (v: number) => void; onSetMaxLoss: (v: number) => void;
  onSetProfitTarget: (v: number) => void; onSetMinDays: (v: number) => void;
  onSetConsistency: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [draftDailyLoss, setDraftDailyLoss] = useState(String(dailyLossLimit || ""));
  const [draftMaxLoss, setDraftMaxLoss] = useState(String(maxLossLimit || ""));
  const [draftProfitTarget, setDraftProfitTarget] = useState(String(profitTargetPct || ""));
  const [draftMinDays, setDraftMinDays] = useState(String(minTradingDays || ""));

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayLoss = trades.filter(t => t.date === todayStr && t.outcome === "LOSS").reduce((s, t) => s + t.netLoss, 0);
  const todayProfit = trades.filter(t => t.date === todayStr && t.outcome === "WIN").reduce((s, t) => s + t.netProfit, 0);

  const peakBalance = useMemo(() => {
    let peak = startingBalance;
    let bal = startingBalance;
    const sorted = [...trades].filter(t => t.date).sort((a, b) => a.date.localeCompare(b.date));
    for (const t of sorted) {
      if (t.outcome === "WIN") bal += t.netProfit;
      else if (t.outcome === "LOSS") bal -= t.netLoss;
      if (bal > peak) peak = bal;
    }
    return peak;
  }, [trades, startingBalance]);

  const totalDrawdown = Math.max(0, peakBalance - currentBalance);
  const netPnL = currentBalance - startingBalance;
  const profitTarget$ = startingBalance > 0 && profitTargetPct > 0 ? startingBalance * profitTargetPct / 100 : 0;
  const dailyLossLimit$ = startingBalance > 0 && dailyLossLimit > 0 ? startingBalance * dailyLossLimit / 100 : 0;
  const maxLossLimit$ = startingBalance > 0 && maxLossLimit > 0 ? startingBalance * maxLossLimit / 100 : 0;

  const dailyLossUsedPct = dailyLossLimit$ > 0 ? Math.min(100, (todayLoss / dailyLossLimit$) * 100) : 0;
  const maxLossUsedPct = maxLossLimit$ > 0 ? Math.min(100, (totalDrawdown / maxLossLimit$) * 100) : 0;
  const profitProgressPct = profitTarget$ > 0 ? Math.min(100, (Math.max(0, netPnL) / profitTarget$) * 100) : 0;

  const tradingDaysCount = useMemo(() => {
    const days = new Set(trades.filter(t => t.date).map(t => t.date));
    return days.size;
  }, [trades]);

  const dailyColor = dailyLossUsedPct >= 80 ? "bg-red-500" : dailyLossUsedPct >= 50 ? "bg-yellow-500" : "bg-emerald-500";
  const maxLossColor = maxLossUsedPct >= 80 ? "bg-red-500" : maxLossUsedPct >= 50 ? "bg-yellow-500" : "bg-emerald-500";

  const accountHealth = useMemo(() => {
    let score = 100;
    if (dailyLossUsedPct >= 80) score -= 30;
    else if (dailyLossUsedPct >= 50) score -= 15;
    if (maxLossUsedPct >= 80) score -= 40;
    else if (maxLossUsedPct >= 50) score -= 20;
    return Math.max(0, Math.min(100, score));
  }, [dailyLossUsedPct, maxLossUsedPct]);

  const healthColor = accountHealth >= 80 ? "text-emerald-400" : accountHealth >= 60 ? "text-yellow-400" : "text-red-400";
  const isBreached = dailyLossUsedPct >= 100 || maxLossUsedPct >= 100;

  function applyTemplate(t: typeof FUNDING_TEMPLATES[0]) {
    if (!startingBalance) return;
    onSetProfitTarget(t.profitTarget);
    onSetDailyLoss(t.dailyLoss);
    onSetMaxLoss(t.maxLoss);
    onSetMinDays(t.minDays);
    onSetConsistency(t.consistency);
    setDraftProfitTarget(String(t.profitTarget));
    setDraftDailyLoss(String(t.dailyLoss));
    setDraftMaxLoss(String(t.maxLoss));
    setDraftMinDays(String(t.minDays));
    setShowTemplates(false);
  }

  function saveSettings() {
    const dl = parseFloat(draftDailyLoss);
    const ml = parseFloat(draftMaxLoss);
    const pt = parseFloat(draftProfitTarget);
    const md = parseInt(draftMinDays);
    if (!isNaN(dl) && dl >= 0) onSetDailyLoss(dl);
    if (!isNaN(ml) && ml >= 0) onSetMaxLoss(ml);
    if (!isNaN(pt) && pt >= 0) onSetProfitTarget(pt);
    if (!isNaN(md) && md >= 0) onSetMinDays(md);
    setEditing(false);
  }

  const isConfigured = dailyLossLimit > 0 || maxLossLimit > 0 || profitTargetPct > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
      className="glass-card border-t-2 border-t-red-500/60 p-4 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Risk Monitor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowTemplates(!showTemplates); setEditing(false); }}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <BookOpen className="w-3 h-3" /> Templates
          </button>
          <button onClick={() => { setEditing(!editing); setShowTemplates(false); }}
            className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Template picker */}
      {showTemplates && (
        <div className="mb-4 p-3 rounded-xl bg-secondary border border-border/40">
          <p className="text-[11px] text-muted-foreground mb-2 font-medium">Select a funded account template:</p>
          {startingBalance <= 0 && <p className="text-[11px] text-yellow-400 mb-2">⚠ Set your starting balance first to use templates.</p>}
          <div className="flex flex-wrap gap-2">
            {FUNDING_TEMPLATES.map(t => (
              <button key={t.name} onClick={() => applyTemplate(t)} disabled={startingBalance <= 0}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/60 hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {t.name}
              </button>
            ))}
            <button onClick={() => { setShowTemplates(false); setEditing(true); }}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              Custom
            </button>
          </div>
        </div>
      )}

      {/* Settings editor */}
      {editing && (
        <div className="mb-4 p-3 rounded-xl bg-secondary border border-border/40 space-y-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Risk Rules (% of account)</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Profit Target %</label>
              <input type="number" min="0" step="0.1" value={draftProfitTarget} onChange={e => setDraftProfitTarget(e.target.value)}
                className="w-full bg-card border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. 10" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Min Trading Days</label>
              <input type="number" min="0" step="1" value={draftMinDays} onChange={e => setDraftMinDays(e.target.value)}
                className="w-full bg-card border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. 5" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Daily Loss Limit %</label>
              <input type="number" min="0" step="0.1" value={draftDailyLoss} onChange={e => setDraftDailyLoss(e.target.value)}
                className="w-full bg-card border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. 5" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Max Loss Limit %</label>
              <input type="number" min="0" step="0.1" value={draftMaxLoss} onChange={e => setDraftMaxLoss(e.target.value)}
                className="w-full bg-card border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. 10" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={consistencyRule} onChange={e => onSetConsistency(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-primary" />
            <span className="text-[11px] text-muted-foreground">Consistency Rule enabled</span>
          </label>
          <div className="flex gap-2">
            <button onClick={saveSettings} className="flex-1 py-1.5 rounded-lg bg-primary/20 text-primary text-[12px] font-medium hover:bg-primary/30 transition-colors">Save</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-secondary/60 text-muted-foreground text-[12px] hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {!isConfigured && !editing && !showTemplates ? (
        <div className="flex flex-col items-center justify-center py-5 gap-2 text-center">
          <ShieldAlert className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Set your funded account rules to monitor risk</p>
          <div className="flex gap-2 flex-wrap justify-center">
            <button onClick={() => setShowTemplates(true)} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">+ Load Template</button>
            <span className="text-muted-foreground text-xs">or</span>
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">+ Custom Rules</button>
          </div>
        </div>
      ) : isConfigured && !editing && !showTemplates ? (
        <div className="space-y-3">
          {/* Breach warning */}
          {isBreached && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-[12px] text-red-400 font-semibold">Rule breach detected — stop trading immediately</p>
            </div>
          )}

          {/* Profit target progress */}
          {profitTargetPct > 0 && startingBalance > 0 && (
            <div className="p-3 rounded-xl bg-secondary border border-border/40">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">Profit Target</span>
                <span className="text-[11px] font-bold text-emerald-400">{profitProgressPct.toFixed(0)}% of {profitTargetPct}%</span>
              </div>
              <div className="h-2 bg-border/40 rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${profitProgressPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Current: {netPnL >= 0 ? "+" : ""}{fmtMoney(netPnL)}</span>
                <span>Target: {fmtMoney(profitTarget$)}</span>
              </div>
            </div>
          )}

          {/* Daily loss limit */}
          {dailyLossLimit > 0 && startingBalance > 0 && (
            <div className="p-3 rounded-xl bg-secondary border border-border/40">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">Daily Loss Limit</span>
                <span className={`text-[11px] font-bold ${dailyLossUsedPct >= 80 ? "text-red-400" : dailyLossUsedPct >= 50 ? "text-yellow-400" : "text-emerald-400"}`}>{dailyLossUsedPct.toFixed(0)}% Used</span>
              </div>
              <div className="h-2 bg-border/40 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all duration-700 ${dailyColor}`} style={{ width: `${dailyLossUsedPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Used: {fmtMoney(todayLoss)}</span>
                <span>Remaining: {fmtMoney(Math.max(0, dailyLossLimit$ - todayLoss))}</span>
              </div>
            </div>
          )}

          {/* Max drawdown limit */}
          {maxLossLimit > 0 && startingBalance > 0 && (
            <div className="p-3 rounded-xl bg-secondary border border-border/40">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">Max Drawdown Limit</span>
                <span className={`text-[11px] font-bold ${maxLossUsedPct >= 80 ? "text-red-400" : maxLossUsedPct >= 50 ? "text-yellow-400" : "text-emerald-400"}`}>{maxLossUsedPct.toFixed(0)}% Used</span>
              </div>
              <div className="h-2 bg-border/40 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all duration-700 ${maxLossColor}`} style={{ width: `${maxLossUsedPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Drawdown: {fmtMoney(totalDrawdown)}</span>
                <span>Remaining: {fmtMoney(Math.max(0, maxLossLimit$ - totalDrawdown))}</span>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2 items-start">
            <div className="p-2.5 rounded-xl bg-secondary border border-border/40 text-center">
              <p className={`text-lg font-bold ${healthColor}`}>{accountHealth}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Account Health</p>
            </div>
            <div className="p-2.5 rounded-xl bg-secondary border border-border/40 text-center">
              <p className="text-lg font-bold text-foreground">{todayProfit > 0 ? "+" : ""}{fmtMoney(todayProfit - todayLoss)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Today's Net P&L</p>
            </div>
            {minTradingDays > 0 && (
              <div className="p-2.5 rounded-xl bg-secondary border border-border/40 text-center">
                <p className="text-lg font-bold text-foreground">{tradingDaysCount}<span className="text-sm text-muted-foreground">/{minTradingDays}</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Trading Days</p>
              </div>
            )}
            <div className={`p-2.5 rounded-xl border text-center ${isBreached ? "bg-red-500/10 border-red-500/30" : "bg-secondary border-border/40"}`}>
              <p className={`text-base font-bold ${isBreached ? "text-red-400" : accountHealth >= 80 ? "text-emerald-400" : "text-yellow-400"}`}>
                {isBreached ? "⚠ Breached" : accountHealth >= 80 ? "✓ Healthy" : "! At Risk"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Account Status</p>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

// ── Funded Account Rules Card ─────────────────────────────────────────────────
function FundingRulesCard({
  startingBalance, profitTargetPct, dailyLossLimit, maxLossLimit,
  minTradingDays, consistencyRule,
}: {
  startingBalance: number; profitTargetPct: number; dailyLossLimit: number;
  maxLossLimit: number; minTradingDays: number; consistencyRule: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (profitTargetPct <= 0 && dailyLossLimit <= 0 && maxLossLimit <= 0) return null;

  const rules = [
    { label: "Starting Balance", value: startingBalance > 0 ? fmtMoney(startingBalance) : "Not set" },
    profitTargetPct > 0 && { label: "Profit Target", value: `${profitTargetPct}%${startingBalance > 0 ? ` (${fmtMoney(startingBalance * profitTargetPct / 100)})` : ""}` },
    dailyLossLimit > 0 && { label: "Daily Loss Limit", value: `${dailyLossLimit}%${startingBalance > 0 ? ` (${fmtMoney(startingBalance * dailyLossLimit / 100)})` : ""}` },
    maxLossLimit > 0 && { label: "Max Drawdown", value: `${maxLossLimit}%${startingBalance > 0 ? ` (${fmtMoney(startingBalance * maxLossLimit / 100)})` : ""}` },
    minTradingDays > 0 && { label: "Min Trading Days", value: `${minTradingDays} days` },
    { label: "Consistency Rule", value: consistencyRule ? "Enabled" : "Disabled" },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
      className="glass-card border-t-2 border-t-violet-500/60 p-4 hover:border-white/15 transition-colors">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-violet-400" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Funded Account Rules</h2>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-3 space-y-0 rounded-xl overflow-hidden border border-border/40">
          {rules.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-3 py-2.5 text-sm ${i % 2 === 0 ? "bg-secondary/60" : "bg-secondary/30"}`}>
              <span className="text-muted-foreground text-[12px]">{r.label}</span>
              <span className="text-foreground font-semibold text-[12px]">{r.value}</span>
            </div>
          ))}
        </div>
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
  const dailyLossLimit = useTradeStore((s) => s.dailyLossLimit);
  const maxLossLimit = useTradeStore((s) => s.maxLossLimit);
  const profitTargetPct = useTradeStore((s) => s.profitTargetPct);
  const minTradingDays = useTradeStore((s) => s.minTradingDays);
  const consistencyRule = useTradeStore((s) => s.consistencyRule);
  const setDailyLossLimit = useTradeStore((s) => s.setDailyLossLimit);
  const setMaxLossLimit = useTradeStore((s) => s.setMaxLossLimit);
  const setProfitTargetPct = useTradeStore((s) => s.setProfitTargetPct);
  const setMinTradingDays = useTradeStore((s) => s.setMinTradingDays);
  const setConsistencyRule = useTradeStore((s) => s.setConsistencyRule);

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="md:col-span-1 lg:col-span-2">
          <PerformanceScoreCard analytics={analytics} trades={trades} startingBalance={startingBalance} currentBalance={currentBalance} monthlyGoalPct={monthlyGoalPct} tradingDaysPerMonth={tradingDaysPerMonth} />
        </motion.div>
        <div className="flex flex-col gap-4">
          <BalanceCard startingBalance={startingBalance} currentBalance={currentBalance} totalProfit={analytics.totalProfit} totalLoss={analytics.totalLoss} drawdownStats={analytics.drawdownStats} onSetBalance={setStartingBalance} />
          <GoalTrackingCard monthlyGoalPct={monthlyGoalPct} tradingDaysPerMonth={tradingDaysPerMonth} startingBalance={startingBalance} trades={trades} onSetGoalPct={setMonthlyGoalPct} onSetTradingDays={setTradingDaysPerMonth} />
        </div>
      </div>

      {/* Risk Monitor + Funding Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RiskMonitorCard
          startingBalance={startingBalance} currentBalance={currentBalance}
          dailyLossLimit={dailyLossLimit} maxLossLimit={maxLossLimit}
          profitTargetPct={profitTargetPct} minTradingDays={minTradingDays}
          consistencyRule={consistencyRule} trades={trades}
          onSetDailyLoss={setDailyLossLimit} onSetMaxLoss={setMaxLossLimit}
          onSetProfitTarget={setProfitTargetPct} onSetMinDays={setMinTradingDays}
          onSetConsistency={setConsistencyRule}
        />
        <FundingRulesCard
          startingBalance={startingBalance} profitTargetPct={profitTargetPct}
          dailyLossLimit={dailyLossLimit} maxLossLimit={maxLossLimit}
          minTradingDays={minTradingDays} consistencyRule={consistencyRule}
        />
      </div>

      <TradingSessions />

      {/* Advanced Statistics — Professional Metrics */}
      {analytics.totalTrades >= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="glass-card border-t-2 border-t-pink-500/60 p-4 hover:border-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-pink-400" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Advanced Statistics</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
            {/* Expectancy */}
            <div className="bg-secondary rounded-xl p-3 border border-border/50">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Expectancy</p>
              <p className={`text-base font-bold ${analytics.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {analytics.expectancy >= 0 ? "+" : ""}{fmtMoney(analytics.expectancy)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">(WR × AvgW) − (LR × AvgL)</p>
            </div>
            {/* Profit Factor */}
            <div className="bg-secondary rounded-xl p-3 border border-border/50">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Profit Factor</p>
              <p className={`text-base font-bold ${analytics.profitFactor >= 1.5 ? "text-emerald-400" : analytics.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                {analytics.profitFactor === 999 ? "∞" : analytics.profitFactor.toFixed(2)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">Gross Profit ÷ Gross Loss</p>
            </div>
            {/* Recovery Factor */}
            <div className="bg-secondary rounded-xl p-3 border border-border/50">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Recovery Factor</p>
              <p className={`text-base font-bold ${analytics.recoveryFactor > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {analytics.recoveryFactor === 999 ? "∞" : analytics.recoveryFactor.toFixed(2)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">Net P&L ÷ Max Drawdown</p>
            </div>
            {/* Avg R:R */}
            <div className="bg-secondary rounded-xl p-3 border border-border/50">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Avg R:R</p>
              <p className={`text-base font-bold ${analytics.avgRR >= 1.5 ? "text-emerald-400" : analytics.avgRR >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                {analytics.avgRR > 0 ? `${analytics.avgRR.toFixed(2)}R` : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">Sum(RR) ÷ Completed Trades</p>
            </div>
            {/* Sharpe Ratio — col-span-2 on mobile so it fills the last row cleanly */}
            <div className="bg-secondary rounded-xl p-3 border border-border/50 col-span-2 sm:col-span-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Sharpe Ratio</p>
              <p className={`text-base font-bold ${analytics.sharpeRatio > 1 ? "text-emerald-400" : analytics.sharpeRatio > 0 ? "text-yellow-400" : "text-red-400"}`}>
                {startingBalance > 0 ? analytics.sharpeRatio.toFixed(2) : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">Annualised daily returns</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 items-start">
            <div className="bg-secondary rounded-xl p-3 border border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Consec. Wins</p>
                <p className="text-lg font-bold text-emerald-400">{analytics.maxConsecWins}</p>
              </div>
            </div>
            <div className="bg-secondary rounded-xl p-3 border border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Consec. Losses</p>
                <p className="text-lg font-bold text-red-400">{analytics.maxConsecLosses}</p>
              </div>
            </div>
            <div className="bg-secondary rounded-xl p-3 border border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg Win</p>
                <p className="text-base font-bold text-blue-400">{fmtMoney(analytics.avgWin)}</p>
              </div>
            </div>
            <div className="bg-secondary rounded-xl p-3 border border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg Loss</p>
                <p className="text-base font-bold text-orange-400">{fmtMoney(analytics.avgLoss)}</p>
              </div>
            </div>
          </div>
          {startingBalance > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center items-start">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Return %</p>
                <p className={`text-sm font-bold ${analytics.netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {analytics.netBalance >= 0 ? "+" : ""}{((analytics.netBalance / startingBalance) * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Sortino Ratio</p>
                <p className={`text-sm font-bold ${analytics.sortinoRatio > 1 ? "text-emerald-400" : analytics.sortinoRatio > 0 ? "text-yellow-400" : "text-red-400"}`}>
                  {analytics.sortinoRatio.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Drawdown</p>
                <p className="text-sm font-bold text-orange-400">{analytics.drawdownStats.drawdownPercent.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Win/Loss Ratio</p>
                <p className={`text-sm font-bold ${analytics.avgLoss > 0 ? (analytics.avgWin / analytics.avgLoss >= 1 ? "text-emerald-400" : "text-yellow-400") : "text-muted-foreground"}`}>
                  {analytics.avgLoss > 0 ? (analytics.avgWin / analytics.avgLoss).toFixed(2) : "—"}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <CalendarHeatmap tradesByDate={analytics.tradesByDate} />
      <StreakCard trades={trades} />
      <EquityCurveCard equityCurve={analytics.equityCurve} startingBalance={startingBalance} currentBalance={currentBalance} maxDrawdownPct={analytics.drawdownStats.drawdownPercent} netPnL={analytics.netBalance} />

      {/* Net Daily P&L */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        className="glass-card border-t-2 border-t-blue-500/60 p-4 hover:border-white/15 transition-colors">
        <div className="flex items-center gap-2 mb-4"><BarChart2 className="w-3.5 h-3.5 text-blue-400" /><h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Net Daily P&amp;L</h2></div>
        {analytics.dailyPnL.length > 0
          ? <ResponsiveContainer width="100%" height={200}><BarChart data={analytics.dailyPnL} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%"><CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmtTradeDate(v, "MMM d")} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} width={48} /><ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={2} /><Tooltip content={<DarkTooltip />} /><Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800} maxBarSize={36}>{analytics.dailyPnL.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={1} />)}</Bar></BarChart></ResponsiveContainer>
          : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No trade data yet</div>}
      </motion.div>

      {/* Weekly Performance Trend */}
      {weeklyTrend.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
          className="glass-card border-t-2 border-t-emerald-500/60 p-4 hover:border-white/15 transition-colors">
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="glass-card border-t-2 border-t-amber-500/60 p-4 hover:border-white/15 transition-colors">
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
