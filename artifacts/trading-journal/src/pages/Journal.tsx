import { useMemo, useState } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import {
  startOfMonth,
  format,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { fmtTradeDate } from "@/lib/dateUtils";
import { Trade } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function getWeeklyStats(
  tradesByDate: Record<string, Trade[]>,
  weekDays: Date[]
): { pnl: number; trades: number; winRate: number } {
  let pnl = 0;
  let trades = 0;
  let wins = 0;
  weekDays.forEach((d) => {
    const key = format(d, "yyyy-MM-dd");
    const dayTrades = tradesByDate[key] ?? [];
    trades += dayTrades.length;
    dayTrades.forEach((t) => {
      if (t.outcome === "WIN") { pnl += t.netProfit; wins++; }
      else if (t.outcome === "LOSS") pnl -= t.netLoss;
    });
  });
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  return { pnl, trades, winRate };
}

export default function Journal() {
  const trades = useTradeStore((s) => s.trades);
  const startingBalance = useTradeStore((s) => s.startingBalance);
  const analytics = useMemo(() => computeAnalytics(trades, startingBalance), [trades, startingBalance]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstDay = startOfMonth(currentMonth);
  const lastDay = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const firstDayOfWeek = getDay(firstDay);
  const blanks = Array.from({ length: firstDayOfWeek });

  const allDays = [...Array(firstDayOfWeek).fill(null), ...days];
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const totalDays = allDays.length;
  const paddingEnd = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7);
  if (paddingEnd > 0) {
    weeks[weeks.length - 1]?.push(...Array(paddingEnd).fill(null));
  }

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthStats = useMemo(() => {
    let pnl = 0;
    let cnt = 0;
    let wins = 0;
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayTrades = analytics.tradesByDate[key] ?? [];
      cnt += dayTrades.length;
      dayTrades.forEach((t) => {
        if (t.outcome === "WIN") { pnl += t.netProfit; wins++; }
        else if (t.outcome === "LOSS") pnl -= t.netLoss;
      });
    });
    const wr = cnt > 0 ? (wins / cnt) * 100 : 0;
    return { pnl, cnt, wr };
  }, [days, analytics.tradesByDate]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Journal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Trading calendar — click any day to view details</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/40 inline-block" />
            Profit day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/40 inline-block" />
            Loss day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-muted/50 inline-block" />
            No trades
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))
          }
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4">
          <h2 className="text-base font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-3 text-xs bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
            <span className={monthStats.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
              {fmtMoney(monthStats.pnl)}
            </span>
            <span className="text-muted-foreground">{monthStats.cnt} trades</span>
            <span className="text-muted-foreground">{monthStats.wr.toFixed(0)}% WR</span>
          </div>
        </div>

        <button
          onClick={() =>
            setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))
          }
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Day headers: 7 cols on mobile, 8 on sm (adds Week column) */}
        <div className="grid grid-cols-7 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] border-b border-border">
          {dayHeaders.map((h) => (
            <div
              key={h}
              className="text-center text-[10px] sm:text-[11px] text-muted-foreground py-2 sm:py-2.5 font-medium border-r border-border last:border-r-0"
            >
              {h}
            </div>
          ))}
          <div className="hidden sm:block text-center text-[11px] text-muted-foreground py-2.5 font-medium px-2">
            Week
          </div>
        </div>

        {weeks.map((week, wi) => {
          const validDays = week.filter(Boolean) as Date[];
          const weekStats = getWeeklyStats(analytics.tradesByDate, validDays);

          return (
            <div
              key={wi}
              className="grid grid-cols-7 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] border-b border-border last:border-b-0"
            >
              {week.map((day, di) => {
                if (!day) {
                  return <div key={`empty-${wi}-${di}`} className="border-r border-border min-h-[52px] sm:min-h-[80px]" />;
                }
                const key = format(day, "yyyy-MM-dd");
                const dayTrades = analytics.tradesByDate[key] ?? [];
                const pnl = dayTrades.reduce(
                  (acc, t) =>
                    acc +
                    (t.outcome === "WIN"
                      ? t.netProfit
                      : t.outcome === "LOSS"
                      ? -t.netLoss
                      : 0),
                  0
                );
                const wins = dayTrades.filter((t) => t.outcome === "WIN").length;
                const wr = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
                const hasTrades = dayTrades.length > 0;
                const isSelected = selectedDate === key;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    data-testid={`journal-day-${key}`}
                    className={`border-r border-border min-h-[52px] sm:min-h-[80px] p-1 sm:p-2 text-left transition-all hover:bg-accent/20 overflow-hidden ${
                      hasTrades
                        ? pnl > 0
                          ? "bg-emerald-500/10"
                          : pnl < 0
                          ? "bg-red-500/10"
                          : "bg-muted/20"
                        : ""
                    } ${isSelected ? "ring-1 ring-inset ring-primary/50" : ""}`}
                  >
                    <span
                      className={`text-[10px] sm:text-xs font-medium ${
                        isToday(day) ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {hasTrades && (
                      <div className="mt-0.5 sm:mt-1 space-y-px sm:space-y-0.5">
                        <p
                          className={`text-[8px] sm:text-[10px] font-semibold leading-tight truncate ${
                            pnl > 0
                              ? "text-emerald-400"
                              : pnl < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {pnl > 0 ? "+" : ""}
                          {fmtMoney(pnl)}
                        </p>
                        <p className="text-[7px] sm:text-[9px] text-muted-foreground leading-tight">
                          {dayTrades.length}t
                        </p>
                        <p className="hidden sm:block text-[9px] text-muted-foreground">{wr.toFixed(0)}%</p>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Week summary — hidden on mobile */}
              <div className="hidden sm:flex min-h-[80px] flex-col items-center justify-center px-2 bg-secondary/20">
                {weekStats.trades > 0 ? (
                  <>
                    <p
                      className={`text-[10px] font-semibold ${
                        weekStats.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {weekStats.pnl >= 0 ? "+" : ""}
                      {fmtMoney(weekStats.pnl)}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{weekStats.trades}T</p>
                    <p className="text-[9px] text-muted-foreground">{weekStats.winRate.toFixed(0)}%</p>
                  </>
                ) : (
                  <span className="text-[9px] text-muted-foreground/40">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDate && analytics.tradesByDate[selectedDate] && (
        <div className="mt-4 glass-card p-4">
          <h3 className="text-sm font-medium mb-3">
            Trades on {fmtTradeDate(selectedDate, "EEEE, MMM d, yyyy")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Pair", "Direction", "Entry", "SL", "TP", "Lot", "Net P&L", "R:R", "Outcome"].map((h) => (
                    <th key={h} className="text-left text-xs text-muted-foreground pb-2 font-medium pr-4 last:pr-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.tradesByDate[selectedDate].map((t) => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                    <td className="py-2 font-medium text-xs pr-4">{t.pair}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground pr-4">{t.entryPrice}</td>
                    <td className="py-2 text-xs text-muted-foreground pr-4">{t.stopLoss}</td>
                    <td className="py-2 text-xs text-muted-foreground pr-4">{t.takeProfit}</td>
                    <td className="py-2 text-xs text-muted-foreground pr-4">{t.lotSize}</td>
                    <td className={`py-2 text-xs font-semibold pr-4 ${
                      t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "BE"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground pr-4">{t.rr.toFixed(2)}R</td>
                    <td className="py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        t.outcome === "WIN" ? "bg-emerald-500/20 text-emerald-400" : t.outcome === "LOSS" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                      }`}>
                        {t.outcome ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
