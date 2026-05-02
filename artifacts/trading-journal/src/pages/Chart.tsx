import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  RefreshCw, Settings2, TrendingUp, Wifi, Zap, Radio,
} from "lucide-react";
import CandlestickChart, { type ChartBar, type ChartSignal } from "@/components/chart/CandlestickChart";
import MetricsPanel from "@/components/chart/MetricsPanel";

/* ── Pair catalogue (mirrors backend) ──────────────────────────────── */
const PAIR_CATEGORIES: Record<string, string[]> = {
  Forex:   ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD",
             "EURJPY","GBPJPY","EURGBP","EURAUD","EURCAD","GBPAUD","GBPCAD",
             "AUDCAD","AUDNZD","CADJPY","CHFJPY","USDMXN","USDSEK"],
  Metals:  ["XAUUSD","XAGUSD","XPTUSD","XPDUSD","WTIUSD","BRENTUSD"],
  Crypto:  ["BTCUSD","ETHUSD","BNBUSD","SOLUSD","XRPUSD","ADAUSD",
             "DOGEUSD","AVAXUSD","LINKUSD","DOTUSD","LTCUSD","MATICUSD",
             "UNIUSD","ATOMUSD","NEARUSD"],
  Stocks:  ["AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","AMD",
             "NFLX","JPM","GS","BAC","DIS","INTC","COIN"],
  Indices: ["SPY","QQQ","SPX","NDX","DJI","GER40","UK100","JPN225","VIX"],
};

/* Decimal places per symbol (fallback = 5) */
const PAIR_DECIMALS: Record<string, number> = {
  USDJPY:3, EURJPY:3, GBPJPY:3, CADJPY:3, CHFJPY:3,
  USDMXN:4, USDSEK:4,
  XAGUSD:3, AVAXUSD:3, LINKUSD:3, DOTUSD:3, LTCUSD:3,
  MATICUSD:4, UNIUSD:3, ATOMUSD:3, NEARUSD:3,
  XRPUSD:4, ADAUSD:4, DOGEUSD:5,
  BTCUSD:2, ETHUSD:2, BNBUSD:2, SOLUSD:2,
  XAUUSD:2, XPTUSD:2, XPDUSD:2, WTIUSD:2, BRENTUSD:2,
  AAPL:2, MSFT:2, GOOGL:2, AMZN:2, META:2, NVDA:2, TSLA:2, AMD:2,
  NFLX:2, JPM:2, GS:2, BAC:2, DIS:2, INTC:2, COIN:2,
  SPY:2, QQQ:2, SPX:2, NDX:2, DJI:2, GER40:2, UK100:2, JPN225:2, VIX:2,
};

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
  const [category, setCategory] = useState("Forex");
  const [pair, setPair]   = useState("EURUSD");
  const [tf, setTf]       = useState("H1");
  const [mode, setMode]   = useState<Mode>("live");
  const [strategy, setStrategy] = useState("ema_9_21");
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [speed, setSpeed] = useState<Speed>(1);

  const [bars, setBars]       = useState<ChartBar[]>([]);
  const [signals, setSignals] = useState<ChartSignal[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [strategyName, setStrategyName] = useState<string | undefined>();

  const [sseStatus, setSseStatus] = useState<"connecting"|"open"|"closed">("closed");
  const evsRef = useRef<EventSource | null>(null);

  const allBarsRef = useRef<ChartBar[]>([]);
  const [replayIdx, setReplayIdx]     = useState(0);
  const [replayTotal, setReplayTotal] = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [backtesting, setBacktesting] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/chart/strategies`)
      .then(r => r.json())
      .then(d => setStrategies(d.strategies ?? []))
      .catch(() => {});
  }, []);

  /* ── SSE ── */
  const stopSse = useCallback(() => {
    evsRef.current?.close(); evsRef.current = null; setSseStatus("closed");
  }, []);

  const startSse = useCallback((p: string, t: string) => {
    stopSse(); setBars([]); setSseStatus("connecting");
    const es = new EventSource(`${BASE}/api/chart/live?pair=${p}&tf=${t}`);
    evsRef.current = es;
    es.onopen  = () => setSseStatus("open");
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

  /* ── Replay ── */
  const stopPlay = useCallback(() => {
    if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
    setIsPlaying(false);
  }, []);

  const loadReplayBars = useCallback(async (p: string, t: string) => {
    stopPlay(); setBars([]);
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
    if (!allBarsRef.current.length) return;
    stopPlay(); setIsPlaying(true);
    playTimerRef.current = setInterval(playStep, Math.max(60, 600 / speed));
  }, [speed, stopPlay, playStep]);

  const togglePlay = useCallback(() => {
    isPlaying ? stopPlay() : startPlay();
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
    const c = Math.max(0, Math.min(idx, allBarsRef.current.length - 1));
    setReplayIdx(c);
    setBars(allBarsRef.current.slice(0, c + 1));
  }, [stopPlay]);

  /* ── Backtest ── */
  const runBacktest = useCallback(async () => {
    setBacktesting(true); setSignals([]); setMetrics(null);
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

  /* ── Mode switch ── */
  const switchMode = useCallback((m: Mode) => {
    stopSse(); stopPlay(); setSignals([]); setMetrics(null); setStrategyName(undefined); setMode(m);
    if (m === "live")    startSse(pair, tf);
    else if (m === "replay") loadReplayBars(pair, tf);
  }, [stopSse, stopPlay, startSse, loadReplayBars, pair, tf]);

  useEffect(() => { startSse(pair, tf); return stopSse; }, []); // eslint-disable-line

  useEffect(() => {
    if (mode === "live")        startSse(pair, tf);
    else if (mode === "replay") loadReplayBars(pair, tf);
  }, [pair, tf]); // eslint-disable-line

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

  useEffect(() => { if (isPlaying) { stopPlay(); startPlay(); } }, [speed]); // eslint-disable-line

  /* ── Category / pair select ── */
  const pairsInCategory = PAIR_CATEGORIES[category] ?? [];

  const handleCategory = (cat: string) => {
    setCategory(cat);
    const first = PAIR_CATEGORIES[cat]?.[0];
    if (first && first !== pair) setPair(first);
  };

  const decimals = PAIR_DECIMALS[pair] ?? 5;

  const StatusIcon = sseStatus === "open" ? Radio : sseStatus === "connecting" ? RefreshCw : Wifi;
  const statusColor = sseStatus === "open" ? "text-emerald-400" : sseStatus === "connecting" ? "text-yellow-400" : "text-muted-foreground";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-card/50">

        {/* Category tabs */}
        <div className="flex items-center gap-0.5 bg-secondary/60 border border-border rounded-lg p-0.5">
          {Object.keys(PAIR_CATEGORIES).map(cat => (
            <button key={cat} onClick={() => handleCategory(cat)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-all
                ${category === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Pair dropdown */}
        <select value={pair} onChange={e => setPair(e.target.value)}
          className="text-xs font-mono font-semibold bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none cursor-pointer w-[110px]">
          {pairsInCategory.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Timeframe */}
        <div className="flex items-center gap-0.5 bg-secondary/60 border border-border rounded-lg p-0.5">
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`text-[10px] font-mono font-semibold px-1.5 py-1 rounded-md transition-all
                ${tf === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Mode */}
        <div className="flex items-center gap-0.5 bg-secondary/60 border border-border rounded-lg p-0.5">
          {(["live","replay","backtest"] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-all
                ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "live" ? "🔴 Live" : m === "replay" ? "⏮ Replay" : "⚡ Backtest"}
            </button>
          ))}
        </div>

        <div className="flex-1" />

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

        {/* Chart */}
        <div className="flex-1 min-w-0 relative bg-[#080c15]">
          {bars.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <TrendingUp className="w-10 h-10 opacity-20" />
              <p className="text-sm">{sseStatus === "connecting" ? "Connecting…" : "Loading candles…"}</p>
            </div>
          ) : (
            <div className="absolute inset-0 p-1">
              <CandlestickChart
                bars={bars}
                signals={mode === "backtest" ? signals : []}
                replayIndex={mode === "replay" ? replayIdx : undefined}
                decimals={decimals}
              />
            </div>
          )}

          <div className="absolute top-3 left-3 pointer-events-none select-none">
            <p className="text-sm font-bold text-white/40 font-mono">{pair}</p>
            <p className="text-[10px] text-white/25 font-mono">{tf} · {category}</p>
          </div>

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
        <div className="w-60 shrink-0 border-l border-border flex flex-col overflow-y-auto bg-card/30">
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

          {mode === "replay" && (
            <div className="p-3 border-b border-border space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Speed</p>
              <div className="flex gap-1 flex-wrap">
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`flex-1 min-w-[32px] py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all
                      ${speed === s ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          )}

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
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-center text-sm font-semibold text-foreground">Bar {replayIdx + 1} / {replayTotal}</p>
                {allBarsRef.current[replayIdx] && (
                  <div className="rounded-xl p-3 bg-secondary/30 border border-border space-y-1.5">
                    {[["O",allBarsRef.current[replayIdx].open],["H",allBarsRef.current[replayIdx].high],
                      ["L",allBarsRef.current[replayIdx].low],["C",allBarsRef.current[replayIdx].close]].map(([k,v]) => (
                      <div key={String(k)} className="flex justify-between">
                        <span className={`text-[10px] font-mono ${k==="H"?"text-emerald-400":k==="L"?"text-red-400":"text-muted-foreground"}`}>{k}</span>
                        <span className="text-[10px] font-mono text-foreground">{Number(v).toFixed(decimals)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-0.5 border-t border-border">
                      <span className="text-[10px] font-mono text-muted-foreground">Vol</span>
                      <span className="text-[10px] font-mono text-foreground">{allBarsRef.current[replayIdx].volume?.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground text-center opacity-60">← → step  •  Space play/pause</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Replay bar ── */}
      {mode === "replay" && (
        <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3 space-y-2">
          <div className="relative h-2 bg-secondary/60 rounded-full cursor-pointer group"
            onClick={e => {
              if (!replayTotal) return;
              const r = e.currentTarget.getBoundingClientRect();
              seekTo(Math.round(((e.clientX - r.left) / r.width) * (replayTotal - 1)));
            }}>
            <div className="absolute left-0 top-0 h-full rounded-full bg-primary/80"
              style={{ width: replayTotal > 1 ? `${(replayIdx / (replayTotal - 1)) * 100}%` : "0%" }} />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: replayTotal > 1 ? `${(replayIdx / (replayTotal - 1)) * 100}%` : "0%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{replayIdx + 1} / {replayTotal}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => seekTo(0)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><SkipBack className="w-4 h-4" /></button>
              <button onClick={() => stepBy(-1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={togglePlay} className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-colors">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => stepBy(1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => seekTo(replayTotal - 1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><SkipForward className="w-4 h-4" /></button>
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
