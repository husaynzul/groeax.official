import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Award, Activity } from "lucide-react";

interface EquityPoint { date: string; equity: number }

interface Props {
  equityCurve: EquityPoint[];
  startingBalance: number;
  currentBalance: number;
  maxDrawdownPct: number;
  netPnL: number;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number, sign = true) =>
  `${sign && n > 0 ? "+" : ""}${n.toFixed(2)}%`;

function daysBetween(a: string, b: string): number {
  return (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000;
}

function subtractOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildChartData(
  equityCurve: EquityPoint[],
  startingBalance: number,
) {
  if (!equityCurve.length) return [];
  const firstDate = equityCurve[0].date;
  const base = startingBalance > 0 ? startingBalance : 0;

  // Prepend a "day 0" starting balance point so the curve always starts from base
  const points: EquityPoint[] = base > 0
    ? [{ date: subtractOneDay(firstDate), equity: base }, ...equityCurve]
    : equityCurve;

  const anchorDate = points[0].date;

  return points.map((pt) => {
    const days = daysBetween(anchorDate, pt.date);
    const spyBase = base > 0 ? base : points[0].equity;
    const spy  = parseFloat(((spyBase > 0 ? spyBase : 1) * Math.pow(1.10, days / 365)).toFixed(2));
    return { date: pt.date, equity: pt.equity, spy };
  });
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const eq  = payload.find((p) => p.dataKey === "equity");
  const spy = payload.find((p) => p.dataKey === "spy");
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
  return (
    <div
      style={{ background: "#111", border: "1px solid #2b2b2b", borderRadius: 10, padding: "12px 14px", minWidth: 180 }}
      className="shadow-xl text-xs space-y-1.5"
    >
      <p style={{ color: "#888", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {eq && (
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5" style={{ color: "#888" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#22c55e" }} />
            Your Account
          </span>
          <span style={{ fontWeight: 700, color: "#22c55e" }}>{fmt(eq.value)}</span>
        </div>
      )}
      {spy && (
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5" style={{ color: "#888" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#6366f1" }} />
            S&P 500 (10%/yr)
          </span>
          <span style={{ fontWeight: 700, color: "#6366f1" }}>{fmt(spy.value)}</span>
        </div>
      )}
      {eq && spy && (
        <>
          <div className="border-t border-white/10 my-1" />
          <div className="flex items-center justify-between gap-6">
            <span style={{ color: "#888" }}>Your Edge</span>
            <span
              style={{ fontWeight: 700, color: eq.value >= spy.value ? "#22c55e" : "#ef4444" }}
            >
              {eq.value >= spy.value ? "+" : ""}
              {fmt(eq.value - spy.value)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function LastDotEquity(props: { cx?: number; cy?: number; index?: number; dataLength: number }) {
  const { cx = 0, cy = 0, index = 0, dataLength } = props;
  if (index !== dataLength - 1) return null;
  return <circle cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#fff" strokeWidth={2} />;
}

export default function EquityCurveCard({
  equityCurve, startingBalance, currentBalance, maxDrawdownPct, netPnL,
}: Props) {
  const chartData = useMemo(
    () => buildChartData(equityCurve, startingBalance),
    [equityCurve, startingBalance],
  );

  const base = startingBalance > 0 ? startingBalance : equityCurve[0]?.equity ?? 0;
  const myReturnPct  = base > 0 ? ((currentBalance - base) / base) * 100 : 0;

  const lastSpy = chartData[chartData.length - 1]?.spy ?? base;
  const spyReturnPct = base > 0 ? ((lastSpy - base) / base) * 100 : 0;
  const edgePct = myReturnPct - spyReturnPct;

  const isAhead = edgePct >= 0;
  const totalDays = chartData.length > 1
    ? daysBetween(chartData[0].date, chartData[chartData.length - 1].date)
    : 0;

  const stats = [
    {
      label: "Your Return",
      value: fmtPct(myReturnPct),
      color: myReturnPct >= 0 ? "text-emerald-400" : "text-red-400",
      icon: myReturnPct >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Net P&L",
      value: `${netPnL >= 0 ? "+" : ""}${fmtMoney(netPnL)}`,
      color: netPnL >= 0 ? "text-emerald-400" : "text-red-400",
      icon: Activity,
    },
    {
      label: "S&P 500 (same period)",
      value: fmtPct(spyReturnPct),
      color: "text-indigo-400",
      icon: TrendingUp,
    },
    {
      label: "Your Edge vs S&P",
      value: fmtPct(edgePct),
      color: isAhead ? "text-emerald-400" : "text-red-400",
      icon: Award,
    },
    {
      label: "Max Drawdown",
      value: `-${maxDrawdownPct.toFixed(2)}%`,
      color: maxDrawdownPct < 10 ? "text-emerald-400" : maxDrawdownPct < 20 ? "text-yellow-400" : "text-red-400",
      icon: TrendingDown,
    },
    {
      label: "Period",
      value: totalDays < 2 ? "1 day" : totalDays < 30 ? `${Math.round(totalDays)}d` : `${Math.round(totalDays / 30)}mo`,
      color: "text-muted-foreground",
      icon: Activity,
    },
  ];

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-4 hover:border-white/15 transition-colors"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Equity Curve
          </h2>
        </div>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
          Add trades to see the equity curve
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-4 hover:border-white/15 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Equity Curve
          </h2>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-[3px] rounded-full bg-emerald-500 inline-block" />
            Your Account
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-5 h-[2px]"
              style={{ background: "repeating-linear-gradient(90deg,#6366f1 0,#6366f1 4px,transparent 4px,transparent 8px)" }}
            />
            S&P 500 (10%/yr)
          </span>
        </div>
      </div>

      {/* Sub-header: current balance */}
      <div className="mb-4">
        <span className={`text-2xl font-bold ${myReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {fmtMoney(currentBalance)}
        </span>
        <span className={`text-sm font-semibold ml-2 ${myReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {fmtPct(myReturnPct)}
        </span>
        {base > 0 && (
          <span className="text-xs text-muted-foreground ml-2">
            from {fmtMoney(base)}
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="0"
            stroke="rgba(255,255,255,0.07)"
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
            tick={{ fontSize: 9, fill: "#888" }}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`
            }
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Starting balance reference line */}
          {base > 0 && (
            <ReferenceLine
              y={base}
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: "Start", position: "insideTopRight", fontSize: 8, fill: "#666", dy: -6 }}
            />
          )}

          {/* S&P 500 benchmark — dashed indigo line */}
          <Line
            type="monotone"
            dataKey="spy"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 1.5 }}
            isAnimationActive
            animationDuration={1800}
          />

          {/* Account equity — thick green area */}
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#22c55e"
            strokeWidth={4}
            fill="url(#equityAreaGrad)"
            dot={(dotProps: { cx?: number; cy?: number; index?: number }) => (
              <LastDotEquity
                key={dotProps.index}
                cx={dotProps.cx}
                cy={dotProps.cy}
                index={dotProps.index}
                dataLength={chartData.length}
              />
            )}
            activeDot={{ r: 8, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={2200}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stats.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="text-center space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
