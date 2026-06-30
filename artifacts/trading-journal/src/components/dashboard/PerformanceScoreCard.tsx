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

const fmt2 = (n: number) => n.toFixed(2);

/* ── Filter trades by period ─────────────────────────────────────────── */
function filterTrades(trades: Trade[], period: Period): Trade[] {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "Daily") {
    return trades.filter((t) => {
      const d = new Date(t.date + "T12:00:00");
      return d >= today;
    });
  }
  if (period === "Weekly") {
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    return trades.filter((t) => new Date(t.date + "T12:00:00") >= monday);
  }
  if (period === "Monthly") {
    const som = new Date(now.getFullYear(), now.getMonth(), 1);
    return trades.filter((t) => new Date(t.date + "T12:00:00") >= som);
  }
  return trades;
}

const PERIOD_LABEL: Record<Period, string> = {
  Daily:   "Today",
  Weekly:  "This Week",
  Monthly: "This Month",
};

/* ── Chart tooltip ───────────────────────────────────────────────────── */
function CumulReturnTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div style={{ background: "#171a1f", border: "1px solid #252932", borderRadius: 8, padding: "10px 12px" }} className="shadow-xl text-xs">
      <p style={{ color: "#555e72", marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 700, color: v >= 0 ? "#3ddc84" : "#ef4444" }}>
        {v >= 0 ? "+" : ""}{fmt2(v)}%
      </p>
    </div>
  );
}

/* ── Last dot only ───────────────────────────────────────────────────── */
function LastDot(props: {
  cx?: number; cy?: number; index?: number; dataLength: number; color: string;
}) {
  const { cx = 0, cy = 0, index = 0, dataLength, color } = props;
  if (index !== dataLength - 1) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={9}  fill={color} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={5}  fill={color} stroke="#0e0f11" strokeWidth={2} />
    </>
  );
}

/* ── Metric card ─────────────────────────────────────────────────────── */
function MetricCard({
  icon: Icon, label, value, rating, ratingColor, hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  rating: string;
  ratingColor: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#252932] bg-[#171a1f] p-4 cursor-pointer transition-colors hover:border-[#333a48] active:scale-[0.98]">
      {/* icon + chevron */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px] text-[#8b92a5]" />
        </div>
        <span className="text-[#555e72] text-lg mt-0.5">›</span>
      </div>
      {/* label */}
      <p className="text-[11px] text-[#8b92a5] font-medium mb-1.5 flex items-center gap-1">
        {label}
        <span className="w-3 h-3 rounded-full border border-[#555e72] inline-flex items-center justify-center text-[7px] text-[#555e72]">i</span>
      </p>
      {/* value */}
      <p className="text-[1.75rem] font-bold text-[#f0f2f5] tracking-[-0.03em] leading-tight">{value}</p>
      {/* status */}
      <p className={`text-[12px] font-semibold mt-0.5 ${ratingColor}`}>{rating}</p>
      {/* hint */}
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

  /* filter trades & recompute */
  const filteredTrades = useMemo(() => filterTrades(trades, period), [trades, period]);
  const a = useMemo(
    () => computeAnalytics(filteredTrades, startingBalance),
    [filteredTrades, startingBalance],
  );

  /* derived metrics */
  const pf = a.totalLoss > 0 ? a.totalProfit / a.totalLoss : a.totalProfit > 0 ? 4 : 0;
  const maxDD = a.drawdownStats.drawdownPercent;

  const avgRR = useMemo(() => {
    const valid = filteredTrades.filter((t) => (t.rr ?? 0) > 0);
    return valid.length > 0
      ? valid.reduce((s, t) => s + (t.rr ?? 0), 0) / valid.length
      : 0;
  }, [filteredTrades]);

  const netPnLPct = useMemo(() => {
    if (startingBalance > 0)
      return ((startingBalance + a.netBalance - startingBalance) / startingBalance) * 100;
    if (a.equityCurve.length > 0) {
      const first = a.equityCurve[0].equity;
      const last  = a.equityCurve[a.equityCurve.length - 1].equity;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    return 0;
  }, [a, startingBalance]);

  const avgReturnPct = a.totalTrades > 0 ? netPnLPct / a.totalTrades : 0;

  const consistency = useMemo(() => {
    const wrScore   = a.winRate / 100;
    const riskScore = avgRR >= 2 ? 1 : avgRR >= 1 ? 0.75 : avgRR >= 0.5 ? 0.4 : 0.15;
    const freqScore = a.totalTrades >= 20 ? 1 : a.totalTrades >= 10 ? 0.75
                    : a.totalTrades >= 5  ? 0.5 : 0.25;
    return Math.round((wrScore * 0.40 + riskScore * 0.30 + freqScore * 0.30) * 100);
  }, [a.winRate, avgRR, a.totalTrades]);

  const cumulData = useMemo(() => {
    const base = startingBalance > 0 ? startingBalance : a.equityCurve[0]?.equity ?? 1;
    return a.equityCurve.map((pt) => ({
      date:   pt.date,
      return: base > 0 ? +((pt.equity - base) / base * 100).toFixed(3) : 0,
    }));
  }, [a.equityCurve, startingBalance]);

  const isPos = netPnLPct >= 0;
  const lineColor = isPos ? "#2ecc71" : "#ef4444";

  /* ratings */
  const pfRating = pf >= 2   ? { t: "Excellent",    c: "text-[#3ddc84]" }
                 : pf >= 1.5 ? { t: "Good",          c: "text-[#3ddc84]" }
                 : pf >= 1.2 ? { t: "Average",       c: "text-[#f59e0b]" }
                 : pf >= 1   ? { t: "Below Average", c: "text-[#f59e0b]" }
                 :             { t: "Poor",           c: "text-red-400"   };
  const rrRating = avgRR >= 2   ? { t: "Above Target", c: "text-[#3ddc84]" }
                 : avgRR >= 1.5 ? { t: "On Target",    c: "text-[#3ddc84]" }
                 : avgRR >= 1   ? { t: "Near Target",  c: "text-[#f59e0b]" }
                 :               { t: "Below Target",  c: "text-red-400"   };
  const conRating = consistency >= 80 ? { t: "Excellent", c: "text-[#3ddc84]" }
                  : consistency >= 65 ? { t: "Good",      c: "text-[#3ddc84]" }
                  : consistency >= 45 ? { t: "Average",   c: "text-[#f59e0b]" }
                  :                    { t: "Weak",       c: "text-red-400"   };
  const retRating = avgReturnPct >= 1   ? { t: "Excellent", c: "text-[#3ddc84]" }
                  : avgReturnPct >= 0.3 ? { t: "Good",      c: "text-[#3ddc84]" }
                  : avgReturnPct >= 0   ? { t: "Average",   c: "text-[#f59e0b]" }
                  :                      { t: "Losing",     c: "text-red-400"   };

  /* insights */
  const insights = useMemo(() => {
    const list: {
      icon: React.ElementType;
      type: "good" | "warn" | "info";
      text: string;
      sub: string;
    }[] = [];
    if (pf >= 1.5)
      list.push({ icon: CheckCircle,  type: "good", text: "Profitability above average",  sub: "Keep maintaining your edge." });
    else if (pf < 1)
      list.push({ icon: AlertTriangle, type: "warn", text: "Work on your profit factor",   sub: "Focus on reducing losses." });

    if (maxDD > 20)
      list.push({ icon: AlertTriangle, type: "warn", text: "Work on reducing drawdowns",   sub: "Big losses impact your curve." });
    else if (maxDD <= 10 && a.totalTrades > 0)
      list.push({ icon: CheckCircle,  type: "good", text: "Drawdown well controlled",      sub: "Risk management is solid." });

    if (avgRR >= 2)
      list.push({ icon: Focus,         type: "info", text: "Focus on high R:R setups",     sub: "You perform best above 2R." });
    else if (avgRR < 1.5 && a.totalTrades > 0)
      list.push({ icon: AlertTriangle, type: "warn", text: "Improve R:R to at least 1.5",  sub: "Aim for 1.5:1 reward ratio." });

    if (a.winRate >= 60)
      list.push({ icon: CheckCircle,  type: "good", text: "Win rate is strong",            sub: "Stay patient, avoid revenge." });

    return list.slice(0, 3);
  }, [pf, maxDD, avgRR, a.winRate, a.totalTrades]);

  /* ── render ── */
  return (
    <div className="rounded-2xl border border-[#252932] bg-[#0e0f11] p-4 w-full">

      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] rounded-xl bg-[#1c1f26] border border-[#252932] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-[#8b92a5]" />
          </div>
          <div>
            <p className="text-[17px] font-bold tracking-[-0.3px] text-[#f0f2f5] leading-tight">
              Trading Performance
            </p>
            <p className="text-[11px] text-[#555e72] mt-0.5">
              Track your performance and improve every day.
            </p>
          </div>
        </div>
      </div>

      {allAnalytics.totalTrades === 0 ? (
        <div className="py-12 text-center text-[#555e72] text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <>
          {/* ── P&L + Tab Toggle (overlapping layout) ── */}
          <div className="relative mb-4">
            {/* P&L */}
            <p className="text-[12px] text-[#8b92a5] font-medium mb-1 flex items-center gap-1.5">
              Net P&L ({PERIOD_LABEL[period]})
              <span className="w-3.5 h-3.5 rounded-full border border-[#555e72] inline-flex items-center justify-center text-[8px] text-[#555e72]">i</span>
            </p>
            <p className={`text-[2.4rem] font-extrabold leading-tight tracking-[-0.05em] ${isPos ? "text-[#3ddc84]" : "text-red-400"}`}>
              {isPos ? "+" : ""}
              {startingBalance > 0 ? `${fmt2(netPnLPct)}%` : `$${Math.abs(a.netBalance).toFixed(2)}`}
            </p>
            {a.totalTrades > 0 && (
              <p className={`text-[14px] font-semibold mt-0.5 ${isPos ? "text-[#3ddc84]" : "text-red-400"}`}>
                {a.netBalance >= 0 ? "+" : ""}${Math.abs(a.netBalance).toFixed(2)}
              </p>
            )}

            {/* Tab toggle — absolutely positioned top-right, overlaps P&L */}
            <div className="absolute top-0 right-0 flex items-center bg-[#1c1f26] border border-[#252932] rounded-xl p-[3px] gap-0.5">
              {(["Daily", "Weekly", "Monthly"] as Period[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPeriod(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                    period === tab
                      ? "bg-[#2ecc71] text-black font-semibold"
                      : "text-[#8b92a5] hover:text-[#f0f2f5]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ── Chart card ── */}
          {cumulData.length > 1 && (() => {
            const vals   = cumulData.map((d) => d.return);
            const rawMin = Math.min(...vals);
            const rawMax = Math.max(...vals);
            const yMin   = Math.floor((Math.min(rawMin, 0) - 2) / 5) * 5;
            const yMax   = Math.ceil((Math.max(rawMax, 0) + 2) / 5) * 5;
            return (
              <div className="rounded-2xl border border-[#252932] bg-[#171a1f] px-3 pt-4 pb-2 mb-3">
                {/* legend */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#8b92a5] mb-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: lineColor }} />
                  Cumulative Return (%)
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={cumulData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="0"
                      stroke="#252932"
                      strokeWidth={0.5}
                      vertical={false}
                    />
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
                      tickCount={Math.round((yMax - yMin) / 5) + 1}
                      tick={{ fontSize: 9, fill: "#555e72" }}
                      tickFormatter={(v: number) => `${v}%`}
                      axisLine={false} tickLine={false}
                      width={36}
                    />
                    <Tooltip content={<CumulReturnTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="return"
                      stroke={lineColor}
                      strokeWidth={1.8}
                      fill="url(#perfGrad)"
                      dot={(dotProps: { cx?: number; cy?: number; index?: number }) => (
                        <LastDot
                          key={dotProps.index}
                          cx={dotProps.cx} cy={dotProps.cy} index={dotProps.index}
                          dataLength={cumulData.length}
                          color={lineColor}
                        />
                      )}
                      activeDot={{ r: 7, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive animationDuration={1600} animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* ── 2×2 Metric Cards ── */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <MetricCard
              icon={BarChart2}
              label="Profit Factor"
              value={pf >= 4 ? "4.00+" : fmt2(pf)}
              rating={pfRating.t}
              ratingColor={pfRating.c}
              hint="> 1.5 is considered good"
            />
            <MetricCard
              icon={Target}
              label="Average R:R"
              value={`${fmt2(avgRR)}R`}
              rating={rrRating.t}
              ratingColor={rrRating.c}
              hint="Target: 2.00R+"
            />
            <MetricCard
              icon={Shield}
              label="Consistency"
              value={`${consistency}%`}
              rating={conRating.t}
              ratingColor={conRating.c}
              hint="Based on risk, returns & discipline"
            />
            <MetricCard
              icon={TrendingUp}
              label="Average Return"
              value={`${avgReturnPct >= 0 ? "+" : ""}${fmt2(avgReturnPct)}%`}
              rating={retRating.t}
              ratingColor={retRating.c}
              hint="Average profit per completed trade"
            />
          </div>

          {/* ── Insights card ── */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-[#252932] bg-[#171a1f] p-4">
              {/* header */}
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

              {/* 3-column grid with dividers */}
              <div className="flex items-start">
                {insights.map((ins, i) => {
                  const { icon: Ic, type, text, sub } = ins;
                  const dotBg   = type === "good" ? "rgba(46,204,113,0.15)"
                                : type === "warn" ? "rgba(245,158,11,0.15)"
                                :                   "rgba(96,165,250,0.15)";
                  const iconClr = type === "good" ? "#2ecc71"
                                : type === "warn" ? "#f59e0b"
                                :                   "#60a5fa";
                  return (
                    <div key={i} className="flex items-start flex-1 min-w-0">
                      {i > 0 && (
                        <div className="w-px self-stretch bg-[#252932] shrink-0 mx-2" />
                      )}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: dotBg }}
                        >
                          <Ic className="w-3.5 h-3.5" style={{ color: iconClr }} />
                        </div>
                        <p className="text-[11px] text-[#8b92a5] font-medium leading-snug">{text}</p>
                        <p className="text-[10px] text-[#555e72] leading-snug">{sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* sparkle */}
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
