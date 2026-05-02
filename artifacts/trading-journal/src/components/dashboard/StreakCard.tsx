import { useMemo } from "react";
import { Trade } from "@/types";
import { Flame, TrendingDown, BarChart2, Calendar } from "lucide-react";

interface Props { trades: Trade[] }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeStreaks(sorted: Trade[]) {
  let currentStreak = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let tempWin = 0;
  let tempLoss = 0;
  let streakType: "WIN" | "LOSS" | null = null;

  for (const t of sorted) {
    if (t.outcome === "WIN") {
      tempWin++;
      tempLoss = 0;
      longestWin = Math.max(longestWin, tempWin);
    } else if (t.outcome === "LOSS") {
      tempLoss++;
      tempWin = 0;
      longestLoss = Math.max(longestLoss, tempLoss);
    } else {
      tempWin = 0;
      tempLoss = 0;
    }
  }

  const last = sorted[sorted.length - 1];
  if (last?.outcome === "WIN") {
    currentStreak = tempWin;
    streakType = "WIN";
  } else if (last?.outcome === "LOSS") {
    currentStreak = tempLoss;
    streakType = "LOSS";
  }

  return { currentStreak, streakType, longestWin, longestLoss };
}

function computeDayOfWeekStats(trades: Trade[]) {
  const stats = Array.from({ length: 7 }, (_, i) => ({
    day: DAYS[i],
    wins: 0,
    losses: 0,
    total: 0,
    pnl: 0,
  }));

  for (const t of trades) {
    if (!t.date) continue;
    const parsed = new Date(t.date + "T12:00:00");
    if (isNaN(parsed.getTime())) continue;
    const d = parsed.getDay();
    if (d < 0 || d > 6 || !stats[d]) continue;
    stats[d].total++;
    const pnl = t.outcome === "WIN" ? t.netProfit : t.outcome === "LOSS" ? -t.netLoss : 0;
    stats[d].pnl += pnl;
    if (t.outcome === "WIN") stats[d].wins++;
    else if (t.outcome === "LOSS") stats[d].losses++;
  }

  return stats;
}

export default function StreakCard({ trades }: Props) {
  const sorted = useMemo(
    () => trades.filter((t) => t.outcome).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [trades]
  );

  const { currentStreak, streakType, longestWin, longestLoss } = useMemo(
    () => computeStreaks(sorted),
    [sorted]
  );

  const dayStats = useMemo(() => computeDayOfWeekStats(trades), [trades]);

  const maxAbsPnl = Math.max(...dayStats.map((d) => Math.abs(d.pnl)), 1);

  const last10 = sorted.slice(-10);

  if (trades.length === 0) {
    return (
      <div className="glass-card p-4 flex items-center justify-center min-h-[120px]">
        <p className="text-xs text-muted-foreground">Add trades to see streaks & consistency</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Streaks & Consistency</span>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: "Current",
            value: currentStreak > 0 ? `${currentStreak}${streakType === "WIN" ? "W" : "L"}` : "—",
            color: currentStreak > 0 && streakType === "WIN" ? "text-emerald-400" : currentStreak > 0 ? "text-red-400" : "text-muted-foreground",
            icon: streakType === "WIN" ? "🔥" : streakType === "LOSS" ? "❄️" : "—",
          },
          { label: "Best Win", value: `${longestWin}W`, color: "text-emerald-400", icon: "🏆" },
          { label: "Worst Loss", value: `${longestLoss}L`, color: "text-red-400", icon: "💧" },
          {
            label: "Consistency",
            value: sorted.length > 0
              ? `${Math.round((sorted.filter((t) => t.outcome === "WIN").length / sorted.length) * 100)}%`
              : "—",
            color: "text-foreground",
            icon: "📊",
          },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-secondary/30 rounded-xl p-2.5 text-center">
            <div className="text-lg mb-0.5">{icon}</div>
            <p className={`text-sm font-bold ${color}`}>{value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Last 10 trades visual */}
      <div>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Last {last10.length} trades</p>
        <div className="flex gap-1">
          {last10.map((t, i) => (
            <div
              key={i}
              title={`${t.pair} ${t.outcome}`}
              className={`flex-1 h-6 rounded-md transition-colors ${
                t.outcome === "WIN"
                  ? "bg-emerald-500"
                  : t.outcome === "LOSS"
                  ? "bg-red-500"
                  : "bg-muted-foreground/40"
              }`}
            />
          ))}
          {Array.from({ length: Math.max(0, 10 - last10.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 h-6 rounded-md bg-secondary/30 border border-dashed border-border/40" />
          ))}
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-muted-foreground">Oldest</span>
          <span className="text-[8px] text-muted-foreground">Latest</span>
        </div>
      </div>

      {/* Day of week */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Performance by Day</p>
        </div>
        <div className="flex items-end gap-1 h-14">
          {dayStats.map((d) => {
            const pct = d.total > 0 ? Math.abs(d.pnl) / maxAbsPnl : 0;
            const isGreen = d.pnl >= 0;
            return (
              <div key={d.day} className="flex flex-col items-center flex-1 gap-0.5 h-full justify-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    d.total === 0
                      ? "bg-secondary/30"
                      : isGreen
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                  style={{ height: d.total > 0 ? `${Math.max(8, pct * 100)}%` : "4px" }}
                  title={`${d.day}: ${d.wins}W / ${d.losses}L`}
                />
                <span className="text-[8px] text-muted-foreground">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
