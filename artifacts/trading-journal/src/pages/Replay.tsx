import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { Trade, SESSION_LABELS, TradingSession } from "@/types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  SkipBack, SkipForward, Play, Pause, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, Clock, Layers, Tag, FileText,
  Rewind,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const SESSION_COLORS: Record<TradingSession, string> = {
  ASIA: "text-cyan-400", TOKYO: "text-violet-400",
  LONDON: "text-blue-400", NEW_YORK: "text-emerald-400",
};
const SESSION_FLAGS: Record<TradingSession, string> = {
  ASIA: "🌏", TOKYO: "🗼", LONDON: "🇬🇧", NEW_YORK: "🗽",
};

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

interface EquityPoint { date: string; equity: number; idx: number }

function buildEquityCurve(trades: Trade[], upTo: number): EquityPoint[] {
  let eq = 0;
  return trades.slice(0, upTo + 1).map((t, i) => {
    eq += (t.netProfit ?? 0) - (t.netLoss ?? 0);
    return { date: t.date, equity: +eq.toFixed(2), idx: i };
  });
}

const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: EquityPoint }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-0.5">Trade {d.idx + 1}</p>
      <p className={`font-semibold ${d.equity >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {d.equity >= 0 ? "+" : ""}{fmtMoney(d.equity)}
      </p>
    </div>
  );
};

export default function Replay() {
  const trades = useTradeStore((s) => s.trades);

  const sorted = useMemo(
    () => [...trades].sort((a, b) => a.date.localeCompare(b.date)),
    [trades]
  );

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [revealed, setRevealed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = sorted.length;
  const current = sorted[idx] ?? null;
  const equityCurve = useMemo(() => buildEquityCurve(sorted, idx), [sorted, idx]);
  const currentEquity = equityCurve[equityCurve.length - 1]?.equity ?? 0;

  const pnl = current ? (current.netProfit ?? 0) - (current.netLoss ?? 0) : 0;
  const outcome = current?.outcome;

  const goTo = useCallback((i: number) => {
    setIdx(Math.max(0, Math.min(i, total - 1)));
    setRevealed(false);
  }, [total]);

  const stepForward = useCallback(() => {
    if (idx < total - 1) { goTo(idx + 1); }
    else { setPlaying(false); }
  }, [idx, total, goTo]);

  const stepBack = useCallback(() => goTo(idx - 1), [idx, goTo]);

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(stepForward, 1500 / speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, stepForward]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepForward();
      else if (e.key === "ArrowLeft") stepBack();
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepForward, stepBack]);

  if (total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
        <Rewind className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">No trades to replay</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add some trades first, then come back here to step through them like a TradingView replay session.
        </p>
      </div>
    );
  }

  const outcomeConfig = {
    WIN:  { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: TrendingUp,   label: "WIN" },
    LOSS: { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/25",         icon: TrendingDown, label: "LOSS" },
    BE:   { color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/25",   icon: Minus,        label: "BREAKEVEN" },
  };
  const oc = outcome ? outcomeConfig[outcome] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rewind className="w-5 h-5 text-primary" />
            Trade Replay
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step through your trades like a TradingView replay session · Use ← → or Space
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Speed selector */}
          <div className="flex items-center gap-1 bg-secondary/50 border border-border rounded-lg p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-xs px-2 py-1 rounded-md font-mono font-semibold transition-all ${speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content: chart + trade card ── */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-2">
        {/* Equity curve */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cumulative P&L</p>
              <p className={`text-2xl font-bold mt-0.5 ${currentEquity >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {currentEquity >= 0 ? "+" : ""}{fmtMoney(currentEquity)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Trade</p>
              <p className="text-lg font-bold text-foreground">{idx + 1} <span className="text-muted-foreground text-sm font-normal">/ {total}</span></p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={equityCurve} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentEquity >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={currentEquity >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="idx" hide />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 45%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={56} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={currentEquity >= 0 ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill="url(#replayGrad)"
                isAnimationActive={false}
                dot={(props) => {
                  if (props.index !== equityCurve.length - 1) return <g key={props.key} />;
                  return (
                    <circle
                      key={props.key}
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill={currentEquity >= 0 ? "#10b981" : "#ef4444"}
                      stroke="#0f1117"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Current trade card */}
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-5 space-y-4"
            >
              {/* Trade header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${oc ? oc.bg : "bg-secondary/40 border-border text-muted-foreground"}`}>
                    {oc ? (
                      <span className={`flex items-center gap-1 ${oc.color}`}>
                        <oc.icon className="w-3 h-3" />
                        {oc.label}
                      </span>
                    ) : "PENDING"}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{current.pair}</p>
                    <p className={`text-xs font-semibold ${current.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                      {current.direction}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-yellow-400"}`}>
                    {pnl > 0 ? "+" : pnl < 0 ? "-" : ""}{fmtMoney(Math.abs(pnl))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {current.date ? format(parseISO(current.date), "MMM d, yyyy") : "—"}
                  </p>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2 border-t border-border">
                {[
                  { label: "Entry",      val: current.entryPrice?.toFixed(5) ?? "—" },
                  { label: "Stop Loss",  val: current.stopLoss?.toFixed(5) ?? "—",   color: "text-red-400" },
                  { label: "Take Profit",val: current.takeProfit?.toFixed(5) ?? "—", color: "text-emerald-400" },
                  { label: "Lot Size",   val: current.lotSize?.toString() ?? "—" },
                  { label: "R:R",        val: current.rr ? `${current.rr.toFixed(2)}R` : "—", color: current.rr >= 2 ? "text-emerald-400" : current.rr >= 1 ? "text-yellow-400" : "text-red-400" },
                  { label: "Gross Win",  val: current.netProfit > 0 ? `+${fmtMoney(current.netProfit)}` : "—", color: "text-emerald-400" },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className={`text-sm font-semibold mt-0.5 ${color ?? "text-foreground"}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Tags row */}
              <div className="flex flex-wrap gap-2 items-center">
                {current.session && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-border ${SESSION_COLORS[current.session as TradingSession]}`}>
                    {SESSION_FLAGS[current.session as TradingSession]} {SESSION_LABELS[current.session as TradingSession]}
                  </span>
                )}
                {current.strategy && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-border text-muted-foreground">
                    <Layers className="w-3 h-3" />{current.strategy}
                  </span>
                )}
                {(current.patterns ?? []).map((p) => (
                  <span key={p} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-border text-muted-foreground">
                    <Tag className="w-3 h-3" />{p}
                  </span>
                ))}
              </div>

              {/* Notes */}
              {current.notes && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{current.notes}</p>
                  </div>
                </div>
              )}

              {/* Reveal outcome button */}
              {!revealed && !outcome && (
                <button
                  onClick={() => setRevealed(true)}
                  className="w-full py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  Reveal outcome →
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Running stats row */}
        {idx > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {(() => {
              const reviewed = sorted.slice(0, idx + 1).filter((t) => t.outcome);
              const wins = reviewed.filter((t) => t.outcome === "WIN").length;
              const losses = reviewed.filter((t) => t.outcome === "LOSS").length;
              const wr = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
              const avgPnL = reviewed.length > 0
                ? reviewed.reduce((acc, t) => acc + (t.netProfit ?? 0) - (t.netLoss ?? 0), 0) / reviewed.length
                : 0;
              const avgRR = reviewed.length > 0
                ? reviewed.reduce((acc, t) => acc + (t.rr ?? 0), 0) / reviewed.length
                : 0;
              return [
                { label: "Win Rate",  val: `${wr}%`,             color: wr >= 60 ? "text-emerald-400" : wr >= 40 ? "text-yellow-400" : "text-red-400" },
                { label: "W / L",     val: `${wins}W / ${losses}L`, color: "text-foreground" },
                { label: "Avg R:R",   val: `${avgRR.toFixed(2)}R`, color: avgRR >= 2 ? "text-emerald-400" : avgRR >= 1 ? "text-yellow-400" : "text-red-400" },
                { label: "Avg P&L",   val: `${avgPnL >= 0 ? "+" : ""}${fmtMoney(avgPnL)}`, color: avgPnL >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="glass-card p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className={`text-lg font-bold mt-1 ${color}`}>{val}</p>
                </div>
              ));
            })()}
          </motion.div>
        )}
      </div>

      {/* ── TradingView-style replay bar ── */}
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-6 py-3">
        {/* Scrubber timeline */}
        <div className="mb-3 relative">
          <div className="relative h-2 bg-secondary rounded-full cursor-pointer overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              goTo(Math.round(pct * (total - 1)));
            }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${total > 1 ? (idx / (total - 1)) * 100 : 100}%`, background: currentEquity >= 0 ? "#10b981" : "#ef4444" }}
            />
          </div>
          {/* Tick marks */}
          <div className="flex justify-between mt-1 px-0.5">
            {sorted.map((t, i) => (
              <button
                key={t.id}
                onClick={() => goTo(i)}
                title={`Trade ${i + 1}: ${t.pair}`}
                className={`w-1 h-1 rounded-full transition-all ${
                  i < idx ? (t.outcome === "WIN" ? "bg-emerald-500" : t.outcome === "LOSS" ? "bg-red-500" : "bg-yellow-500")
                  : i === idx ? "bg-white scale-125"
                  : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: date + trade info */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {current?.date ? format(parseISO(current.date), "MMM d, yyyy") : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{current?.pair ?? "—"} · {current?.direction ?? "—"}</p>
            </div>
          </div>

          {/* Center: playback controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goTo(0)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="First trade"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={stepBack}
              disabled={idx === 0}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
              title="Play/Pause (Space)"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={stepForward}
              disabled={idx === total - 1}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goTo(total - 1)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Last trade"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right: counter */}
          <div className="flex items-center gap-2 min-w-[140px] justify-end">
            <div className="text-right">
              <p className="text-xs font-mono font-semibold text-foreground">
                {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </p>
              <p className="text-[10px] text-muted-foreground">{speed}× speed</p>
            </div>
            <div className={`w-2 h-2 rounded-full ${playing ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
