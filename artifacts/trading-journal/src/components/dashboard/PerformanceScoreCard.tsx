import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Zap, TrendingUp, TrendingDown, Target, Shield, BarChart2,
  CheckCircle, AlertTriangle, Focus,
} from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";
import { Trade } from "@/types";

interface Props {
  analytics: Analytics;
  trades: Trade[];
  startingBalance: number;
  currentBalance: number;
}

const fmt2 = (n: number) => n.toFixed(2);

function MetricChip({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  rating,
  ratingColor,
  sub,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  rating: string;
  ratingColor: string;
  sub: string;
}) {
  return (
    <div className="glass-card p-3 flex flex-col gap-2 hover:border-white/15 transition-colors cursor-pointer active:scale-[0.98]">
      {/* Row: icon + text + chevron */}
      <div className="flex items-start gap-2.5">
        {/* Colored icon square */}
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {label}
          </p>
          <p className={`text-lg font-bold leading-tight ${ratingColor}`}>{value}</p>
          <p className={`text-[11px] font-semibold mt-0.5 ${ratingColor}`}>{rating}</p>
        </div>

        {/* Chevron */}
        <span className="text-muted-foreground/30 text-base font-bold mt-0.5 shrink-0">›</span>
      </div>

      {/* Sub-text */}
      <p className="text-[9px] text-muted-foreground/55 leading-tight line-clamp-1">{sub}</p>
    </div>
  );
}

function CumulReturnTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div style={{ background: "#111", border: "1px solid #2b2b2b", borderRadius: 8, padding: "12px 14px" }} className="shadow-xl text-xs">
      <p style={{ color: "#888", marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 700, color: v >= 0 ? "#22c55e" : "#ef4444" }}>
        {v >= 0 ? "+" : ""}{fmt2(v)}%
      </p>
    </div>
  );
}

function LastDot(props: {
  cx?: number; cy?: number; index?: number; dataLength: number;
  lineColor: string;
}) {
  const { cx = 0, cy = 0, index = 0, dataLength, lineColor } = props;
  if (index !== dataLength - 1) return null;
  return (
    <circle
      cx={cx} cy={cy} r={6}
      fill={lineColor} stroke="#ffffff" strokeWidth={2}
    />
  );
}

export default function PerformanceScoreCard({
  analytics,
  trades,
  startingBalance,
  currentBalance,
}: Props) {
  const {
    totalTrades, totalProfit, totalLoss, winRate,
    equityCurve, drawdownStats, avgWin, avgLoss,
  } = analytics;

  const pf = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 4 : 0;
  const maxDD = drawdownStats.drawdownPercent;

  const avgRR = useMemo(() => {
    const valid = trades.filter((t) => (t.rr ?? 0) > 0);
    return valid.length > 0 ? valid.reduce((s, t) => s + (t.rr ?? 0), 0) / valid.length : 0;
  }, [trades]);

  const netPnLPct = useMemo(() => {
    if (startingBalance > 0) return ((currentBalance - startingBalance) / startingBalance) * 100;
    if (equityCurve.length > 0) {
      const first = equityCurve[0].equity;
      const last = equityCurve[equityCurve.length - 1].equity;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    return 0;
  }, [startingBalance, currentBalance, equityCurve]);

  const avgReturnPct = totalTrades > 0 ? netPnLPct / totalTrades : 0;

  const consistency = useMemo(() => {
    const wrScore = winRate / 100;
    const riskScore = avgRR >= 2 ? 1 : avgRR >= 1 ? 0.75 : avgRR >= 0.5 ? 0.4 : 0.15;
    const freqScore = totalTrades >= 20 ? 1 : totalTrades >= 10 ? 0.75 : totalTrades >= 5 ? 0.5 : 0.25;
    return Math.round((wrScore * 0.40 + riskScore * 0.30 + freqScore * 0.30) * 100);
  }, [winRate, avgRR, totalTrades]);

  const cumulData = useMemo(() => {
    const base = startingBalance > 0 ? startingBalance : equityCurve[0]?.equity ?? 1;
    return equityCurve.map((pt) => ({
      date: pt.date,
      return: base > 0 ? +((pt.equity - base) / base * 100).toFixed(3) : 0,
    }));
  }, [equityCurve, startingBalance]);

  const isPositive = netPnLPct >= 0;

  const pfRating  = pf >= 2 ? { t: "Excellent", c: "text-emerald-400" } : pf >= 1.5 ? { t: "Good", c: "text-emerald-400" } : pf >= 1.2 ? { t: "Average", c: "text-yellow-400" } : pf >= 1 ? { t: "Below Avg", c: "text-orange-400" } : { t: "Poor", c: "text-red-400" };
  const rrRating  = avgRR >= 2 ? { t: "Above Target", c: "text-emerald-400" } : avgRR >= 1.5 ? { t: "On Target", c: "text-yellow-400" } : avgRR >= 1 ? { t: "Near Target", c: "text-orange-400" } : { t: "Below Target", c: "text-red-400" };
  const conRating = consistency >= 80 ? { t: "Excellent", c: "text-emerald-400" } : consistency >= 65 ? { t: "Good", c: "text-emerald-400" } : consistency >= 45 ? { t: "Average", c: "text-yellow-400" } : { t: "Weak", c: "text-red-400" };
  const retRating = avgReturnPct >= 1 ? { t: "Excellent", c: "text-emerald-400" } : avgReturnPct >= 0.3 ? { t: "Good", c: "text-emerald-400" } : avgReturnPct >= 0 ? { t: "Average", c: "text-yellow-400" } : { t: "Losing", c: "text-red-400" };

  const insights = useMemo(() => {
    const list: { icon: React.ElementType; text: string; type: "good" | "warn" | "info" }[] = [];
    if (pf >= 1.5) list.push({ icon: CheckCircle, text: "Your profitability is above average", type: "good" });
    else if (pf < 1) list.push({ icon: AlertTriangle, text: "Work on increasing your profit factor", type: "warn" });
    if (maxDD > 20) list.push({ icon: AlertTriangle, text: "Work on reducing drawdowns", type: "warn" });
    else if (maxDD <= 10 && totalTrades > 0) list.push({ icon: CheckCircle, text: "Drawdown is well controlled", type: "good" });
    if (avgRR >= 2) list.push({ icon: Focus, text: "Focus on high R:R setups", type: "info" });
    else if (avgRR < 1.5 && totalTrades > 0) list.push({ icon: AlertTriangle, text: "Improve your R:R to at least 1.5", type: "warn" });
    if (winRate >= 60) list.push({ icon: CheckCircle, text: "Win rate is strong — maintain discipline", type: "good" });
    return list.slice(0, 3);
  }, [pf, maxDD, avgRR, winRate, totalTrades]);

  return (
    <div className="glass-card p-4 w-full space-y-4">
      {/* Header */}
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
          {/* Net P&L % */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Net P&L {startingBalance > 0 ? "%" : ""}
            </p>
            <p className={`text-3xl sm:text-4xl font-bold leading-tight ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{startingBalance > 0 ? `${fmt2(netPnLPct)}%` : `$${Math.abs(analytics.netBalance).toFixed(2)}`}
            </p>
          </div>

          {/* Cumulative Return chart */}
          {cumulData.length > 1 && (() => {
            const lineColor = isPositive ? "#22c55e" : "#ef4444";
            const vals = cumulData.map((d) => d.return);
            const rawMin = Math.min(...vals);
            const rawMax = Math.max(...vals);
            const yMin = Math.floor((Math.min(rawMin, 0) - 2) / 5) * 5;
            const yMax = Math.ceil((Math.max(rawMax, 0) + 2) / 5) * 5;
            return (
              <div>
                <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: lineColor }} />
                  Cumulative Return (%)
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={cumulData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="0"
                      stroke="rgba(255,255,255,0.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#888" }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v + "T12:00:00");
                        return isNaN(d.getTime()) ? v : `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
                      }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tickCount={Math.round((yMax - yMin) / 5) + 1}
                      tick={{ fontSize: 9, fill: "#888" }}
                      tickFormatter={(v: number) => `${v}%`}
                      axisLine={false}
                      tickLine={false}
                      width={38}
                    />
                    <Tooltip content={<CumulReturnTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="return"
                      stroke={lineColor}
                      strokeWidth={4}
                      fill="url(#cumulGrad)"
                      dot={(dotProps: { cx?: number; cy?: number; index?: number }) => (
                        <LastDot
                          key={dotProps.index}
                          cx={dotProps.cx}
                          cy={dotProps.cy}
                          index={dotProps.index}
                          dataLength={cumulData.length}
                          lineColor={lineColor}
                        />
                      )}
                      activeDot={{ r: 8, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive
                      animationDuration={2200}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* 2×2 metric chips */}
          <div className="grid grid-cols-2 gap-2">
            <MetricChip
              icon={BarChart2}
              iconBg="linear-gradient(135deg,#7c3aed,#9f67fa)"
              iconColor="#ffffff"
              label="Profit Factor"
              value={pf >= 4 ? "4.00+" : fmt2(pf)}
              rating={pfRating.t}
              ratingColor={pfRating.c}
              sub="> 1.5 is considered good"
            />
            <MetricChip
              icon={Target}
              iconBg="linear-gradient(135deg,#334155,#475569)"
              iconColor="#e2e8f0"
              label="Average R:R"
              value={`${fmt2(avgRR)}R`}
              rating={rrRating.t}
              ratingColor={rrRating.c}
              sub="Target: 2.00R+"
            />
            <MetricChip
              icon={Shield}
              iconBg="linear-gradient(135deg,#b91c1c,#ef4444)"
              iconColor="#ffffff"
              label="Consistency"
              value={`${consistency}%`}
              rating={conRating.t}
              ratingColor={conRating.c}
              sub="Based on risk, returns & discipline"
            />
            <MetricChip
              icon={TrendingUp}
              iconBg="linear-gradient(135deg,#1e3a4c,#2d5066)"
              iconColor="#94a3b8"
              label="Avg Return"
              value={`${avgReturnPct >= 0 ? "+" : ""}${fmt2(avgReturnPct)}%`}
              rating={retRating.t}
              ratingColor={retRating.c}
              sub="Avg profit per completed trade"
            />
          </div>

          {/* Performance Insights */}
          {insights.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Performance Insights
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground/40">Key insights to help you improve</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {insights.map((ins, i) => {
                  const { icon: Ic, text, type } = ins;
                  const style =
                    type === "good"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : type === "warn"
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  return (
                    <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium ${style}`}>
                      <Ic className="w-3 h-3 shrink-0" />
                      {text}
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
