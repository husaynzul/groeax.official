import { useMemo } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  ReferenceLine,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Activity, Crosshair, TrendingDown, Info } from "lucide-react";
import { format } from "date-fns";

const FADE_UP = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.35 },
  }),
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm font-semibold ${color ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

const DrawdownTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { date: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">
        {format(new Date(payload[0].payload.date + "T12:00:00"), "MMM d, yyyy")}
      </p>
      <p className="text-red-400 font-semibold">
        -{fmtMoney(payload[0].value)}
      </p>
    </div>
  );
};

const ScatterTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { rr: number; profit: number; pair: string; outcome: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-foreground">{d.pair}</p>
      <p className="text-muted-foreground">R:R — {d.rr.toFixed(2)}</p>
      <p
        className={
          d.profit >= 0 ? "text-emerald-400" : "text-red-400"
        }
      >
        {d.profit >= 0 ? "+" : ""}
        {fmtMoney(d.profit)}
      </p>
      <p
        className={`text-[10px] font-medium ${
          d.outcome === "WIN"
            ? "text-emerald-400"
            : d.outcome === "LOSS"
            ? "text-red-400"
            : "text-muted-foreground"
        }`}
      >
        {d.outcome}
      </p>
    </div>
  );
};

export default function Analytics() {
  const trades = useTradeStore((s) => s.trades);
  const analytics = useMemo(() => computeAnalytics(trades), [trades]);

  const maxDrawdown = useMemo(
    () =>
      analytics.drawdownCurve.length > 0
        ? Math.max(...analytics.drawdownCurve.map((d) => d.drawdown))
        : 0,
    [analytics.drawdownCurve]
  );

  const avgRR = useMemo(
    () =>
      trades.length > 0
        ? trades.reduce((s, t) => s + t.rr, 0) / trades.length
        : 0,
    [trades]
  );

  const profitFactor = useMemo(
    () =>
      analytics.totalLoss > 0
        ? analytics.totalProfit / analytics.totalLoss
        : analytics.totalProfit > 0
        ? Infinity
        : 0,
    [analytics]
  );

  const scatterWithOutcome = useMemo(
    () =>
      trades.map((t) => ({
        rr: t.rr,
        profit:
          t.outcome === "WIN"
            ? t.netProfit
            : t.outcome === "LOSS"
            ? -t.netLoss
            : 0,
        pair: t.pair,
        outcome: t.outcome ?? "BE",
      })),
    [trades]
  );

  const rrBuckets = useMemo(() => {
    const buckets: Record<string, { wins: number; losses: number; total: number }> = {
      "0–1R": { wins: 0, losses: 0, total: 0 },
      "1–2R": { wins: 0, losses: 0, total: 0 },
      "2–3R": { wins: 0, losses: 0, total: 0 },
      "3R+": { wins: 0, losses: 0, total: 0 },
    };
    trades.forEach((t) => {
      const key =
        t.rr < 1
          ? "0–1R"
          : t.rr < 2
          ? "1–2R"
          : t.rr < 3
          ? "2–3R"
          : "3R+";
      buckets[key].total++;
      if (t.outcome === "WIN") buckets[key].wins++;
      else if (t.outcome === "LOSS") buckets[key].losses++;
    });
    return Object.entries(buckets).map(([label, v]) => ({
      label,
      ...v,
      wr: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
    }));
  }, [trades]);

  const empty = trades.length === 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drawdown analysis and risk-reward performance breakdown
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Max Drawdown",
            value: maxDrawdown > 0 ? `-${fmtMoney(maxDrawdown)}` : "—",
            color: maxDrawdown > 0 ? "text-red-400" : "text-muted-foreground",
          },
          {
            label: "Profit Factor",
            value:
              profitFactor === Infinity
                ? "∞"
                : profitFactor > 0
                ? profitFactor.toFixed(2)
                : "—",
            color:
              profitFactor >= 1.5
                ? "text-emerald-400"
                : profitFactor > 0
                ? "text-yellow-400"
                : "text-muted-foreground",
          },
          {
            label: "Avg R:R",
            value: avgRR > 0 ? `${avgRR.toFixed(2)}R` : "—",
            color:
              avgRR >= 2
                ? "text-emerald-400"
                : avgRR >= 1
                ? "text-yellow-400"
                : "text-muted-foreground",
          },
          {
            label: "Total Trades",
            value: trades.length > 0 ? `${trades.length}` : "—",
            color: "text-foreground",
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            custom={i}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
            className="glass-card p-4"
          >
            <StatBadge label={s.label} value={s.value} color={s.color} />
          </motion.div>
        ))}
      </div>

      <motion.div
        custom={1}
        initial="hidden"
        animate="show"
        variants={FADE_UP}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Drawdown Curve
            </h2>
          </div>
          {maxDrawdown > 0 && (
            <span className="text-xs text-red-400 font-semibold">
              Max: -{fmtMoney(maxDrawdown)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/60 mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Distance below peak equity at each point in time
        </p>

        {!empty && analytics.drawdownCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.drawdownCurve}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                tickFormatter={(v) =>
                  format(new Date(v + "T12:00:00"), "MMM d")
                }
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                tickFormatter={(v) => `-$${Math.abs(v)}`}
              />
              <Tooltip content={<DrawdownTooltip />} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#ddGrad)"
                isAnimationActive
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to see your drawdown curve
          </div>
        )}
      </motion.div>

      <motion.div
        custom={2}
        initial="hidden"
        animate="show"
        variants={FADE_UP}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Crosshair className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            R:R vs P&L Scatter
          </h2>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Each dot is a trade. X-axis = planned R:R, Y-axis = actual P&L.
          Green = win, red = loss.
        </p>

        {!empty ? (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
              />
              <XAxis
                dataKey="rr"
                name="R:R"
                type="number"
                tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                label={{
                  value: "R:R Ratio",
                  position: "insideBottomRight",
                  offset: -5,
                  style: { fontSize: 9, fill: "hsl(215 20% 40%)" },
                }}
              />
              <YAxis
                dataKey="profit"
                name="P&L"
                type="number"
                tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                tickFormatter={(v) => `$${v}`}
              />
              <ReferenceLine
                y={0}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="4 4"
              />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter
                data={scatterWithOutcome}
                isAnimationActive
                animationDuration={800}
              >
                {scatterWithOutcome.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.outcome === "WIN"
                        ? "#10b981"
                        : entry.outcome === "LOSS"
                        ? "#ef4444"
                        : "#6b7280"
                    }
                    fillOpacity={0.8}
                    r={5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to populate the scatter plot
          </div>
        )}

        <div className="flex items-center gap-5 mt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Win
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Loss
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
            Breakeven
          </span>
        </div>
      </motion.div>

      <motion.div
        custom={3}
        initial="hidden"
        animate="show"
        variants={FADE_UP}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Win Rate by R:R Bucket
          </h2>
        </div>

        {!empty ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {rrBuckets.map((bucket) => (
              <div
                key={bucket.label}
                className="p-4 rounded-xl border border-border bg-secondary/30 space-y-2"
              >
                <p className="text-xs font-semibold text-foreground">
                  {bucket.label}
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <p
                      className={`text-xl font-bold ${
                        bucket.wr >= 60
                          ? "text-emerald-400"
                          : bucket.wr >= 40
                          ? "text-yellow-400"
                          : bucket.wr > 0
                          ? "text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {bucket.total > 0 ? `${bucket.wr}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {bucket.wins}W / {bucket.losses}L
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bucket.total} trade{bucket.total !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${bucket.wr}%`,
                      background:
                        bucket.wr >= 60
                          ? "#10b981"
                          : bucket.wr >= 40
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
            Add trades to see R:R breakdown
          </div>
        )}
      </motion.div>
    </div>
  );
}
