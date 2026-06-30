import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Target, Shield, BarChart2,
  CheckCircle, AlertTriangle, Zap, ChevronRight, Star,
  Trophy, TrendingDown, Activity, Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import type { Analytics } from "@/engine/analyticsEngine";
import { Trade } from "@/types";

interface Props {
  analytics: Analytics;
  trades: Trade[];
  startingBalance: number;
  currentBalance: number;
}

type Period = "Daily" | "Weekly" | "Monthly";

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

function filterByPeriod(trades: Trade[], period: Period): Trade[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "Daily") return trades.filter((t) => new Date(t.date + "T12:00:00") >= today);
  if (period === "Weekly") {
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    return trades.filter((t) => new Date(t.date + "T12:00:00") >= monday);
  }
  const som = new Date(now.getFullYear(), now.getMonth(), 1);
  return trades.filter((t) => new Date(t.date + "T12:00:00") >= som);
}

function getPeriodBaseBalance(allTrades: Trade[], period: Period, startingBalance: number): number {
  const now = new Date();
  let cutoff: Date;
  if (period === "Daily") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "Weekly") {
    const dow = now.getDay();
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    cutoff.setDate(cutoff.getDate() - (dow === 0 ? 6 : dow - 1));
  } else {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const beforePnL = allTrades.reduce((sum, t) => {
    const d = new Date(t.date + "T12:00:00");
    if (d < cutoff) return sum + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0);
    return sum;
  }, 0);
  return Math.max(startingBalance + beforePnL, 1);
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
  if (trades.length < 10) return { score: 0, label: "Not Enough Data", color: "text-[#555e72]", notEnoughData: true };

  const completed = trades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  if (completed.length < 10) return { score: 0, label: "Not Enough Data", color: "text-[#555e72]", notEnoughData: true };

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

function calcAvgReturnPct(trades: Trade[], startingBalance: number): number {
  if (trades.length === 0 || startingBalance <= 0) return 0;
  const completed = trades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  if (completed.length === 0) return 0;
  return completed.reduce((sum, t) => {
    const pnl = t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0;
    return sum + (pnl / startingBalance) * 100;
  }, 0) / completed.length;
}

function buildInsights(trades: Trade[], startingBalance: number) {
  const insights: { icon: React.ElementType; type: "good" | "warn" | "info"; text: string; sub: string }[] = [];
  if (trades.length === 0) return insights;

  const completed = trades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  const wins = completed.filter(t => t.outcome === "WIN").length;
  const winRate = completed.length > 0 ? (wins / completed.length) * 100 : 0;

  const grossProfit = completed.filter(t => t.outcome === "WIN").reduce((s, t) => s + t.netProfit, 0);
  const grossLoss = completed.filter(t => t.outcome === "LOSS").reduce((s, t) => s + t.netLoss, 0);
  const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 4 : 0;
  const avgRR = calcAvgRR(completed);

  const sorted = [...completed].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let consecLosses = 0, maxConsecLosses = 0;
  for (const t of sorted) {
    if (t.outcome === "LOSS") { consecLosses++; maxConsecLosses = Math.max(maxConsecLosses, consecLosses); }
    else consecLosses = 0;
  }

  const pairMap: Record<string, { profit: number; loss: number; wins: number; total: number }> = {};
  for (const t of completed) {
    if (!pairMap[t.pair]) pairMap[t.pair] = { profit: 0, loss: 0, wins: 0, total: 0 };
    pairMap[t.pair].total++;
    if (t.outcome === "WIN") { pairMap[t.pair].wins++; pairMap[t.pair].profit += t.netProfit; }
    if (t.outcome === "LOSS") pairMap[t.pair].loss += t.netLoss;
  }

  const sessionMap: Record<string, { wins: number; total: number }> = {};
  for (const t of completed) {
    const sess = t.session ?? "UNKNOWN";
    if (!sessionMap[sess]) sessionMap[sess] = { wins: 0, total: 0 };
    sessionMap[sess].total++;
    if (t.outcome === "WIN") sessionMap[sess].wins++;
  }

  const pairs = Object.entries(pairMap).filter(([, v]) => v.total >= 2);
  if (pairs.length > 0) {
    const bestPair = pairs.reduce((a, b) => (b[1].profit - b[1].loss) > (a[1].profit - a[1].loss) ? b : a);
    const worstPair = pairs.reduce((a, b) => (b[1].profit - b[1].loss) < (a[1].profit - a[1].loss) ? b : a);
    const bestNet = bestPair[1].profit - bestPair[1].loss;
    const worstNet = worstPair[1].profit - worstPair[1].loss;
    if (bestNet > 0)
      insights.push({ icon: Trophy, type: "good", text: `Best pair: ${bestPair[0]}`, sub: `Net +$${bestNet.toFixed(2)} — ${Math.round(bestPair[1].wins/bestPair[1].total*100)}% win rate` });
    if (worstNet < 0 && worstPair[0] !== bestPair[0])
      insights.push({ icon: TrendingDown, type: "warn", text: `Avoid ${worstPair[0]}`, sub: `Net -$${Math.abs(worstNet).toFixed(2)} — reduce exposure` });
  }

  const sessions = Object.entries(sessionMap).filter(([k, v]) => k !== "UNKNOWN" && v.total >= 2);
  if (sessions.length > 0) {
    const bestSess = sessions.reduce((a, b) => (b[1].wins/b[1].total) > (a[1].wins/a[1].total) ? b : a);
    const sessLabels: Record<string, string> = { LONDON: "London", NEW_YORK: "New York", ASIA: "Asia", TOKYO: "Tokyo" };
    insights.push({ icon: Clock, type: "info", text: `Best session: ${sessLabels[bestSess[0]] ?? bestSess[0]}`, sub: `${Math.round(bestSess[1].wins/bestSess[1].total*100)}% win rate in this session` });
  }

  if (winRate >= 65) insights.push({ icon: CheckCircle, type: "good", text: "High Win Rate", sub: `${winRate.toFixed(0)}% — stay disciplined & patient` });
  else if (winRate < 40 && completed.length >= 5) insights.push({ icon: AlertTriangle, type: "warn", text: "Win Rate Needs Work", sub: `${winRate.toFixed(0)}% — focus on quality setups` });

  if (avgRR < 1 && completed.length >= 5) insights.push({ icon: AlertTriangle, type: "warn", text: "Low R:R Ratio", sub: `${avgRR.toFixed(2)}R — target 1.5R+ per trade` });
  else if (avgRR >= 2) insights.push({ icon: Zap, type: "good", text: "Excellent R:R", sub: `${avgRR.toFixed(2)}R average — great risk management` });

  if (pf >= 2) insights.push({ icon: Star, type: "good", text: "Excellent Profit Factor", sub: `PF ${pf.toFixed(2)} — strategy has a strong edge` });
  else if (pf < 1 && completed.length >= 5) insights.push({ icon: AlertTriangle, type: "warn", text: "Negative Expectancy", sub: `PF ${pf.toFixed(2)} — losses exceed profits` });

  if (maxConsecLosses >= 4) insights.push({ icon: AlertTriangle, type: "warn", text: "Revenge Trading Risk", sub: `${maxConsecLosses} consecutive losses — take a break after 3` });

  const avgLot = completed.map(t => t.lotSize).filter(l => l > 0).reduce((s, l, _, a) => s + l / a.length, 0);
  const overRiskCount = completed.filter(t => t.lotSize > avgLot * 2).length;
  if (overRiskCount > 0 && completed.length >= 5)
    insights.push({ icon: AlertTriangle, type: "warn", text: "High Risk on Some Trades", sub: `${overRiskCount} trades with 2x normal size` });

  const weekMap: Record<string, number> = {};
  for (const t of completed) {
    const d = new Date(t.date + "T12:00:00");
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const wk = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
    const pnl = t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0;
    weekMap[key] = (weekMap[key] ?? 0) + pnl;
  }
  const weeks = Object.entries(weekMap);
  if (weeks.length >= 2) {
    const best = weeks.reduce((a, b) => b[1] > a[1] ? b : a);
    const worst = weeks.reduce((a, b) => b[1] < a[1] ? b : a);
    if (best[1] > 0) insights.push({ icon: Trophy, type: "good", text: `Best Week: ${best[0]}`, sub: `+$${best[1].toFixed(2)} — replicate this week's approach` });
    if (worst[1] < 0) insights.push({ icon: TrendingDown, type: "warn", text: `Worst Week: ${worst[0]}`, sub: `-$${Math.abs(worst[1]).toFixed(2)} — review what went wrong` });
  }

  return insights.slice(0, 4);
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
    <div className="rounded-2xl border bg-[#171a1f] p-4 cursor-pointer hover:border-[#333a48] transition-colors active:scale-[0.98]" style={{ borderColor: `${accentColor}40` }}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-[11px] text-[#8b92a5] font-medium mb-1.5">{label}</p>
      <p className="font-bold text-[#f0f2f5] tracking-tight leading-tight text-2xl">{value}</p>
      <p className={`text-[12px] font-semibold mt-1 ${ratingColor}`}>{display}</p>
      <p className="text-[10px] text-[#555e72] mt-2 leading-snug">{hint}</p>
    </div>
  );
}

export default function PerformanceScoreCard({ analytics: allAnalytics, trades, startingBalance }: Props) {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("Monthly");

  const allPeriodStats = useMemo(() =>
    (["Daily", "Weekly", "Monthly"] as Period[]).map((p) => {
      const ft = filterByPeriod(trades, p);
      const baseBalance = getPeriodBaseBalance(trades, p, startingBalance);
      const netDollar = ft.reduce((s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0);
      const pct = baseBalance > 0 ? (netDollar / baseBalance) * 100 : 0;
      return { period: p, netDollar, pct };
    }), [trades, startingBalance]);

  const filteredTrades = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const periodBaseBalance = useMemo(() => getPeriodBaseBalance(trades, period, startingBalance), [trades, period, startingBalance]);

  const periodNetDollar = useMemo(() =>
    filteredTrades.reduce((s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0),
    [filteredTrades]);

  const periodReturnPct = periodBaseBalance > 0 ? (periodNetDollar / periodBaseBalance) * 100 : 0;
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
  const avgReturnPct = useMemo(() => calcAvgReturnPct(filteredTrades, periodBaseBalance), [filteredTrades, periodBaseBalance]);

  const completedTrades = filteredTrades.filter(t => t.outcome === "WIN" || t.outcome === "LOSS" || t.outcome === "BE");
  const winsCount = completedTrades.filter(t => t.outcome === "WIN").length;
  const winRate = completedTrades.length > 0 ? (winsCount / completedTrades.length) * 100 : 0;
  const avgDollarProfit = completedTrades.length > 0 ? periodNetDollar / completedTrades.length : 0;

  const grossProfit = completedTrades.filter(t => t.outcome === "WIN").reduce((s, t) => s + t.netProfit, 0);
  const grossLoss = completedTrades.filter(t => t.outcome === "LOSS").reduce((s, t) => s + t.netLoss, 0);

  const pfR = profitFactor.isNA ? { t: "No Data", c: "text-[#555e72]" }
    : profitFactor.isInfinite ? { t: "Perfect", c: "text-[#2ecc71]" }
    : profitFactor.value >= 2 ? { t: "Excellent", c: "text-[#2ecc71]" }
    : profitFactor.value >= 1.5 ? { t: "Good", c: "text-[#2ecc71]" }
    : profitFactor.value >= 1.2 ? { t: "Average", c: "text-[#f59e0b]" }
    : profitFactor.value >= 1 ? { t: "Below Avg", c: "text-[#f59e0b]" }
    : { t: "Poor", c: "text-red-400" };

  const rrR = avgRR >= 2 ? { t: "Above Target", c: "text-[#2ecc71]" }
    : avgRR >= 1.5 ? { t: "On Target", c: "text-[#2ecc71]" }
    : avgRR >= 1 ? { t: "Near Target", c: "text-[#f59e0b]" }
    : avgRR > 0 ? { t: "Below Target", c: "text-red-400" }
    : { t: "No Data", c: "text-[#555e72]" };

  const conR = consistency.notEnoughData
    ? { t: "Not Enough Data", c: "text-[#555e72]" }
    : { t: consistency.label, c: consistency.color };

  const avgRetR = avgReturnPct > 0 ? { t: "Profitable", c: "text-[#2ecc71]" }
    : avgReturnPct < 0 ? { t: "Losing", c: "text-red-400" }
    : { t: "Neutral", c: "text-[#555e72]" };

  const insights = useMemo(() => buildInsights(filteredTrades, periodBaseBalance), [filteredTrades, periodBaseBalance]);

  const PERIOD_LABEL: Record<Period, string> = { Daily: "Today", Weekly: "This Week", Monthly: "This Month" };

  return (
    <div className="rounded-2xl border border-[#252932] bg-[#0e0f11] p-4 w-full">

      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[38px] h-[38px] rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-[#8b92a5]" />
        </div>
        <div>
          <p className="text-[17px] font-bold tracking-[-0.3px] text-[#f0f2f5] leading-tight">Trading Performance</p>
          <p className="text-[11px] text-[#555e72] mt-0.5">Track your performance and improve every day.</p>
        </div>
      </div>

      {allAnalytics.totalTrades === 0 ? (
        <div className="py-12 text-center text-[#555e72] text-sm">Add trades to see your performance score</div>
      ) : (
        <>
          {/* Period tabs */}
          <div className="grid grid-cols-3 bg-[#1c1f26] border border-[#252932] rounded-2xl p-1 gap-1 mb-4">
            {allPeriodStats.map(({ period: p, netDollar, pct }) => {
              const active = p === period;
              const pos = netDollar >= 0;
              const hasDollar = netDollar !== 0;
              const valColor = !hasDollar ? "text-[#555e72]" : pos ? "text-[#2ecc71]" : "text-red-400";
              const dollarStr = hasDollar ? fmtCompact(netDollar) : "—";
              const pctStr = hasDollar ? `${pos ? "+" : ""}${Math.abs(pct) < 10 ? pct.toFixed(2) : pct.toFixed(1)}%` : "";
              return (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl gap-0.5 transition-all ${active ? "bg-[#252932] shadow-inner" : "hover:bg-[#252932]/40"}`}>
                  <span className={`text-[11px] font-semibold leading-tight ${active ? "text-[#f0f2f5]" : "text-[#555e72]"}`}>{p}</span>
                  <span className={`text-[13px] font-bold leading-tight ${valColor}`}>{dollarStr}</span>
                  {pctStr && <span className={`text-[10px] font-medium leading-tight ${valColor}`}>{pctStr}</span>}
                </button>
              );
            })}
          </div>

          {/* P&L for period */}
          <div className="mb-4 p-3 rounded-xl bg-[#171a1f] border border-[#252932]">
            <p className="text-[11px] text-[#8b92a5] font-medium mb-2">Net P&L — {PERIOD_LABEL[period]}</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <p className={`font-extrabold leading-tight tracking-[-0.04em] text-3xl ${isPos ? "text-[#2ecc71]" : "text-red-400"}`}>
                  {fmtCompact(periodNetDollar)}
                </p>
                {periodBaseBalance > 1 && (
                  <p className={`text-[13px] font-semibold mt-0.5 ${isPos ? "text-[#2ecc71]" : "text-red-400"}`}>
                    {isPos ? "+" : ""}{periodReturnPct.toFixed(2)}%
                  </p>
                )}
              </div>
              <div className="flex gap-4 ml-auto text-right">
                <div>
                  <p className="text-[9px] text-[#555e72] uppercase tracking-wider">Win Rate</p>
                  <p className={`text-sm font-bold ${winRate >= 50 ? "text-[#2ecc71]" : "text-red-400"}`}>{winRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#555e72] uppercase tracking-wider">Trades</p>
                  <p className="text-sm font-bold text-[#f0f2f5]">{completedTrades.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#555e72] uppercase tracking-wider">Gross W</p>
                  <p className="text-sm font-bold text-[#2ecc71]">+${grossProfit.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#555e72] uppercase tracking-wider">Gross L</p>
                  <p className="text-sm font-bold text-red-400">-${grossLoss.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Equity curve */}
          <div className="rounded-2xl border border-[#252932] bg-[#171a1f] px-3 pt-4 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#8b92a5] mb-3">
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
                    <CartesianGrid strokeDasharray="0" stroke="#252932" strokeWidth={0.5} vertical={false} />
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
              <div className="h-[100px] flex flex-col items-center justify-center gap-2">
                <p className="text-[11px] text-[#555e72] text-center px-4">
                  {completedTrades.length === 0 ? `No trades ${PERIOD_LABEL[period].toLowerCase()}` : "Trade across multiple days to see the curve"}
                </p>
              </div>
            )}
          </div>

          {/* 4 metric cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <MetricBlock
              icon={BarChart2} label="Profit Factor"
              value={profitFactor.display}
              display={pfR.t} ratingColor={pfR.c}
              hint={profitFactor.isNA ? "Not calculable yet" : `Gross P: $${grossProfit.toFixed(2)} ÷ L: $${grossLoss.toFixed(2)}`}
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
              value={`${avgReturnPct >= 0 ? "+" : ""}${avgReturnPct.toFixed(3)}%`}
              display={`${avgDollarProfit >= 0 ? "+" : ""}${fmtMoney(avgDollarProfit)} avg`}
              ratingColor={avgRetR.c}
              hint="Average % return per completed trade"
              accentColor="#10b981"
            />
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-[#252932] bg-[#171a1f] p-4">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
                    <Star className="w-[18px] h-[18px] text-[#8b92a5]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#f0f2f5] leading-tight">Performance Insights</p>
                    <p className="text-[11px] text-[#555e72] mt-px">Auto-generated from your trade data</p>
                  </div>
                </div>
                <button onClick={() => setLocation("/analytics")}
                  className="flex items-center gap-1 bg-[#1c1f26] border border-[#252932] rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#f0f2f5] hover:border-[#333a48] transition-colors">
                  View Details <ChevronRight className="w-3 h-3 text-[#555e72]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {insights.map((ins, i) => {
                  const { icon: Ic, type, text, sub } = ins;
                  const dotBg = type === "good" ? "rgba(46,204,113,0.15)" : type === "warn" ? "rgba(245,158,11,0.15)" : "rgba(96,165,250,0.15)";
                  const iconClr = type === "good" ? "#2ecc71" : type === "warn" ? "#f59e0b" : "#60a5fa";
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#1c1f26] border border-[#252932]">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: dotBg }}>
                        <Ic className="w-3.5 h-3.5" style={{ color: iconClr }} />
                      </div>
                      <div>
                        <p className="text-[11px] text-[#8b92a5] font-medium leading-snug">{text}</p>
                        <p className="text-[10px] text-[#555e72] leading-snug mt-0.5">{sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
