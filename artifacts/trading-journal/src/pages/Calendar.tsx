import { useMemo, useState } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import { fmtTradeDate } from "@/lib/dateUtils";
import { motion } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
} from "lucide-react";
import { Trade } from "@/types";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

function fmtPnLCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface DaySummary {
  pnl: number;
  trades: Trade[];
  wins: number;
  losses: number;
  winRate: number;
}

function buildDaySummary(dayTrades: Trade[]): DaySummary {
  const pnl = dayTrades.reduce(
    (acc, t) =>
      acc + (t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0),
    0,
  );
  const wins = dayTrades.filter((t) => t.outcome === "WIN").length;
  const losses = dayTrades.filter((t) => t.outcome === "LOSS").length;
  const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
  return { pnl, trades: dayTrades, wins, losses, winRate };
}

function MonthSummary({
  tradesByDate,
  currentMonth,
}: {
  tradesByDate: Record<string, Trade[]>;
  currentMonth: Date;
}) {
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  let totalPnL = 0;
  let totalTrades = 0;
  let wins = 0;
  let losses = 0;
  let greenDays = 0;
  let redDays = 0;

  days.forEach((day) => {
    const key = format(day, "yyyy-MM-dd");
    const dayTrades = tradesByDate[key] ?? [];
    if (dayTrades.length === 0) return;
    const summary = buildDaySummary(dayTrades);
    totalPnL += summary.pnl;
    totalTrades += dayTrades.length;
    wins += summary.wins;
    losses += summary.losses;
    if (summary.pnl > 0) greenDays++;
    else if (summary.pnl < 0) redDays++;
  });

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const stats = [
    { label: "Monthly P&L", value: fmtPnLCompact(totalPnL), color: totalPnL >= 0 ? "text-emerald-400" : "text-red-400", icon: totalPnL >= 0 ? TrendingUp : TrendingDown },
    { label: "Trades", value: String(totalTrades), color: "text-foreground", icon: CalendarDays },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? "text-emerald-400" : "text-red-400", icon: Target },
    { label: "Green Days", value: String(greenDays), color: "text-emerald-400", icon: Trophy },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {stats.map(({ label, value, color, icon: Icon }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card p-3 flex flex-col gap-1"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wider">{label}</span>
          </div>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </motion.div>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const trades = useTradeStore((s) => s.trades);
  const startingBalance = useTradeStore((s) => s.startingBalance);
  const analytics = useMemo(() => computeAnalytics(trades, startingBalance), [trades, startingBalance]);
  const { tradesByDate } = analytics;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));
  const blanks = Array.from({ length: firstDayOfWeek });
  const weekLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const selectedTrades = selectedDate ? (tradesByDate[selectedDate] ?? []) : [];
  const selectedSummary = selectedTrades.length > 0 ? buildDaySummary(selectedTrades) : null;

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-5 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-1.5">Groeax</p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Trading Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {trades.length} trades tracked · click any day to inspect
          </p>
        </div>
      </div>

      {/* Month summary stats */}
      <MonthSummary tradesByDate={tradesByDate} currentMonth={currentMonth} />

      {/* Calendar card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-3 sm:p-4 lg:p-6"
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1));
              setSelectedDate(null);
            }}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Prev</span>
          </button>

          <h2 className="text-base sm:text-lg font-bold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>

          <button
            onClick={() => {
              setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1));
              setSelectedDate(null);
            }}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-sm"
          >
            <span className="hidden sm:inline text-xs">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekLabels.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1.5 tracking-widest uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid — square cells via aspect-square */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty leading cells */}
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square rounded-lg" />
          ))}

          {/* Day cells */}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTrades = tradesByDate[key] ?? [];
            const hasTrades = dayTrades.length > 0;
            const summary = hasTrades ? buildDaySummary(dayTrades) : null;
            const isSelected = selectedDate === key;
            const today = isToday(day);

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(isSelected ? null : key)}
                className={[
                  "relative aspect-square rounded-lg p-1",
                  "text-left transition-all duration-150 focus:outline-none w-full",
                  "flex flex-col overflow-hidden",
                  hasTrades
                    ? summary!.pnl > 0
                      ? "bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/50"
                      : summary!.pnl < 0
                        ? "bg-red-800 hover:bg-red-700 border border-red-600/50"
                        : "bg-white/10 hover:bg-white/15 border border-white/10"
                    : today
                      ? "bg-primary/10 border border-primary/30 hover:bg-primary/15"
                      : "bg-white/[0.06] border border-white/10 hover:bg-white/[0.1]",
                  isSelected ? "ring-2 ring-white/70 ring-offset-1 ring-offset-transparent scale-[1.03]" : "",
                ].join(" ")}
              >
                {/* Day number — top right */}
                <span
                  className={[
                    "absolute top-0.5 right-1 text-[9px] sm:text-[11px] font-bold leading-tight",
                    hasTrades ? "text-white/90" : today ? "text-primary" : "text-muted-foreground/60",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>

                {/* Today dot */}
                {today && !hasTrades && (
                  <span className="absolute top-1 left-1 w-1 h-1 rounded-full bg-primary" />
                )}

                {/* Trade data — always visible */}
                {hasTrades && summary && (
                  <div className="mt-auto flex flex-col gap-0">
                    <p className="text-white font-bold text-[8px] sm:text-[10px] leading-tight truncate">
                      {fmtPnLCompact(summary.pnl)}
                    </p>
                    <p className="text-white/70 text-[7px] sm:text-[9px] leading-tight">
                      {dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-white/70 text-[7px] sm:text-[9px] leading-tight">
                      {summary.winRate.toFixed(1)}%
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-700" />
            <span className="text-[11px] text-muted-foreground">Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-800" />
            <span className="text-[11px] text-muted-foreground">Loss</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-white/[0.06] border border-white/10" />
            <span className="text-[11px] text-muted-foreground">No trades</span>
          </div>
        </div>
      </motion.div>

      {/* Day detail panel */}
      {selectedDate && selectedTrades.length > 0 && selectedSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {fmtTradeDate(selectedDate, "EEEE, MMMM d yyyy")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedTrades.length} trade{selectedTrades.length !== 1 ? "s" : ""} ·{" "}
                {selectedSummary.wins}W / {selectedSummary.losses}L ·{" "}
                <span className={selectedSummary.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {fmtMoney(selectedSummary.pnl)}
                </span>
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs px-2 py-1 rounded hover:bg-white/5"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            {selectedTrades.map((t) => (
              <div
                key={t.id}
                className={[
                  "flex items-center justify-between p-3 rounded-xl gap-2",
                  t.outcome === "WIN"
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : t.outcome === "LOSS"
                      ? "bg-red-500/10 border border-red-500/20"
                      : "bg-white/5 border border-white/10",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-bold text-sm text-foreground shrink-0">{t.pair}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      t.direction === "BUY"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {t.direction}
                  </span>
                  {t.strategy && (
                    <span className="text-[10px] text-muted-foreground truncate hidden sm:block">
                      {t.strategy}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-muted-foreground">Entry</p>
                    <p className="text-xs text-foreground font-medium">{t.entryPrice}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-muted-foreground">R:R</p>
                    <p className="text-xs text-muted-foreground">{t.rr.toFixed(2)}R</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        t.outcome === "WIN"
                          ? "text-emerald-400"
                          : t.outcome === "LOSS"
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {t.outcome === "WIN"
                        ? `+${fmtMoney(t.netProfit)}`
                        : t.outcome === "LOSS"
                          ? `-${fmtMoney(t.netLoss)}`
                          : "BE"}
                    </p>
                    <p
                      className={`text-[10px] font-semibold ${
                        t.outcome === "WIN"
                          ? "text-emerald-500"
                          : t.outcome === "LOSS"
                            ? "text-red-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      {t.outcome ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {selectedDate && selectedTrades.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-6 text-center"
        >
          <p className="text-muted-foreground text-sm">No trades on {fmtTradeDate(selectedDate, "MMMM d, yyyy")}</p>
        </motion.div>
      )}
    </div>
  );
}
