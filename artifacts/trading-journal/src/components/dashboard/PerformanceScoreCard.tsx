import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Zap, TrendingUp, Target, Shield, BarChart2,
  CheckCircle, AlertTriangle, Focus, ChevronRight, Star,
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

const fmt2 = (n: number) => n.toFixed(2);

/* ─── Metric Card ──────────────────────────────────────────────────────── */
function MetricChip({
  icon: Icon,
  label,
  value,
  rating,
  ratingColor,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  rating: string;
  ratingColor: string;
  sub: string;
}) {
  return (
    <div className="glass-card p-3.5 flex flex-col gap-1.5 hover:border-white/15 transition-all cursor-pointer active:scale-[0.98]">
      {/* Top row: neutral icon + chevron */}
      <div className="flex items-start justify-between mb-1">
        <div className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 mt-0.5 shrink-0" />
      </div>

      {/* Label */}
      <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>

      {/* Value — white, large */}
      <p className="text-[1.65rem] font-bold text-foreground leading-tight tracking-tight">{value}</p>

      {/* Rating — colored */}
      <p className={`text-[12px] font-semibold leading-tight ${ratingColor}`}>{rating}</p>

      {/* Hint */}
      <p className="text-[10px] text-muted-foreground/50 leading-tight mt-0.5">{sub}</p>
    </div>
  );
}

/* ─── Chart tooltip ─────────────────────────────────────────────────────── */
function CumulReturnTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div style={{ background: "#111", border: "1px solid #2b2b2b", borderRadius: 8, padding: "10px 12px" }} className="shadow-xl text-xs">
      <p style={{ color: "#888", marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 700, color: v >= 0 ? "#22c55e" : "#ef4444" }}>
        {v >= 0 ? "+" : ""}{fmt2(v)}%
      </p>
    </div>
  );
}

/* ─── Last-only dot ────────────────────────────────────────────────────── */
function LastDot(props: {
  cx?: number; cy?: number; index?: number; dataLength: number; lineColor: string;
}) {
  const { cx = 0, cy = 0, index = 0, dataLength, lineColor } = props;
  if (index !== dataLength - 1) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={9} fill={lineColor} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill={lineColor} stroke="#0e0f11" strokeWidth={2} />
    </>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function PerformanceScoreCard({
  analytics,
  trades,
  startingBalance,
  currentBalance,
}: Props) {
  const [, setLocation] = useLocation();
  const {
    totalTrades, totalProfit, totalLoss, winRate,
    equityCurve, drawdownStats,
  } = analytics;

  const pf      = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 4 : 0;
  const maxDD   = drawdownStats.drawdownPercent;

  const avgRR = useMemo(() => {
    const valid = trades.filter((t) => (t.rr ?? 0) > 0);
    return valid.length > 0 ? valid.reduce((s, t) => s + (t.rr ?? 0), 0) / valid.length : 0;
  }, [trades]);

  const netPnLPct = useMemo(() => {
    if (startingBalance > 0) return ((currentBalance - startingBalance) / startingBalance) * 100;
    if (equityCurve.length > 0) {
      const first = equityCurve[0].equity;
      const last  = equityCurve[equityCurve.length - 1].equity;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    return 0;
  }, [startingBalance, currentBalance, equityCurve]);

  const avgReturnPct = totalTrades > 0 ? netPnLPct / totalTrades : 0;

  const consistency = useMemo(() => {
    const wrScore   = winRate / 100;
    const riskScore = avgRR >= 2 ? 1 : avgRR >= 1 ? 0.75 : avgRR >= 0.5 ? 0.4 : 0.15;
    const freqScore = totalTrades >= 20 ? 1 : totalTrades >= 10 ? 0.75 : totalTrades >= 5 ? 0.5 : 0.25;
    return Math.round((wrScore * 0.40 + riskScore * 0.30 + freqScore * 0.30) * 100);
  }, [winRate, avgRR, totalTrades]);

  const cumulData = useMemo(() => {
    const base = startingBalance > 0 ? startingBalance : equityCurve[0]?.equity ?? 1;
    return equityCurve.map((pt) => ({
      date:   pt.date,
      return: base > 0 ? +((pt.equity - base) / base * 100).toFixed(3) : 0,
    }));
  }, [equityCurve, startingBalance]);

  const isPositive = netPnLPct >= 0;
  const netDollar  = analytics.netBalance;

  /* ratings */
  const pfRating  = pf  >= 2   ? { t: "Excellent",    c: "text-emerald-400" }
                  : pf  >= 1.5 ? { t: "Good",          c: "text-emerald-400" }
                  : pf  >= 1.2 ? { t: "Average",       c: "text-yellow-400"  }
                  : pf  >= 1   ? { t: "Below Average", c: "text-orange-400"  }
                  :              { t: "Poor",           c: "text-red-400"     };
  const rrRating  = avgRR >= 2   ? { t: "Above Target", c: "text-emerald-400" }
                  : avgRR >= 1.5 ? { t: "On Target",    c: "text-yellow-400"  }
                  : avgRR >= 1   ? { t: "Near Target",  c: "text-orange-400"  }
                  :                { t: "Below Target", c: "text-red-400"     };
  const conRating = consistency >= 80 ? { t: "Excellent", c: "text-emerald-400" }
                  : consistency >= 65 ? { t: "Good",      c: "text-emerald-400" }
                  : consistency >= 45 ? { t: "Average",   c: "text-yellow-400"  }
                  :                     { t: "Weak",      c: "text-red-400"     };
  const retRating = avgReturnPct >= 1   ? { t: "Excellent", c: "text-emerald-400" }
                  : avgReturnPct >= 0.3 ? { t: "Good",      c: "text-emerald-400" }
                  : avgReturnPct >= 0   ? { t: "Average",   c: "text-yellow-400"  }
                  :                       { t: "Losing",    c: "text-red-400"     };

  /* insights */
  const insights = useMemo(() => {
    const list: {
      icon: React.ElementType;
      type: "good" | "warn" | "info";
      text: string;
      sub: string;
    }[] = [];

    if (pf >= 1.5)
      list.push({ icon: CheckCircle, type: "good", text: "Profitability is above average", sub: "Keep maintaining your edge" });
    else if (pf < 1)
      list.push({ icon: AlertTriangle, type: "warn", text: "Work on your profit factor", sub: "Focus on win rate & losses" });

    if (maxDD > 20)
      list.push({ icon: AlertTriangle, type: "warn", text: "Reduce your drawdowns", sub: "Review position sizing & stops" });
    else if (maxDD <= 10 && totalTrades > 0)
      list.push({ icon: CheckCircle, type: "good", text: "Drawdown is well controlled", sub: "Risk management is effective" });

    if (avgRR >= 2)
      list.push({ icon: Focus, type: "info", text: "Focus on high R:R setups", sub: "Good setups — filter for quality" });
    else if (avgRR < 1.5 && totalTrades > 0)
      list.push({ icon: AlertTriangle, type: "warn", text: "Improve your R:R to 1.5+", sub: "Take trades with 1.5:1 reward" });

    if (winRate >= 60)
      list.push({ icon: CheckCircle, type: "good", text: "Win rate is strong", sub: "Stay patient, avoid revenge trades" });

    return list.slice(0, 3);
  }, [pf, maxDD, avgRR, winRate, totalTrades]);

  return (
    <div className="glass-card p-4 w-full space-y-4">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Trading Performance
          </h2>
        </div>
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">All Time</span>
      </div>

      {totalTrades === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <>
          {/* ── Net P&L ── */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
              Net P&L {startingBalance > 0 ? "%" : ""}
              <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 inline-flex items-center justify-center text-[8px] text-muted-foreground/50 font-bold cursor-help">i</span>
            </p>
            <p className={`text-[2.35rem] font-extrabold leading-tight tracking-tight ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}
              {startingBalance > 0 ? `${fmt2(netPnLPct)}%` : `$${Math.abs(netDollar).toFixed(2)}`}
            </p>
            {startingBalance > 0 && (
              <p className={`text-[13px] font-semibold mt-0.5 ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {netDollar >= 0 ? "+" : ""}${Math.abs(netDollar).toFixed(2)}
              </p>
            )}
          </div>

          {/* ── Cumulative Return chart ── */}
          {cumulData.length > 1 && (() => {
            const lineColor = isPositive ? "#22c55e" : "#ef4444";
            const vals = cumulData.map((d) => d.return);
            const rawMin = Math.min(...vals);
            const rawMax = Math.max(...vals);
            const yMin = Math.floor((Math.min(rawMin, 0) - 2) / 5) * 5;
            const yMax = Math.ceil((Math.max(rawMax, 0) + 2) / 5) * 5;
            return (
              <div className="glass-card p-3 pt-3.5">
                <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: lineColor }} />
                  Cumulative Return (%)
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={cumulData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#555e72" }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v + "T12:00:00");
                        return isNaN(d.getTime()) ? v : `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
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
                      fill="url(#cumulGrad)"
                      dot={(dotProps: { cx?: number; cy?: number; index?: number }) => (
                        <LastDot
                          key={dotProps.index}
                          cx={dotProps.cx} cy={dotProps.cy} index={dotProps.index}
                          dataLength={cumulData.length}
                          lineColor={lineColor}
                        />
                      )}
                      activeDot={{ r: 7, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive animationDuration={2000} animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* ── 2×2 Metric Cards ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <MetricChip
              icon={BarChart2}
              label="Profit Factor"
              value={pf >= 4 ? "4.00+" : fmt2(pf)}
              rating={pfRating.t}
              ratingColor={pfRating.c}
              sub="> 1.5 is considered good"
            />
            <MetricChip
              icon={Target}
              label="Average R:R"
              value={`${fmt2(avgRR)}R`}
              rating={rrRating.t}
              ratingColor={rrRating.c}
              sub="Target: 2.00R+"
            />
            <MetricChip
              icon={Shield}
              label="Consistency"
              value={`${consistency}%`}
              rating={conRating.t}
              ratingColor={conRating.c}
              sub="Based on risk, returns & discipline"
            />
            <MetricChip
              icon={TrendingUp}
              label="Avg Return"
              value={`${avgReturnPct >= 0 ? "+" : ""}${fmt2(avgReturnPct)}%`}
              rating={retRating.t}
              ratingColor={retRating.c}
              sub="Avg profit per completed trade"
            />
          </div>

          {/* ── Performance Insights card ── */}
          {insights.length > 0 && (
            <div className="glass-card p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-tight">Performance Insights</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Key insights to help you improve</p>
                  </div>
                </div>
                <button
                  onClick={() => setLocation("/analytics")}
                  className="flex items-center gap-1 bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
                >
                  View Details
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>

              {/* 3-column insight grid with dividers */}
              <div className="flex items-start gap-3">
                {insights.map((ins, i) => {
                  const { icon: Ic, type, text, sub } = ins;
                  const dotBg   = type === "good" ? "bg-emerald-500/15" : type === "warn" ? "bg-orange-500/15" : "bg-blue-500/15";
                  const iconClr = type === "good" ? "text-emerald-400"  : type === "warn" ? "text-orange-400"  : "text-blue-400";
                  return (
                    <div key={i} className="flex items-start gap-3 flex-1 min-w-0">
                      {/* vertical divider between items */}
                      {i > 0 && <div className="w-px bg-border self-stretch shrink-0" />}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className={`w-7 h-7 rounded-full ${dotBg} flex items-center justify-center shrink-0`}>
                          <Ic className={`w-3.5 h-3.5 ${iconClr}`} />
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{text}</p>
                        <p className="text-[10px] text-muted-foreground/50 leading-tight">{sub}</p>
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
