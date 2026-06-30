import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Target, Shield, BarChart2,
  CheckCircle, AlertTriangle, Focus, ChevronRight, Star,
} from "lucide-react";
import { useLocation } from "wouter";
import { computeAnalytics } from "@/engine/analyticsEngine";
import type { Analytics } from "@/engine/analyticsEngine";
import { Trade } from "@/types";

interface Props {
  analytics: Analytics;
  trades: Trade[];
  startingBalance: number;
  currentBalance: number;
}

type Period = "Daily" | "Weekly" | "Monthly";

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmt2 = (n: number) => n.toFixed(2);

/** Compact dollar string: +$1.2K / -$500.00 */
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const s   = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${s}$${(abs / 1_000).toFixed(1)}K`;
  return `${s}$${abs.toFixed(2)}`;
}

/** For the period tab return badge: prefer % when base is large enough */
function periodReturnStr(netDollar: number, pct: number, startingBalance: number): string {
  if (netDollar === 0) return "—";
  // Show % only if starting balance is meaningful AND % is in a readable range
  if (startingBalance >= 50 && Math.abs(pct) < 5000) {
    const s = netDollar >= 0 ? "+" : "";
    return `${s}${Math.abs(pct) < 10 ? pct.toFixed(2) : pct.toFixed(1)}%`;
  }
  return fmtCompact(netDollar);
}

/** Adaptive font size for large number strings */
function numFont(str: string): string {
  const l = str.length;
  if (l <= 7)  return "text-[2.2rem]";
  if (l <= 10) return "text-[1.6rem]";
  if (l <= 13) return "text-[1.3rem]";
  return "text-xl";
}
function metricFont(str: string): string {
  const l = str.length;
  if (l <= 5)  return "text-[1.75rem]";
  if (l <= 8)  return "text-[1.35rem]";
  return "text-lg";
}

/* ── Filter trades by period ─────────────────────────────────────────── */
function filterByPeriod(trades: Trade[], period: Period): Trade[] {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "Daily")
    return trades.filter((t) => new Date(t.date + "T12:00:00") >= today);
  if (period === "Weekly") {
    const dow    = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    return trades.filter((t) => new Date(t.date + "T12:00:00") >= monday);
  }
  const som = new Date(now.getFullYear(), now.getMonth(), 1);
  return trades.filter((t) => new Date(t.date + "T12:00:00") >= som);
}

/* ── Chart tooltip ───────────────────────────────────────────────────── */
function PnLTip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
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

/* ── End dot ─────────────────────────────────────────────────────────── */
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

/* ── Metric card ─────────────────────────────────────────────────────── */
function MetricCard({
  icon: Icon, label, value, rating, ratingColor, hint,
}: {
  icon: React.ElementType; label: string; value: string;
  rating: string; ratingColor: string; hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#252932] bg-[#171a1f] p-4 cursor-pointer hover:border-[#333a48] transition-colors active:scale-[0.98]">
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px] text-[#8b92a5]" />
        </div>
        <span className="text-[#555e72] text-lg mt-0.5">›</span>
      </div>
      <p className="text-[11px] text-[#8b92a5] font-medium mb-1.5 flex items-center gap-1">
        {label}
        <span className="w-3 h-3 rounded-full border border-[#555e72] inline-flex items-center justify-center text-[7px] text-[#555e72]">i</span>
      </p>
      <p className={`font-bold text-[#f0f2f5] tracking-tight leading-tight ${metricFont(value)}`}>{value}</p>
      <p className={`text-[12px] font-semibold mt-1 ${ratingColor}`}>{rating}</p>
      <p className="text-[10px] text-[#555e72] mt-2 leading-snug">{hint}</p>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function PerformanceScoreCard({
  analytics: allAnalytics,
  trades,
  startingBalance,
}: Props) {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("Monthly");

  /* pre-compute all 3 period net dollars for the tab row */
  const allPeriodStats = useMemo(() =>
    (["Daily", "Weekly", "Monthly"] as Period[]).map((p) => {
      const ft = filterByPeriod(trades, p);
      const netDollar = ft.reduce(
        (s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0,
      );
      const pct = startingBalance > 0 ? (netDollar / startingBalance) * 100 : 0;
      return { period: p, netDollar, pct };
    }), [trades, startingBalance]);

  /* filtered data for selected period */
  const filteredTrades = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const a = useMemo(
    () => computeAnalytics(filteredTrades, startingBalance),
    [filteredTrades, startingBalance],
  );

  /* selected period net $ */
  const periodNetDollar = useMemo(
    () => filteredTrades.reduce(
      (s, t) => s + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0), 0,
    ), [filteredTrades],
  );
  const netPnLPct = startingBalance > 0 ? (periodNetDollar / startingBalance) * 100 : 0;
  const isPos     = periodNetDollar >= 0;
  const lineColor = isPos ? "#2ecc71" : "#ef4444";

  /* main P&L display */
  const showPct    = startingBalance >= 50 && Math.abs(netPnLPct) < 5000;
  const mainValue  = showPct
    ? `${isPos ? "+" : ""}${Math.abs(netPnLPct) < 10 ? fmt2(netPnLPct) : netPnLPct.toFixed(1)}%`
    : fmtCompact(periodNetDollar);
  const subValue   = showPct ? fmtCompact(periodNetDollar) : null;

  /* cumulative $ P&L chart data (NOT % — avoids extreme values with small base) */
  const cumulData = useMemo(() => {
    let cum = 0;
    return a.dailyPnL.map((d) => {
      cum += d.pnl;
      return { date: d.date, pnl: +cum.toFixed(2) };
    });
  }, [a.dailyPnL]);

  /* avg per trade */
  const avgPerTrade    = a.totalTrades > 0 ? periodNetDollar / a.totalTrades : 0;
  const avgPerTradeStr = `${avgPerTrade >= 0 ? "+" : ""}$${Math.abs(avgPerTrade).toFixed(2)}`;

  /* other metrics */
  const pf    = a.totalLoss > 0 ? a.totalProfit / a.totalLoss : a.totalProfit > 0 ? 4 : 0;
  const maxDD = a.drawdownStats.drawdownPercent;

  const avgRR = useMemo(() => {
    const valid = filteredTrades.filter((t) => (t.rr ?? 0) > 0);
    return valid.length > 0 ? valid.reduce((s, t) => s + (t.rr ?? 0), 0) / valid.length : 0;
  }, [filteredTrades]);

  const consistency = useMemo(() => {
    const wrScore   = a.winRate / 100;
    const riskScore = avgRR >= 2 ? 1 : avgRR >= 1 ? 0.75 : avgRR >= 0.5 ? 0.4 : 0.15;
    const freqScore = a.totalTrades >= 20 ? 1 : a.totalTrades >= 10 ? 0.75 : a.totalTrades >= 5 ? 0.5 : 0.25;
    return Math.round((wrScore * 0.40 + riskScore * 0.30 + freqScore * 0.30) * 100);
  }, [a.winRate, avgRR, a.totalTrades]);

  /* ratings */
  const pfR  = pf >= 2 ? { t: "Excellent", c: "text-[#2ecc71]" }
             : pf >= 1.5 ? { t: "Good", c: "text-[#2ecc71]" }
             : pf >= 1.2 ? { t: "Average", c: "text-[#f59e0b]" }
             : pf >= 1   ? { t: "Below Avg", c: "text-[#f59e0b]" }
             : { t: "Poor", c: "text-red-400" };
  const rrR  = avgRR >= 2 ? { t: "Above Target", c: "text-[#2ecc71]" }
             : avgRR >= 1.5 ? { t: "On Target", c: "text-[#2ecc71]" }
             : avgRR >= 1   ? { t: "Near Target", c: "text-[#f59e0b]" }
             : { t: "Below Target", c: "text-red-400" };
  const conR = consistency >= 80 ? { t: "Excellent", c: "text-[#2ecc71]" }
             : consistency >= 65 ? { t: "Good", c: "text-[#2ecc71]" }
             : consistency >= 45 ? { t: "Average", c: "text-[#f59e0b]" }
             : { t: "Weak", c: "text-red-400" };
  const retC = avgPerTrade > 0 ? "text-[#2ecc71]" : avgPerTrade < 0 ? "text-red-400" : "text-[#f59e0b]";
  const retR = avgPerTrade > 0 ? "Profitable" : avgPerTrade < 0 ? "Losing" : "Neutral";

  /* insights */
  const insights = useMemo(() => {
    const list: { icon: React.ElementType; type: "good" | "warn" | "info"; text: string; sub: string }[] = [];
    if (pf >= 1.5)
      list.push({ icon: CheckCircle,   type: "good", text: "Profitability above average", sub: "Keep maintaining your edge." });
    else if (pf < 1)
      list.push({ icon: AlertTriangle, type: "warn", text: "Work on your profit factor",  sub: "Focus on reducing losses." });
    if (maxDD > 20)
      list.push({ icon: AlertTriangle, type: "warn", text: "Work on reducing drawdowns",  sub: "Big losses impact your curve." });
    else if (maxDD <= 10 && a.totalTrades > 0)
      list.push({ icon: CheckCircle,   type: "good", text: "Drawdown well controlled",    sub: "Risk management is solid." });
    if (avgRR >= 2)
      list.push({ icon: Focus,         type: "info", text: "Focus on high R:R setups",    sub: "You perform best above 2R." });
    else if (avgRR < 1.5 && a.totalTrades > 0)
      list.push({ icon: AlertTriangle, type: "warn", text: "Improve R:R to 1.5+",         sub: "Aim for 1.5:1 reward ratio." });
    if (a.winRate >= 60)
      list.push({ icon: CheckCircle,   type: "good", text: "Win rate is strong",           sub: "Stay patient, avoid revenge." });
    return list.slice(0, 3);
  }, [pf, maxDD, avgRR, a.winRate, a.totalTrades]);

  const PERIOD_LABEL: Record<Period, string> = { Daily: "Today", Weekly: "This Week", Monthly: "This Month" };

  /* ── RENDER ── */
  return (
    <div className="rounded-2xl border border-[#252932] bg-[#0e0f11] p-4 w-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[38px] h-[38px] rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-[#8b92a5]" />
        </div>
        <div>
          <p className="text-[17px] font-bold tracking-[-0.3px] text-[#f0f2f5] leading-tight">
            Trading Performance
          </p>
          <p className="text-[11px] text-[#555e72] mt-0.5">Track your performance and improve every day.</p>
        </div>
      </div>

      {allAnalytics.totalTrades === 0 ? (
        <div className="py-12 text-center text-[#555e72] text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <>
          {/* ── Period tab row — full width, all 3 returns visible ── */}
          <div className="grid grid-cols-3 bg-[#1c1f26] border border-[#252932] rounded-2xl p-1 gap-1 mb-4">
            {allPeriodStats.map(({ period: p, netDollar, pct }) => {
              const active  = p === period;
              const pos     = netDollar >= 0;
              const valStr  = periodReturnStr(netDollar, pct, startingBalance);
              const valColor = netDollar === 0 ? "text-[#555e72]"
                             : pos ? "text-[#2ecc71]" : "text-red-400";
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl gap-0.5 transition-all ${
                    active ? "bg-[#252932] shadow-inner" : "hover:bg-[#252932]/40"
                  }`}
                >
                  <span className={`text-[11px] font-semibold leading-tight ${active ? "text-[#f0f2f5]" : "text-[#555e72]"}`}>
                    {p}
                  </span>
                  <span className={`text-[13px] font-bold leading-tight ${valColor}`}>
                    {valStr}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── P&L for selected period ── */}
          <div className="mb-4">
            <p className="text-[12px] text-[#8b92a5] font-medium mb-1 flex items-center gap-1.5">
              Net P&L — {PERIOD_LABEL[period]}
              <span className="w-3.5 h-3.5 rounded-full border border-[#555e72] inline-flex items-center justify-center text-[8px] text-[#555e72] shrink-0">i</span>
            </p>
            <p className={`font-extrabold leading-tight tracking-[-0.04em] ${numFont(mainValue)} ${isPos ? "text-[#2ecc71]" : "text-red-400"}`}>
              {mainValue}
            </p>
            {subValue && (
              <p className={`text-[14px] font-semibold mt-0.5 ${isPos ? "text-[#2ecc71]" : "text-red-400"}`}>
                {subValue}
              </p>
            )}
            {a.totalTrades > 0 && (
              <p className="text-[11px] text-[#555e72] mt-1">{a.totalTrades} trade{a.totalTrades > 1 ? "s" : ""} · {a.winRate.toFixed(0)}% win rate</p>
            )}
          </div>

          {/* ── Cumulative $ P&L Chart (always rendered) ── */}
          <div className="rounded-2xl border border-[#252932] bg-[#171a1f] px-3 pt-4 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#8b92a5] mb-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: lineColor }} />
              Cumulative P&amp;L ($)
            </div>

            {cumulData.length >= 2 ? (() => {
              const vals   = cumulData.map((d) => d.pnl);
              const rawMin = Math.min(...vals);
              const rawMax = Math.max(...vals);
              const pad    = Math.max((rawMax - rawMin) * 0.15, 1);
              const yMin   = rawMin - pad;
              const yMax   = rawMax + pad;

              const fmtY = (v: number) => {
                const abs = Math.abs(v);
                const s = v >= 0 ? "" : "-";
                if (abs >= 1000) return `${s}$${(abs / 1000).toFixed(1)}K`;
                return `${s}$${abs.toFixed(0)}`;
              };

              return (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={cumulData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke="#252932" strokeWidth={0.5} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#555e72" }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v + "T12:00:00");
                        return isNaN(d.getTime()) ? v
                          : `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
                      }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tick={{ fontSize: 9, fill: "#555e72" }}
                      tickFormatter={fmtY}
                      axisLine={false} tickLine={false}
                      width={40}
                    />
                    <Tooltip content={<PnLTip />} />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke={lineColor}
                      strokeWidth={1.8}
                      fill="url(#pnlGrad)"
                      dot={(dp: { cx?: number; cy?: number; index?: number }) => (
                        <EndDot
                          key={dp.index}
                          cx={dp.cx} cy={dp.cy} index={dp.index}
                          total={cumulData.length}
                          color={lineColor}
                        />
                      )}
                      activeDot={{ r: 7, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive animationDuration={1400} animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })() : (
              <div className="h-[100px] flex flex-col items-center justify-center gap-2">
                <div className="w-full h-px bg-[#252932]" />
                <p className="text-[11px] text-[#555e72] text-center px-4">
                  {a.totalTrades === 0
                    ? `No trades ${PERIOD_LABEL[period].toLowerCase()}`
                    : "Trade across multiple days to see the chart"}
                </p>
                <div className="w-full h-px bg-[#252932]" />
              </div>
            )}
          </div>

          {/* ── 2×2 Metric Cards ── */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <MetricCard
              icon={BarChart2} label="Profit Factor"
              value={pf >= 4 ? "4.00+" : fmt2(pf)}
              rating={pfR.t} ratingColor={pfR.c}
              hint="> 1.5 is considered good"
            />
            <MetricCard
              icon={Target} label="Average R:R"
              value={`${fmt2(avgRR)}R`}
              rating={rrR.t} ratingColor={rrR.c}
              hint="Target: 2.00R+"
            />
            <MetricCard
              icon={Shield} label="Consistency"
              value={`${consistency}%`}
              rating={conR.t} ratingColor={conR.c}
              hint="Based on risk, returns & discipline"
            />
            <MetricCard
              icon={TrendingUp} label="Avg Return"
              value={avgPerTradeStr}
              rating={retR} ratingColor={retC}
              hint="Average profit per completed trade"
            />
          </div>

          {/* ── Performance Insights ── */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-[#252932] bg-[#171a1f] p-4">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
                    <Star className="w-[18px] h-[18px] text-[#8b92a5]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#f0f2f5] leading-tight">Performance Insights</p>
                    <p className="text-[11px] text-[#555e72] mt-px">Key insights to help you improve</p>
                  </div>
                </div>
                <button
                  onClick={() => setLocation("/analytics")}
                  className="flex items-center gap-1 bg-[#1c1f26] border border-[#252932] rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#f0f2f5] whitespace-nowrap hover:border-[#333a48] transition-colors"
                >
                  View Details
                  <ChevronRight className="w-3 h-3 text-[#555e72]" />
                </button>
              </div>

              <div className="flex items-start">
                {insights.map((ins, i) => {
                  const { icon: Ic, type, text, sub } = ins;
                  const dotBg   = type === "good" ? "rgba(46,204,113,0.15)"
                                : type === "warn" ? "rgba(245,158,11,0.15)"
                                :                   "rgba(96,165,250,0.15)";
                  const iconClr = type === "good" ? "#2ecc71" : type === "warn" ? "#f59e0b" : "#60a5fa";
                  return (
                    <div key={i} className="flex items-start flex-1 min-w-0">
                      {i > 0 && <div className="w-px self-stretch bg-[#252932] shrink-0 mx-2" />}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: dotBg }}>
                          <Ic className="w-3.5 h-3.5" style={{ color: iconClr }} />
                        </div>
                        <p className="text-[11px] text-[#8b92a5] font-medium leading-snug">{text}</p>
                        <p className="text-[10px] text-[#555e72] leading-snug">{sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L13.5 9.5L21 12L13.5 14.5L12 22L10.5 14.5L3 12L10.5 9.5L12 2Z"
                    fill="#3a4255" stroke="#3a4255" strokeWidth={0.5} />
                </svg>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
