import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  RefreshCw, Settings2, TrendingUp, Wifi, Zap, Radio,
} from "lucide-react";
import CandlestickChart, { type ChartBar, type ChartSignal } from "@/components/chart/CandlestickChart";
import MetricsPanel from "@/components/chart/MetricsPanel";

const PAIRS      = ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","XAUUSD","GBPJPY","EURJPY","NZDUSD"];
const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1"];
const SPEEDS     = [0.5, 1, 2, 4, 8] as const;
type  Speed = (typeof SPEEDS)[number];
type  Mode  = "live" | "replay" | "backtest";

interface Metrics {
  totalTrades: number; wins: number; losses: number; winRate: number;
  totalPnLPips: number; totalPnLUSD: number; expectancy: number;
  maxDrawdownUSD: number; profitFactor: number; avgWinPips: number; avgLossPips: number;
}
interface StrategyMeta { id: string; name: string; description: string }

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

export default function ChartPage() {
  /* ── selectors ── */
  const [pair, setPair]       = useState("EURUSD");
  const [tf, setTf]           = useState("H1");
  const [mode, setMode]       = useState<Mode>("live");
  const [strategy, setStrategy] = useState("ema_9_21");
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [speed, setSpeed]     = useState<Speed>(1);

  /* ── chart data ── */
  const [bars, setBars]         = useState<ChartBar[]>([]);
  const [signals, setSignals]   = useState<ChartSignal[]>([]);
  const [metrics, setMetrics]   = useState<Metrics | null>(null);
  const [strategyName, setStrategyName] = useState<string | undefined>();

  /* ── live SSE ── */
  const [sseStatus, setSseStatus] = useState<"connecting"|"open"|"closed">("closed");
  const evsRef = useRef<EventSource | null>(null);

  /* ── replay (fully client-side) ── */
  const allBarsRef          = useRef<ChartBar[]>([]);
  const [replayIdx, setReplayIdx]     = useState(0);
  const [replayTotal, setReplayTotal] = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── backtest ── */
  const [backtesting, setBacktesting] = useState(false);

  /* ── strategy list ── */
  useEffect(() => {
    fetch(`${BASE}/api/chart/strategies`)
      .then(r => r.json())
      .then(d => setStrategies(d.strategies ?? []))
      .catch(() => {});
  }, []);

  /* ═══════════════════════════════════════════════════════════════════
     LIVE MODE — Server-Sent Events
  ═══════════════════════════════════════════════════════════════════ */
  const stopSse = useCallback(() => {
    evsRef.current?.close();
    evsRef.current = null;
    setSseStatus("closed");
  }, []);

  const startSse = useCallback((p: string, t: string) => {
    stopSse();
    setBars([]);
    setSseStatus("connecting");
    const es = new EventSource(`${BASE}/api/chart/live?pair=${p}&tf=${t}`);
    evsRef.current = es;
    es.onopen = () => setSseStatus("open");
    es.onerror = () => setSseStatus("closed");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type: string; bars?: ChartBar[]; bar?: ChartBar };
        if (msg.type === "history" && msg.bars) setBars(msg.bars);
        if (msg.type === "candle"  && msg.bar)  setBars(prev => {
          const bar = msg.bar!;
          const idx = prev.findIndex(b => b.time === bar.time);
          return idx >= 0 ? [...prev.slice(0, idx), bar, ...prev.slice(idx + 1)] : [...prev, bar];
        });
      } catch { /* ignore */ }
    };
  }, [stopSse]);

  /* ═══════════════════════════════════════════════════════════════════
     REPLAY MODE — client-side
  ═══════════════════════════════════════════════════════════════════ */
  const stopPlay = useCallback(() => {
    if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
    setIsPlaying(false);
  }, []);

  const loadReplayBars = useCallback(async (p: string, t: string) => {
    stopPlay();
    setBars([]);
    const res = await fetch(`${BASE}/api/chart/candles?pair=${p}&tf=${t}&limit=500`);
    const d   = await res.json() as { bars: ChartBar[] };
    allBarsRef.current = d.bars ?? [];
    const startIdx = Math.min(49, allBarsRef.current.length - 1);
    setReplayIdx(startIdx);
    setReplayTotal(allBarsRef.current.length);
    setBars(allBarsRef.current.slice(0, startIdx + 1));
  }, [stopPlay]);

  const playStep = useCallback(() => {
    setReplayIdx(prev => {
      const next = prev + 1;
      if (next >= allBarsRef.current.length) { stopPlay(); return prev; }
      setBars(allBarsRef.current.slice(0, next + 1));
      return next;
    });
  }, [stopPlay]);

  const startPlay = useCallback(() => {
    if (allBarsRef.current.length === 0) return;
    stopPlay();
    setIsPlaying(true);
    const ms = Math.max(60, 600 / speed);
    playTimerRef.current = setInterval(playStep, ms);
  }, [speed, stopPlay, playStep]);

  const togglePlay = useCallback(() => {
    if (isPlaying) { stopPlay(); } else { startPlay(); }
  }, [isPlaying, stopPlay, startPlay]);

  const stepBy = useCallback((delta: number) => {
    stopPlay();
    setReplayIdx(prev => {
      const next = Math.max(0, Math.min(prev + delta, allBarsRef.current.length - 1));
      setBars(allBarsRef.current.slice(0, next + 1));
      return next;
    });
  }, [stopPlay]);

  const seekTo = useCallback((idx: number) => {
    stopPlay();
    const clamped = Math.max(0, Math.min(idx, allBarsRef.current.length - 1));
    setReplayIdx(clamped);
    setBars(allBarsRef.current.slice(0, clamped + 1));
  }, [stopPlay]);

  /* ═══════════════════════════════════════════════════════════════════
     BACKTEST MODE — REST
  ═══════════════════════════════════════════════════════════════════ */
  const runBacktest = useCallback(async () => {
    setBacktesting(true);
    setSignals([]);
    setMetrics(null);
    try {
      const res = await fetch(`${BASE}/api/chart/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair, tf, strategy, limit: 500 }),
      });
      const data = await res.json();
      if (data.bars)    setBars(data.bars);
      if (data.signals) setSignals(data.signals);
      if (data.metrics) setMetrics(data.metrics);
      setStrategyName(data.strategyName);
    } catch { /* ignore */ }
    setBacktesting(false);
  }, [pair, tf, strategy]);

  /* ═══════════════════════════════════════════════════════════════════
     MODE SWITCHING
  ═══════════════════════════════════════════════════════════════════ */
  const switchMode = useCallback((m: Mode) => {
    stopSse();
    stopPlay();
    setSignals([]);
    setMetrics(null);
    setStrategyName(undefined);
    setMode(m);

    if (m === "live") {
      startSse(pair, tf);
    } else if (m === "replay") {
      loadReplayBars(pair, tf);
    }
  }, [stopSse, stopPlay, startSse, loadReplayBars, pair, tf]);

  /* Auto-start live on mount */
  useEffect(() => {
    startSse(pair, tf);
    return stopSse;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Re-subscribe when pair/tf changes in live mode */
  useEffect(() => {
    if (mode === "live") startSse(pair, tf);
    else if (mode === "replay") loadReplayBars(pair, tf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, tf]);

  /* Keyboard in replay mode */
  useEffect(() => {
    if (mode !== "replay") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepBy(1);
      else if (e.key === "ArrowLeft") stepBy(-1);
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode, stepBy, togglePlay]);

  /* Update interval when speed changes mid-play */
  useEffect(() => {
    if (isPlaying) { stopPlay(); startPlay(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  /* ── helpers ── */
  const StatusIcon = sseStatus === "open" ? Radio : sseStatus === "connecting" ? RefreshCw : Wifi;
  const statusColor = sseStatus === "open" ? "text-emerald-400" : sseStatus === "connecting" ? "text-yellow-400" : "text-muted-foreground";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 bg-card/50">
        {/* Pair */}
        <select
          value={pair}
          onChange={e => { setPair(e.target.value); }}
          className="text-xs font-mono font-semibold bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none cursor-pointer"
        >
          {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Timeframe pills */}
        <div className="flex items-center gap-0.5 bg-secondary/60 border border-border rounded-lg p-0.5">
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-md transition-all
                ${tf === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Mode pills */}
        <div className="flex items-center gap-0.5 bg-secondary/60 border border-border rounded-lg p-0.5">
          {(["live","replay","backtest"] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all
                ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "live" ? "🔴 Live" : m === "replay" ? "⏮ Replay" : "⚡ Backtest"}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Status */}
        {mode === "live" && (
          <div className={`flex items-center gap-1 text-[10px] font-medium ${statusColor}`}>
            <StatusIcon className={`w-3 h-3 ${sseStatus === "connecting" ? "animate-spin" : ""}`} />
            <span className="capitalize hidden sm:inline">{sseStatus}</span>
          </div>
        )}

        <button onClick={() => switchMode(mode)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Chart area */}
        <div className="flex-1 min-w-0 relative bg-[#080c15]">
          {bars.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <TrendingUp className="w-10 h-10 opacity-20" />
              <p className="text-sm">{mode === "live" && sseStatus === "connecting" ? "Connecting…" : "Loading candles…"}</p>
            </div>
          ) : (
            <div className="absolute inset-0 p-1">
              <CandlestickChart
                bars={bars}
                signals={mode === "backtest" ? signals : []}
                replayIndex={mode === "replay" ? replayIdx : undefined}
              />
            </div>
          )}

          {/* Pair overlay */}
          <div className="absolute top-3 left-3 pointer-events-none select-none">
            <p className="text-sm font-bold text-white/40 font-mono">{pair}</p>
            <p className="text-[10px] text-white/25 font-mono">{tf}</p>
          </div>

          {/* Live indicator */}
          {mode === "live" && sseStatus === "open" && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">LIVE</span>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-64 shrink-0 border-l border-border flex flex-col overflow-y-auto bg-card/30">

          {/* Backtest strategy selector */}
          {mode === "backtest" && (
            <div className="p-3 border-b border-border space-y-2">
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Strategy</span>
              </div>
              <select value={strategy} onChange={e => setStrategy(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none cursor-pointer">
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {strategies.find(s => s.id === strategy) && (
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {strategies.find(s => s.id === strategy)?.description}
                </p>
              )}
              <button onClick={runBacktest} disabled={backtesting}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Zap className="w-3.5 h-3.5" />
                {backtesting ? "Running…" : "Run Backtest"}
              </button>
            </div>
          )}

          {/* Replay speed */}
          {mode === "replay" && (
            <div className="p-3 border-b border-border space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Speed</p>
              <div className="flex gap-1 flex-wrap">
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`flex-1 min-w-[36px] py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all
                      ${speed === s ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                    {s}×
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
                <p>← → step candles  •  Space play/pause</p>
                <p className="font-mono">{bars.length} / {replayTotal} bars shown</p>
              </div>
            </div>
          )}

          {/* Metrics / info */}
          <div className="p-3 flex-1">
            {mode === "backtest" ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Results</p>
                <MetricsPanel metrics={metrics} strategyName={strategyName} pair={pair} tf={tf} />
              </>
            ) : mode === "live" ? (
              <div className="text-center text-muted-foreground text-xs pt-6 space-y-2">
                <Wifi className="w-7 h-7 mx-auto opacity-20" />
                <p>{bars.length} candles loaded</p>
                <p className="text-[10px] opacity-50">New candles stream automatically</p>
                <p className="text-[10px] opacity-50">Switch to Backtest for strategy analysis</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-xs pt-6 space-y-2">
                <p className="font-semibold text-sm text-foreground">Bar {replayIdx + 1}</p>
                <p className="text-[10px] opacity-60">of {replayTotal} total</p>
                {allBarsRef.current[replayIdx] && (
                  <div className="mt-4 rounded-xl p-3 bg-secondary/30 border border-border text-left space-y-1">
                    {[
                      ["O", allBarsRef.current[replayIdx].open],
                      ["H", allBarsRef.current[replayIdx].high],
                      ["L", allBarsRef.current[replayIdx].low],
                      ["C", allBarsRef.current[replayIdx].close],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between">
                        <span className="text-[10px] text-muted-foreground font-mono">{k}</span>
                        <span className="text-[10px] font-mono text-foreground">{Number(v).toFixed(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Replay bar ── */}
      {mode === "replay" && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{ y: 60,   opacity: 0 }}
          className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3 space-y-2.5"
        >
          {/* Scrubber */}
          <div
            className="relative h-2 bg-secondary/60 rounded-full cursor-pointer group"
            onClick={e => {
              if (replayTotal === 0) return;
              const r   = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - r.left) / r.width;
              seekTo(Math.round(pct * (replayTotal - 1)));
            }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary/80 transition-none"
              style={{ width: replayTotal > 1 ? `${(replayIdx / (replayTotal - 1)) * 100}%` : "0%" }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: replayTotal > 1 ? `${(replayIdx / (replayTotal - 1)) * 100}%` : "0%" }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              {replayIdx + 1} / {replayTotal}
            </span>

            <div className="flex items-center gap-1">
              <button onClick={() => seekTo(0)} title="First" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={() => stepBy(-1)} title="Prev (←)" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={togglePlay} title="Play/Pause (Space)"
                className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-colors">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => stepBy(1)} title="Next (→)" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => seekTo(replayTotal - 1)} title="Last" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
              <span className="text-[10px] text-muted-foreground font-mono">{speed}×</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
