import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Target, Shield, BarChart2, Activity,
} from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";
import { Trade } from "@/types";

interface Props {
  analytics: Analytics;
  trades: Trade[];
  startingBalance: number;
  currentBalance: number;
  monthlyGoalPct: number;
  tradingDaysPerMonth: number;
}

type Period = "Daily" | "Weekly" | "Monthly" | "Yearly";

const fmt2 = (n: number) => n.toFixed(2);

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const s = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${s}$${(abs / 1_000).toFixed(1)}K`;
  return `${s}$${abs.toFixed(2)}`;
}

function getPeriodWindow(period: Period): { start: Date; tomorrow: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  let start: Date;
  if (period === "Daily") {
    start = today;
  } else if (period === "Weekly") {
    const dow = today.getDay();
    start = new Date(today);
    start.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  } else if (period === "Monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  return { start, tomorrow };
}

function filterByPeriod(trades: Trade[], period: Period): Trade[] {
  const { start, tomorrow } = getPeriodWindow(period);
  return trades.filter((t) => {
    const d = new Date(t.date + "T12:00:00");
    return d >= start && d < tomorrow;
  });
}

function getPeriodBaseBalance(allTrades: Trade[], period: Period, startingBalance: number): number {
  const { start, tomorrow } = getPeriodWindow(period);
  const beforePnL = allTrades.reduce((sum, t) => {
    const d = new Date(t.date + "T12:00:00");
    if (d < start && d < tomorrow) return sum + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0);
    return sum;
  }, 0);
  return Math.max(startingBalance + beforePnL, 1);
}

function getPeriodTargetPct(period: Period, monthlyGoalPct: number, tradingDaysPerMonth: number): number {
  if (monthlyGoalPct <= 0) return 0;
  const m = monthlyGoalPct / 100;
  const td = tradingDaysPerMonth > 0 ? tradingDaysPerMonth : 22;
  if (period === "Daily")   return (Math.pow(1 + m, 1 / td) - 1) * 100;
  if (period === "Weekly")  return (Math.pow(1 + m, 5 / td) - 1) * 100;
  if (period === "Monthly") return monthlyGoalPct;
  return (Math.pow(1 + m, 12) - 1) * 100;
}

function calcProfitFactor(trades: Trade[]): { value: number; display: string; isInfinite: boolean; isNA: boolean } {
  const grossProfit = trades.filter(t => t.outcome === "WIN").reduce((s, t) => s + t.netProfit, 0);
  const grossLoss = trades.filter(t => t.outcome === "LOSS").reduce((s, t) => s + t.netLoss, 0);
  if (grossLoss === 0 && grossProfit === 0) return { value: 0, display: "N/A", isInfinite: false, isNA: true };
  if (grossLoss === 0) return { value: 999, display: "∞", isInfinite: true, isNA: false };
  const pf = grossProfit / grossLoss;
  return { value: pf, display: fmt2(pf), isInfinite: false, isNA: false };
}

function calcAvgRR(trades: Trade[]): number {
  const valid = trades.filter(t => (t.rr ?? 0) > 0 && (t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE"));
  if (valid.length === 0) return 0;
  return valid.reduce((s, t) => s + (t.rr ?? 0), 0) / valid.length;
}

function calcConsistencyScore(trades: Trade[]): { score: number; label: string; color: string; notEnoughData: boolean } {
  if (trades.length < 10) return { score: 0, label: "Not Enough Data", color: "text-muted-foreground", notEnoughData: true };

  const completed = trades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  if (completed.length < 10) return { score: 0, label: "Not Enough Data", color: "text-muted-foreground", notEnoughData: true };

  const wins = completed.filter(t => t.outcome === "WIN").length;
  const winRate = wins / completed.length;
  const winScore = winRate * 20;

  const lotSizes = completed.map(t => t.lotSize).filter(l => l > 0);
  let riskConsistency = 25;
  if (lotSizes.length > 1) {
    const avgLot = lotSizes.reduce((s, l) => s + l, 0) / lotSizes.length;
    const stdLot = Math.sqrt(lotSizes.reduce((s, l) => s + Math.pow(l - avgLot, 2), 0) / lotSizes.length);
    const cv = avgLot > 0 ? stdLot / avgLot : 1;
    riskConsistency = Math.max(0, 25 * (1 - Math.min(cv, 1)));
    const avgLotVal = avgLot;
    const overRisk = lotSizes.filter(l => l > avgLotVal * 2).length / lotSizes.length;
    riskConsistency -= overRisk > 0.15 ? 8 : overRisk > 0.05 ? 4 : 0;
    riskConsistency = Math.max(0, riskConsistency);
  }

  const rrVals = completed.filter(t => (t.rr ?? 0) > 0).map(t => t.rr ?? 0);
  const avgRR = rrVals.length > 0 ? rrVals.reduce((s, r) => s + r, 0) / rrVals.length : 0;
  const rrScore = avgRR >= 2 ? 20 : avgRR >= 1.5 ? 16 : avgRR >= 1 ? 12 : avgRR >= 0.5 ? 7 : 3;

  const grossProfit = completed.filter(t => t.outcome === "WIN").reduce((s, t) => s + t.netProfit, 0);
  const grossLoss = completed.filter(t => t.outcome === "LOSS").reduce((s, t) => s + t.netLoss, 0);
  const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 4 : 0;
  const pfScore = pf >= 2 ? 15 : pf >= 1.5 ? 12 : pf >= 1.2 ? 9 : pf >= 1 ? 6 : 3;

  const sorted = [...completed].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let disciplineScore = 20;
  let consecLosses = 0;
  let maxConsecLosses = 0;
  const avgLot2 = lotSizes.length > 0 ? lotSizes.reduce((s, l) => s + l, 0) / lotSizes.length : 0;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.outcome === "LOSS") {
      consecLosses++;
      maxConsecLosses = Math.max(maxConsecLosses, consecLosses);
      if (i > 0 && avgLot2 > 0 && t.lotSize > avgLot2 * 1.5) disciplineScore -= 3;
    } else {
      consecLosses = 0;
    }
  }
  if (maxConsecLosses >= 5) disciplineScore -= 10;
  else if (maxConsecLosses >= 3) disciplineScore -= 5;
  disciplineScore = Math.max(0, disciplineScore);

  const total = Math.min(100, Math.round(winScore + riskConsistency + rrScore + pfScore + disciplineScore));

  const label = total >= 90 ? "Elite" : total >= 75 ? "Good" : total >= 60 ? "Average" : "Needs Improvement";
  const color = total >= 75 ? "text-[#2ecc71]" : total >= 60 ? "text-[#f59e0b]" : "text-red-400";
  return { score: total, label, color, notEnoughData: false };
}

function calcAvgReturnPct(trades: Trade[], startingBalance: number): { pct: number; dollar: number } {
  const completed = trades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  if (completed.length === 0) return { pct: 0, dollar: 0 };
  const netPnL = completed.reduce((s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0);
  const dollar = netPnL / completed.length;
  const pct = startingBalance > 0 ? (netPnL / startingBalance / completed.length) * 100 : 0;
  return { pct, dollar };
}


function PnLTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div style={{ background: "#171a1f", border: "1px solid #252932", borderRadius: 8, padding: "10px 14px" }} className="text-xs shadow-xl">
      <p style={{ color: "#555e72", marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 700, color: v >= 0 ? "#2ecc71" : "#ef4444" }}>
        {v >= 0 ? "+" : ""}${Math.abs(v).toFixed(2)}
      </p>
    </div>
  );
}

function EndDot(p: { cx?: number; cy?: number; index?: number; total: number; color: string }) {
  const { cx = 0, cy = 0, index = 0, total, color } = p;
  if (index !== total - 1) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0e0f11" strokeWidth={2} />
    </>
  );
}

function MetricBlock({
  icon: Icon, label, value, display, ratingColor, hint, accentColor,
}: {
  icon: React.ElementType; label: string; value: string;
  display: string; ratingColor: string; hint: string; accentColor: string;
}) {
  return (
    <div className="rounded-2xl border bg-secondary/80 p-4 cursor-pointer hover:border-[#333a48] transition-colors active:scale-[0.98]" style={{ borderColor: `${accentColor}40` }}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium mb-1.5">{label}</p>
      <p className="font-bold text-foreground tracking-tight leading-tight text-2xl">{value}</p>
      <p className={`text-[12px] font-semibold mt-1 ${ratingColor}`}>{display}</p>
      <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{hint}</p>
    </div>
  );
}

export default function PerformanceScoreCard({ analytics: allAnalytics, trades, startingBalance, monthlyGoalPct, tradingDaysPerMonth }: Props) {
  const [period, setPeriod] = useState<Period>("Monthly");

  const allPeriodStats = useMemo(() =>
    (["Daily", "Weekly", "Monthly", "Yearly"] as Period[]).map((p) => {
      const ft = filterByPeriod(trades, p);
      const netDollar = ft.reduce((s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0);
      const pct = startingBalance > 0 ? (netDollar / startingBalance) * 100 : 0;
      const targetPct = getPeriodTargetPct(p, monthlyGoalPct, tradingDaysPerMonth);
      return { period: p, netDollar, pct, targetPct };
    }), [trades, startingBalance, monthlyGoalPct, tradingDaysPerMonth]);

  const filteredTrades = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const periodBaseBalance = useMemo(() => getPeriodBaseBalance(trades, period, startingBalance), [trades, period, startingBalance]);

  const periodNetDollar = useMemo(() =>
    filteredTrades.reduce((s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0),
    [filteredTrades]);

  const periodReturnPct = startingBalance > 0 ? (periodNetDollar / startingBalance) * 100 : 0;
  const isPos = periodNetDollar >= 0;
  const lineColor = isPos ? "#2ecc71" : "#ef4444";

  const cumulData = useMemo(() => {
    let cum = 0;
    const sorted = [...filteredTrades]
      .filter(t => t.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const byDay: Record<string, number> = {};
    for (const t of sorted) {
      const key = t.date.slice(0, 10);
      const pnl = t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0;
      byDay[key] = (byDay[key] ?? 0) + pnl;
    }
    return Object.keys(byDay).sort().map(date => {
      cum += byDay[date];
      return { date, pnl: +cum.toFixed(2) };
    });
  }, [filteredTrades]);

  const profitFactor = useMemo(() => calcProfitFactor(filteredTrades), [filteredTrades]);
  const avgRR = useMemo(() => calcAvgRR(filteredTrades), [filteredTrades]);
  const consistency = useMemo(() => calcConsistencyScore(filteredTrades), [filteredTrades]);
  const avgReturn = useMemo(() => calcAvgReturnPct(filteredTrades, periodBaseBalance), [filteredTrades, periodBaseBalance]);

  const completedTrades = filteredTrades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  const winsCount = completedTrades.filter(t => t.outcome === "WIN").length;
  const winRate = completedTrades.length > 0 ? (winsCount / completedTrades.length) * 100 : 0;

  const grossProfit = completedTrades.filter(t => t.outcome === "WIN").reduce((s, t) => s + t.netProfit, 0);
  const grossLoss = completedTrades.filter(t => t.outcome === "LOSS").reduce((s, t) => s + t.netLoss, 0);

  const pfR = profitFactor.isNA ? { t: "No Data", c: "text-muted-foreground" }
    : profitFactor.isInfinite ? { t: "No losing trades", c: "text-[#2ecc71]" }
    : profitFactor.value >= 2 ? { t: "Excellent", c: "text-[#2ecc71]" }
    : profitFactor.value >= 1.5 ? { t: "Good", c: "text-[#2ecc71]" }
    : profitFactor.value >= 1.2 ? { t: "Average", c: "text-[#f59e0b]" }
    : profitFactor.value >= 1 ? { t: "Below Avg", c: "text-[#f59e0b]" }
    : { t: "Poor", c: "text-red-400" };

  const rrR = avgRR >= 2 ? { t: "Above Target", c: "text-[#2ecc71]" }
    : avgRR >= 1.5 ? { t: "On Target", c: "text-[#2ecc71]" }
    : avgRR >= 1 ? { t: "Near Target", c: "text-[#f59e0b]" }
    : avgRR > 0 ? { t: "Below Target", c: "text-red-400" }
    : { t: "No Data", c: "text-muted-foreground" };

  const conR = consistency.notEnoughData
    ? { t: "Not Enough Data", c: "text-muted-foreground" }
    : { t: consistency.label, c: consistency.color };

  const avgRetR = avgReturn.dollar > 0 ? { t: "Profitable", c: "text-[#2ecc71]" }
    : avgReturn.dollar < 0 ? { t: "Losing", c: "text-red-400" }
    : { t: "Neutral", c: "text-muted-foreground" };


  const PERIOD_LABEL: Record<Period, string> = { Daily: "Today", Weekly: "This Week", Monthly: "This Month", Yearly: "This Year" };
  const PERIOD_SHORT: Record<Period, string> = { Daily: "Daily", Weekly: "Weekly", Monthly: "Monthly", Yearly: "Yearly" };
  const currentPeriodStat = allPeriodStats.find(s => s.period === period)!;

  return (
    <div className="glass-card border-t-2 border-t-emerald-500/60 p-4 w-full hover:border-white/15 transition-colors">

      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[38px] h-[38px] rounded-xl bg-secondary/40 border border-border/40 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[17px] font-bold tracking-[-0.3px] text-foreground leading-tight">Trading Performance</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Track your performance and improve every day.</p>
        </div>
      </div>

      {allAnalytics.totalTrades === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Add trades to see your performance score</div>
      ) : (
        <>
          {/* Period tabs — 2×2 on mobile, 4 in a row on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-secondary border border-border/40 rounded-2xl p-1 gap-1 mb-4">
            {allPeriodStats.map(({ period: p, netDollar, pct }) => {
              const active = p === period;
              const pos = netDollar >= 0;
              const hasDollar = netDollar !== 0;
              const valColor = !hasDollar ? "text-muted-foreground" : pos ? "text-[#2ecc71]" : "text-red-400";
              const dollarStr = hasDollar ? fmtCompact(netDollar) : "—";
              const pctStr = hasDollar
                ? `${pos ? "+" : ""}${pct.toFixed(2)}%`
                : startingBalance > 0 ? "0.00%" : "";
              return (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl gap-0.5 transition-all ${active ? "bg-card shadow-inner border border-border/60" : "hover:bg-secondary/60"}`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider leading-tight ${active ? "text-foreground" : "text-muted-foreground"}`}>{PERIOD_SHORT[p]}</span>
                  <span className={`text-[13px] font-bold leading-tight ${valColor}`}>{dollarStr}</span>
                  {pctStr && <span className={`text-[10px] font-semibold leading-tight ${valColor}`}>{pctStr}</span>}
                </button>
              );
            })}
          </div>

          {/* P&L for selected period */}
          <div className="mb-3 p-3 rounded-xl bg-secondary border border-border/40">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">Net P&L — {PERIOD_LABEL[period]}</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <p className={`font-extrabold leading-tight tracking-[-0.04em] text-3xl ${isPos ? "text-[#2ecc71]" : "text-red-400"}`}>
                  {fmtCompact(periodNetDollar)}
                </p>
                {startingBalance > 0 && (
                  <p className={`text-[13px] font-semibold mt-0.5 ${isPos ? "text-[#2ecc71]" : "text-red-400"}`}>
                    {isPos ? "+" : ""}{periodReturnPct.toFixed(2)}% Return
                  </p>
                )}
              </div>
              <div className="flex gap-3 ml-auto text-right flex-wrap justify-end">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
                  <p className={`text-sm font-bold ${winRate >= 50 ? "text-[#2ecc71]" : "text-red-400"}`}>{winRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Trades</p>
                  <p className="text-sm font-bold text-foreground">{completedTrades.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gross W</p>
                  <p className="text-sm font-bold text-[#2ecc71]">+${grossProfit.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gross L</p>
                  <p className="text-sm font-bold text-red-400">-${grossLoss.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {/* Progress bar vs target */}
            {currentPeriodStat?.targetPct > 0 && (
              <div className="mt-2.5">
                <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, (periodReturnPct / currentPeriodStat.targetPct) * 100))}%`,
                      background: periodReturnPct >= currentPeriodStat.targetPct ? "#2ecc71" : periodReturnPct > 0 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">
                  {Math.min(100, Math.max(0, (periodReturnPct / currentPeriodStat.targetPct) * 100)).toFixed(0)}% of {PERIOD_SHORT[period].toLowerCase()} target
                </p>
              </div>
            )}
          </div>

          {/* Target vs Actual table — only shown when a goal is set */}
          {monthlyGoalPct > 0 && (
            <div className="mb-3 rounded-xl bg-secondary border border-border/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Period Targets vs Actual</p>
              </div>
              <div className="divide-y divide-border/30">
                {allPeriodStats.map(({ period: p, pct, targetPct }) => {
                  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
                  const progress = targetPct > 0 ? Math.min(100, Math.max(0, (pct / targetPct) * 100)) : 0;
                  const statusLabel = targetPct <= 0 ? "No Target"
                    : pct >= targetPct ? "Above Target"
                    : pct > 0 ? "In Progress"
                    : pct === 0 ? "Not Started"
                    : "Below Target";
                  const statusColor = targetPct <= 0 ? "text-muted-foreground"
                    : pct >= targetPct ? "text-emerald-400"
                    : pct > 0 ? "text-yellow-400"
                    : pct === 0 ? "text-muted-foreground"
                    : "text-red-400";
                  const isActive = p === period;
                  return (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`w-full grid grid-cols-4 gap-1 px-3 py-2 text-left transition-colors ${isActive ? "bg-card/60" : "hover:bg-card/30"}`}>
                      <span className={`text-[11px] font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{PERIOD_SHORT[p]}</span>
                      <span className="text-[11px] text-muted-foreground">{targetPct > 0 ? `${targetPct.toFixed(2)}%` : "—"}</span>
                      <span className={`text-[11px] font-semibold ${pct > 0 ? "text-[#2ecc71]" : pct < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {fmtPct(pct)}
                      </span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
                        {targetPct > 0 && (
                          <div className="w-full h-1 rounded-full bg-border/40 overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${progress}%`,
                              background: pct >= targetPct ? "#2ecc71" : pct > 0 ? "#f59e0b" : "#374151",
                            }} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-3 py-1.5 border-t border-border/40">
                <p className="text-[9px] text-muted-foreground">Target | Actual | Status · Tap a row to switch period · Return % = Net P&L ÷ Period Opening Balance × 100</p>
              </div>
            </div>
          )}

          {/* Equity curve */}
          <div className="rounded-2xl border border-border/40 bg-secondary/80 px-3 pt-4 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: lineColor }} />
              Cumulative Equity Curve — {PERIOD_LABEL[period]}
            </div>
            {cumulData.length >= 2 ? (() => {
              const vals = cumulData.map(d => d.pnl);
              const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
              const pad = Math.max((rawMax - rawMin) * 0.15, 1);
              const fmtY = (v: number) => { const a = Math.abs(v); const s = v >= 0 ? "" : "-"; return a >= 1000 ? `${s}$${(a/1000).toFixed(1)}K` : `${s}$${a.toFixed(0)}`; };
              return (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={cumulData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.07)" strokeWidth={0.5} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#555e72" }}
                      tickFormatter={(v: string) => { const d = new Date(v + "T12:00:00"); return isNaN(d.getTime()) ? v : `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`; }}
                      axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[rawMin - pad, rawMax + pad]} tick={{ fontSize: 9, fill: "#555e72" }} tickFormatter={fmtY} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<PnLTip />} />
                    <Area type="monotone" dataKey="pnl" stroke={lineColor} strokeWidth={1.8} fill="url(#pnlGrad2)"
                      dot={(dp: { cx?: number; cy?: number; index?: number }) => (
                        <EndDot key={dp.index} cx={dp.cx} cy={dp.cy} index={dp.index} total={cumulData.length} color={lineColor} />
                      )}
                      activeDot={{ r: 7, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive animationDuration={1200} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <p className="text-[11px] text-muted-foreground text-center px-4">
                  {completedTrades.length === 0 ? `No trades ${PERIOD_LABEL[period].toLowerCase()}` : "Trade across multiple days to see the curve"}
                </p>
              </div>
            )}
          </div>

          {/* 4 metric cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-3 items-start">
            <MetricBlock
              icon={BarChart2} label="Profit Factor"
              value={profitFactor.display}
              display={pfR.t} ratingColor={pfR.c}
              hint={profitFactor.isNA ? "Not calculable yet" : profitFactor.isInfinite ? "All trades profitable — no losses recorded" : `Gross P: $${grossProfit.toFixed(2)} ÷ L: $${grossLoss.toFixed(2)}`}
              accentColor="#3b82f6"
            />
            <MetricBlock
              icon={Target} label="Average R:R"
              value={avgRR > 0 ? `${fmt2(avgRR)}R` : "N/A"}
              display={rrR.t} ratingColor={rrR.c}
              hint="Sum of all R:R ÷ completed trades"
              accentColor="#8b5cf6"
            />
            <MetricBlock
              icon={Shield} label="Consistency Score"
              value={consistency.notEnoughData ? "—" : `${consistency.score}`}
              display={conR.t} ratingColor={conR.c}
              hint={consistency.notEnoughData ? "Need 10+ trades" : "90-100 Elite · 75-89 Good · 60-74 Avg"}
              accentColor="#f59e0b"
            />
            <MetricBlock
              icon={Activity} label="Avg Return / Trade"
              value={`${avgReturn.dollar >= 0 ? "+" : ""}${fmtMoney(avgReturn.dollar)}`}
              display={`${avgReturn.pct >= 0 ? "+" : ""}${Math.abs(avgReturn.pct) >= 1000 ? avgReturn.pct.toFixed(0) : avgReturn.pct.toFixed(2)}% avg return`}
              ratingColor={avgRetR.c}
              hint={avgRetR.t}
              accentColor="#10b981"
            />
          </div>

        </>
      )}
    </div>
  );
}
