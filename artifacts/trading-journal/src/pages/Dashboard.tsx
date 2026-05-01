import { useMemo, useState } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, BarChart2, Trophy, AlertCircle, Zap, Award } from "lucide-react";
import { Trade } from "@/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from "date-fns";

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-foreground",
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  index: number;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="show"
      variants={FADE_UP}
      className="glass-card p-4 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`} data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

function CalendarHeatmap({
  tradesByDate,
}: {
  tradesByDate: Record<string, Trade[]>;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfWeek = getDay(startOfMonth(currentMonth));
  const blanks = Array.from({ length: firstDayOfWeek });

  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))
          }
          className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
        >
          ‹
        </button>
        <span className="text-sm font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() =>
            setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))
          }
          className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekLabels.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const trades = tradesByDate[key] ?? [];
          const pnl = trades.reduce(
            (acc, t) =>
              acc +
              (t.outcome === "WIN"
                ? t.netProfit
                : t.outcome === "LOSS"
                ? -t.netLoss
                : 0),
            0
          );
          const hasTrades = trades.length > 0;
          const isSelected = selectedDate === key;

          return (
            <button
              key={key}
              onClick={() => setSelectedDate(isSelected ? null : key)}
              data-testid={`calendar-day-${key}`}
              className={`relative rounded-md p-1 min-h-[50px] text-left transition-all border ${
                isSelected
                  ? "border-primary/60 ring-1 ring-primary/40"
                  : "border-transparent hover:border-border"
              } ${
                hasTrades
                  ? pnl > 0
                    ? "bg-emerald-500/15"
                    : pnl < 0
                    ? "bg-red-500/15"
                    : "bg-muted/30"
                  : isToday(day)
                  ? "bg-primary/10 border-primary/20"
                  : "bg-transparent"
              }`}
            >
              <span
                className={`text-[10px] font-medium ${
                  isToday(day) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {format(day, "d")}
              </span>
              {hasTrades && (
                <div className="mt-0.5">
                  <p
                    className={`text-[9px] font-semibold truncate ${
                      pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {pnl > 0 ? "+" : ""}
                    {fmtMoney(pnl)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {trades.length}T
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && tradesByDate[selectedDate] && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Trades on {format(new Date(selectedDate + "T12:00:00"), "MMM d, yyyy")}
          </p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {tradesByDate[selectedDate].map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs p-1.5 rounded bg-secondary/40"
              >
                <span className="font-medium">{t.pair}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    t.direction === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {t.direction}
                </span>
                <span
                  className={
                    t.outcome === "WIN"
                      ? "text-emerald-400"
                      : t.outcome === "LOSS"
                      ? "text-red-400"
                      : "text-muted-foreground"
                  }
                >
                  {t.outcome === "WIN"
                    ? `+${fmtMoney(t.netProfit)}`
                    : t.outcome === "LOSS"
                    ? `-${fmtMoney(t.netLoss)}`
                    : "BE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const trades = useTradeStore((s) => s.trades);
  const analytics = useMemo(() => computeAnalytics(trades), [trades]);

  const radarData = [
    { subject: "Win Rate", value: analytics.winRate },
    {
      subject: "Profit Factor",
      value: Math.min(
        analytics.totalLoss > 0
          ? (analytics.totalProfit / analytics.totalLoss) * 20
          : analytics.totalProfit > 0 ? 100 : 0,
        100
      ),
    },
    {
      subject: "Consistency",
      value:
        analytics.totalTrades > 0
          ? Math.min(
              (analytics.winRate / 100) * (analytics.equityCurve.length > 0 ? 80 : 50) + 20,
              100
            )
          : 0,
    },
    {
      subject: "Max Drawdown",
      value:
        analytics.drawdownCurve.length > 0
          ? Math.max(
              100 -
                Math.min(
                  (Math.max(...analytics.drawdownCurve.map((d) => d.drawdown)) /
                    Math.max(analytics.biggestProfit, 1)) *
                    100,
                  100
                ),
              0
            )
          : 50,
    },
    {
      subject: "Recovery",
      value:
        analytics.biggestLoss > 0
          ? Math.min((analytics.netBalance / analytics.biggestLoss) * 50 + 50, 100)
          : 50,
    },
    {
      subject: "Avg R:R",
      value:
        analytics.totalTrades > 0
          ? Math.min(
              (trades.reduce((s, t) => s + t.rr, 0) / trades.length) * 25,
              100
            )
          : 0,
    },
  ];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number }[] }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <span className="text-foreground font-medium">{`$${payload[0].value.toFixed(0)}`}</span>
      </div>
    );
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {analytics.totalTrades} trades tracked
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <MetricCard
          index={0}
          label="Net P&L"
          value={fmtMoney(analytics.netBalance)}
          sub={`${fmtMoney(analytics.totalProfit)} won`}
          icon={analytics.netBalance >= 0 ? TrendingUp : TrendingDown}
          color={analytics.netBalance >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <MetricCard
          index={1}
          label="Win Rate"
          value={fmtPct(analytics.winRate)}
          sub={`${analytics.totalTrades} trades`}
          icon={Target}
          color={analytics.winRate >= 50 ? "text-emerald-400" : "text-red-400"}
        />
        <MetricCard
          index={2}
          label="Avg Win"
          value={fmtMoney(analytics.avgWin)}
          sub={`Avg Loss: ${fmtMoney(analytics.avgLoss)}`}
          icon={BarChart2}
        />
        <MetricCard
          index={3}
          label="Best Trade"
          value={analytics.bestTrade ? fmtMoney(analytics.bestTrade.netProfit) : "—"}
          sub={analytics.bestTrade?.pair}
          icon={Trophy}
          color="text-emerald-400"
        />
        <MetricCard
          index={4}
          label="Worst Trade"
          value={analytics.worstTrade ? `-${fmtMoney(analytics.worstTrade.netLoss)}` : "—"}
          sub={analytics.worstTrade?.pair}
          icon={AlertCircle}
          color="text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Performance Score
            </h2>
          </div>
          {analytics.totalTrades > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 10, fill: "hsl(215 20% 50%)" }}
                />
                <Radar
                  name="Performance"
                  dataKey="value"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                  isAnimationActive
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Add trades to see your performance
            </div>
          )}
        </motion.div>

        <CalendarHeatmap tradesByDate={analytics.tradesByDate} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Equity Curve
            </h2>
          </div>
          {analytics.equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={analytics.equityCurve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                  tickFormatter={(v) => format(new Date(v + "T12:00:00"), "MMM d")}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#equityGrad)"
                  isAnimationActive
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
              No trade data yet
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Net Daily P&L
            </h2>
          </div>
          {analytics.dailyPnL.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={analytics.dailyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                  tickFormatter={(v) => format(new Date(v + "T12:00:00"), "MMM d")}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(215 20% 50%)" }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800}>
                  {analytics.dailyPnL.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
              No trade data yet
            </div>
          )}
        </motion.div>
      </div>

      {analytics.totalTrades > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent Trades
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Date</th>
                  <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Pair</th>
                  <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Dir</th>
                  <th className="text-right text-xs text-muted-foreground pb-2 font-medium">P&L</th>
                  <th className="text-right text-xs text-muted-foreground pb-2 font-medium">R:R</th>
                  <th className="text-right text-xs text-muted-foreground pb-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {[...trades]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 8)
                  .map((t) => (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                      <td className="py-2 text-muted-foreground text-xs">
                        {format(new Date(t.date + "T12:00:00"), "MM/dd/yy")}
                      </td>
                      <td className="py-2 font-medium text-xs">{t.pair}</td>
                      <td className="py-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            t.direction === "BUY"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className={`py-2 text-right text-xs font-semibold ${
                        t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"
                      }`}>
                        {t.outcome === "WIN"
                          ? `+${fmtMoney(t.netProfit)}`
                          : t.outcome === "LOSS"
                          ? `-${fmtMoney(t.netLoss)}`
                          : "BE"}
                      </td>
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {t.rr.toFixed(2)}R
                      </td>
                      <td className="py-2 text-right">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          t.outcome === "WIN"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : t.outcome === "LOSS"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {t.outcome ?? "—"}
                        </span>
                      </td>
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
