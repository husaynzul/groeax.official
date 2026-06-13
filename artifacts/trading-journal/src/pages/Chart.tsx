import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, TrendingUp, Wifi, Zap, Radio,
  ShoppingCart, X, Settings2, ChevronDown,
  MousePointer2, Minus, Square, CircleDot, Type,
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  PanelRightClose, PanelRightOpen,
} from "lucide-react";
import CandlestickChart, {
  type ChartBar,
  type ChartSignal,
  type ChartPriceLines,
  type ChartIndicators,
} from "@/components/chart/CandlestickChart";
import MetricsPanel from "@/components/chart/MetricsPanel";
import OrderPanel, { type PlacedOrder } from "@/components/chart/OrderPanel";
import { useTradeStore } from "@/store/tradeStore";
import type { Trade } from "@/types";

/* ── Pair catalogue ─────────────────────────────────────────────── */
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

const PAIR_DECIMALS: Record<string, number> = {
  USDJPY:3,EURJPY:3,GBPJPY:3,CADJPY:3,CHFJPY:3,USDMXN:4,USDSEK:4,
  XAGUSD:3,AVAXUSD:3,LINKUSD:3,DOTUSD:3,MATICUSD:4,UNIUSD:3,ATOMUSD:3,NEARUSD:3,
  XRPUSD:4,ADAUSD:4,DOGEUSD:5,
  BTCUSD:2,ETHUSD:2,BNBUSD:2,SOLUSD:2,LTCUSD:2,
  XAUUSD:2,XPTUSD:2,XPDUSD:2,WTIUSD:2,BRENTUSD:2,
  AAPL:2,MSFT:2,GOOGL:2,AMZN:2,META:2,NVDA:2,TSLA:2,AMD:2,
  NFLX:2,JPM:2,GS:2,BAC:2,DIS:2,INTC:2,COIN:2,
  SPY:2,QQQ:2,SPX:2,NDX:2,DJI:2,GER40:2,UK100:2,JPN225:2,VIX:2,
};

const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1"];
const SPEEDS     = [0.5, 1, 2, 4, 8] as const;
type  Speed = (typeof SPEEDS)[number];
type  Mode  = "live" | "replay" | "backtest";
type  RightTab = "order" | "strategy" | "replay";

interface Metrics {
  totalTrades:number;wins:number;losses:number;winRate:number;
  totalPnLPips:number;totalPnLUSD:number;expectancy:number;
  maxDrawdownUSD:number;profitFactor:number;avgWinPips:number;avgLossPips:number;
}
interface StrategyMeta { id:string; name:string; description:string }

import { getApiBase } from "@/lib/apiBase";
const BASE = getApiBase();

/* ── Drawing tool list ──────────────────────────────────────────── */
const DRAW_TOOLS = [
  { icon: MousePointer2, label: "Cursor",     id: "cursor" },
  { icon: Minus,         label: "H. Line",    id: "hline"  },
  { icon: TrendingUp,    label: "Trend Line", id: "trend"  },
  { icon: Square,        label: "Rectangle",  id: "rect"   },
  { icon: CircleDot,     label: "Fibonacci",  id: "fib"    },
  { icon: Type,          label: "Text",       id: "text"   },
];

/* ── Default indicators ─────────────────────────────────────────── */
const DEFAULT_INDICATORS: ChartIndicators = {
  ema9:   true,
  ema21:  true,
  ema50:  false,
  rsi:    true,
  volume: true,
};

export default function ChartPage() {
  const { addTrade } = useTradeStore();

  const [category,  setCategory]  = useState("Crypto");
  const [pair,      setPair]      = useState("BTCUSD");
  const [tf,        setTf]        = useState("H1");
  const [mode,      setMode]      = useState<Mode>("live");
  const [strategy,  setStrategy]  = useState("ema_9_21");
  const [strategies,setStrategies]= useState<StrategyMeta[]>([]);
  const [speed,     setSpeed]     = useState<Speed>(1);
  const [rightTab,  setRightTab]  = useState<RightTab>("order");
  const [drawTool,  setDrawTool]  = useState("cursor");
  const [rightOpen, setRightOpen] = useState(true);
  const [showIndDD, setShowIndDD] = useState(false);
  const [indicators,setIndicators]= useState<ChartIndicators>(DEFAULT_INDICATORS);

  const [bars,         setBars]         = useState<ChartBar[]>([]);
  const [latestBar,    setLatestBar]    = useState<ChartBar | undefined>();
  const [signals,      setSignals]      = useState<ChartSignal[]>([]);
  const [metrics,      setMetrics]      = useState<Metrics | null>(null);
  const [strategyName, setStrategyName] = useState<string | undefined>();

  const [sseStatus,    setSseStatus]  = useState<"connecting"|"open"|"closed">("closed");
  const [sseSource,    setSseSource]  = useState<"binance"|"yahoo"|"simulated"|"">("");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceLines,   setPriceLines]   = useState<ChartPriceLines>({});
  const [openOrdersCount, setOpenOrdersCount] = useState(0);
  const [backtesting,  setBacktesting]  = useState(false);

  const evsRef       = useRef<EventSource | null>(null);
  const allBarsRef   = useRef<ChartBar[]>([]);
  const [replayIdx,   setReplayIdx]   = useState(0);
  const [replayTotal, setReplayTotal] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const playTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/chart/strategies`)
      .then(r => r.json())
      .then(d => setStrategies(d.strategies ?? []))
      .catch(() => {});
  }, []);

  /* ── SSE ─────────────────────────────────────────────────────── */
  const stopSse = useCallback(() => {
    evsRef.current?.close(); evsRef.current = null; setSseStatus("closed");
  }, []);

  const startSse = useCallback((p: string, t: string) => {
    stopSse(); setBars([]); setLatestBar(undefined);
    setSseStatus("connecting"); setSseSource("");
    const es = new EventSource(`${BASE}/api/chart/live?pair=${p}&tf=${t}`);
    evsRef.current = es;
    es.onopen  = () => setSseStatus("open");
    es.onerror = () => setSseStatus("closed");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type:string; bars?:ChartBar[]; bar?:ChartBar; source?:string };
        if (msg.source) setSseSource(msg.source as "binance"|"yahoo"|"simulated");
        if (msg.type === "history" && msg.bars) {
          setBars(msg.bars);
          const last = msg.bars[msg.bars.length - 1];
          if (last) { setLatestBar(last); setCurrentPrice(last.close); }
        }
        if ((msg.type === "candle" || msg.type === "tick") && msg.bar) {
          setLatestBar(msg.bar); setCurrentPrice(msg.bar.close);
        }
      } catch { /**/ }
    };
  }, [stopSse]);

  /* ── Replay ──────────────────────────────────────────────────── */
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
    setReplayIdx(startIdx); setReplayTotal(allBarsRef.current.length);
    setBars(allBarsRef.current.slice(0, startIdx + 1));
    const last = allBarsRef.current[startIdx];
    if (last) setCurrentPrice(last.close);
  }, [stopPlay]);

  const playStep = useCallback(() => {
    setReplayIdx(prev => {
      const next = prev + 1;
      if (next >= allBarsRef.current.length) { stopPlay(); return prev; }
      setBars(allBarsRef.current.slice(0, next + 1));
      const bar = allBarsRef.current[next];
      if (bar) setCurrentPrice(bar.close);
      return next;
    });
  }, [stopPlay]);

  const startPlay = useCallback(() => {
    if (!allBarsRef.current.length) return;
    stopPlay(); setIsPlaying(true);
    playTimerRef.current = setInterval(playStep, Math.max(60, 600 / speed));
  }, [speed, stopPlay, playStep]);

  const togglePlay  = useCallback(() => { isPlaying ? stopPlay() : startPlay(); }, [isPlaying, stopPlay, startPlay]);
  const stepBy      = useCallback((delta: number) => {
    stopPlay();
    setReplayIdx(prev => {
      const next = Math.max(0, Math.min(prev + delta, allBarsRef.current.length - 1));
      setBars(allBarsRef.current.slice(0, next + 1));
      const bar = allBarsRef.current[next];
      if (bar) setCurrentPrice(bar.close);
      return next;
    });
  }, [stopPlay]);

  const seekTo = useCallback((idx: number) => {
    stopPlay();
    const c = Math.max(0, Math.min(idx, allBarsRef.current.length - 1));
    setReplayIdx(c); setBars(allBarsRef.current.slice(0, c + 1));
    const bar = allBarsRef.current[c];
    if (bar) setCurrentPrice(bar.close);
  }, [stopPlay]);

  /* ── Backtest ────────────────────────────────────────────────── */
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
    } catch { /**/ }
    setBacktesting(false);
  }, [pair, tf, strategy]);

  /* ── Mode switch ─────────────────────────────────────────────── */
  const switchMode = useCallback((m: Mode) => {
    stopSse(); stopPlay(); setSignals([]); setMetrics(null); setStrategyName(undefined); setMode(m);
    if (m === "live")        startSse(pair, tf);
    else if (m === "replay") loadReplayBars(pair, tf);
  }, [stopSse, stopPlay, startSse, loadReplayBars, pair, tf]);

  useEffect(() => { startSse(pair, tf); return stopSse; }, []); // eslint-disable-line
  useEffect(() => {
    if (mode === "live")        startSse(pair, tf);
    else if (mode === "replay") loadReplayBars(pair, tf);
    setPriceLines({});
  }, [pair, tf]); // eslint-disable-line

  // Keyboard shortcuts for replay
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

  /* ── Order handling ──────────────────────────────────────────── */
  const handleOrder = useCallback((order: PlacedOrder) => {
    const trade: Trade = {
      id:         `chart_order_${Date.now()}`,
      pair, direction: order.direction,
      entryPrice: order.entryPrice, stopLoss: order.sl ?? 0, takeProfit: order.tp ?? 0,
      lotSize:    order.lotSize, date: new Date().toISOString(),
      notes:      `${order.orderType} order placed from chart`,
      outcome:    undefined, netProfit: 0, netLoss: 0,
      rr: order.sl && order.tp
        ? Math.abs(order.tp - order.entryPrice) / Math.abs(order.entryPrice - order.sl) : 0,
      strategy: "Manual",
    };
    addTrade(trade);
    setPriceLines({ entry: order.entryPrice, sl: order.sl, tp: order.tp });
    setOpenOrdersCount(c => c + 1);
  }, [pair, addTrade]);

  /* ── Derived ─────────────────────────────────────────────────── */
  const pairsInCategory = PAIR_CATEGORIES[category] ?? [];
  const handleCategory  = (cat: string) => {
    setCategory(cat);
    const first = PAIR_CATEGORIES[cat]?.[0];
    if (first && first !== pair) setPair(first);
  };

  const decimals      = PAIR_DECIMALS[pair] ?? 5;
  const isBinanceLive = sseSource === "binance"   && sseStatus === "open";
  const isYahooLive   = sseSource === "yahoo"     && sseStatus === "open";
  const isSimLive     = sseSource === "simulated" && sseStatus === "open";

  const toggleIndicator = (key: keyof ChartIndicators) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── Replay controls bar (embedded in right panel) ───────────── */
  const ReplayControls = () => (
    <div className="p-3 space-y-3">
      {/* Scrubber */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground font-mono">Bar {replayIdx+1} / {replayTotal}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{speed}×</span>
        </div>
        <div className="relative h-1.5 bg-secondary/60 rounded-full cursor-pointer"
          onClick={e => {
            if (!replayTotal) return;
            const r = e.currentTarget.getBoundingClientRect();
            seekTo(Math.round(((e.clientX - r.left) / r.width) * (replayTotal - 1)));
          }}>
          <div className="absolute left-0 top-0 h-full rounded-full bg-primary/80 transition-all"
            style={{ width: replayTotal > 1 ? `${(replayIdx / (replayTotal - 1)) * 100}%` : "0%" }} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => seekTo(0)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => stepBy(-1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={togglePlay} className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-colors">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={() => stepBy(1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => seekTo(replayTotal - 1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Speed */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Speed</p>
        <div className="flex gap-1">
          {SPEEDS.map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all
                ${speed === s ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Current bar OHLC */}
      {allBarsRef.current[replayIdx] && (
        <div className="rounded-xl p-3 bg-secondary/30 border border-border space-y-1.5">
          {[["O",allBarsRef.current[replayIdx].open],["H",allBarsRef.current[replayIdx].high],
            ["L",allBarsRef.current[replayIdx].low], ["C",allBarsRef.current[replayIdx].close]].map(([k,v]) => (
            <div key={String(k)} className="flex justify-between">
              <span className={`text-[10px] font-mono ${k==="H"?"text-emerald-400":k==="L"?"text-red-400":"text-muted-foreground"}`}>{k}</span>
              <span className="text-[10px] font-mono text-foreground">{Number(v).toFixed(decimals)}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => { setMode("replay"); void loadReplayBars(pair, tf); }}
        className="w-full py-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-xs font-semibold text-muted-foreground transition-colors">
        ⏮ Reload Replay
      </button>
      <p className="text-[10px] text-muted-foreground text-center opacity-60">← → step  •  Space play/pause</p>
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#080c15]">

      {/* ━━━ TOP TOOLBAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-white/[0.06]
        shrink-0 bg-[#0a0f1a]/90 backdrop-blur-sm">

        {/* Category tabs */}
        <div className="flex items-center gap-px bg-white/5 border border-white/8 rounded-lg p-0.5">
          {Object.keys(PAIR_CATEGORIES).map(cat => (
            <button key={cat} onClick={() => handleCategory(cat)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-all whitespace-nowrap
                ${category === cat ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/80"}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Pair selector */}
        <select value={pair} onChange={e => setPair(e.target.value)}
          className="text-[11px] font-mono font-bold bg-white/5 border border-white/8 rounded-lg
            px-2.5 py-1.5 text-white focus:outline-none cursor-pointer w-[100px]
            hover:bg-white/8 transition-colors">
          {pairsInCategory.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="w-px h-5 bg-white/10 mx-0.5" />

        {/* Timeframe buttons */}
        <div className="flex items-center gap-px bg-white/5 border border-white/8 rounded-lg p-0.5">
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md transition-all
                ${tf === t ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/80"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10 mx-0.5" />

        {/* Indicators dropdown */}
        <div className="relative">
          <button onClick={() => setShowIndDD(v => !v)}
            className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5
              rounded-lg border transition-all
              ${showIndDD
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-white/5 border-white/8 text-white/50 hover:text-white/80 hover:bg-white/8"}`}>
            <Settings2 className="w-3 h-3" />
            Indicators
            <ChevronDown className={`w-3 h-3 transition-transform ${showIndDD ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showIndDD && (
              <motion.div
                initial={{ opacity:0, y:-4, scale:0.97 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-4, scale:0.97 }}
                transition={{ duration:0.15 }}
                className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-white/10
                  bg-[#0f1520]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-1.5 space-y-px">
                  {(
                    [
                      { key: "ema9",   label: "EMA 9",    color: "text-amber-400"  },
                      { key: "ema21",  label: "EMA 21",   color: "text-cyan-400"   },
                      { key: "ema50",  label: "EMA 50",   color: "text-violet-400" },
                      { key: "rsi",    label: "RSI 14",   color: "text-purple-400" },
                      { key: "volume", label: "Volume",   color: "text-white/40"   },
                    ] as const
                  ).map(({ key, label, color }) => (
                    <button key={key} onClick={() => toggleIndicator(key)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                        hover:bg-white/5 transition-colors group">
                      <span className={`text-xs font-semibold ${color}`}>{label}</span>
                      <div className={`w-8 h-4 rounded-full transition-all ${
                        indicators[key] ? "bg-primary" : "bg-white/10"
                      }`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm m-0.5 transition-transform ${
                          indicators[key] ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-5 bg-white/10 mx-0.5" />

        {/* Mode buttons */}
        <div className="flex items-center gap-px bg-white/5 border border-white/8 rounded-lg p-0.5">
          {(["live","replay","backtest"] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-all whitespace-nowrap
                ${mode === m ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/80"}`}>
              {m === "live" ? "🔴 Live" : m === "replay" ? "⏮ Replay" : "⚡ Backtest"}
            </button>
          ))}
        </div>

        {/* Replay mini-controls in toolbar */}
        {mode === "replay" && (
          <div className="flex items-center gap-1">
            <button onClick={() => stepBy(-1)} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={togglePlay} className="p-1 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors">
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button onClick={() => stepBy(1)} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-white/30 ml-1">{replayIdx+1}/{replayTotal}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Data source badge */}
        {mode === "live" && (
          <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider
            rounded-full px-2.5 py-1 border ${
            isBinanceLive ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
            isYahooLive   ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
            isSimLive     ? "text-blue-400 border-blue-500/30 bg-blue-500/10" :
            "text-white/30 border-white/10"
          }`}>
            {isBinanceLive ? <><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />Binance</> :
             isYahooLive   ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Yahoo</> :
             isSimLive     ? <><Radio className="w-3 h-3" />Sim</> :
             <><RefreshCw className="w-3 h-3 animate-spin" />…</>}
          </div>
        )}

        {/* Live price */}
        {currentPrice > 0 && (
          <span className="text-sm font-mono font-bold text-white tabular-nums min-w-[80px] text-right">
            {currentPrice.toFixed(decimals)}
          </span>
        )}

        {/* Clear price lines */}
        {(priceLines.entry || priceLines.sl || priceLines.tp) && (
          <button onClick={() => setPriceLines({})} title="Clear order lines"
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Refresh */}
        <button onClick={() => switchMode(mode)}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Toggle right panel */}
        <button onClick={() => setRightOpen(v => !v)}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors">
          {rightOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ━━━ MAIN AREA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-1 overflow-hidden min-h-0" onClick={() => setShowIndDD(false)}>

        {/* ── Left drawing tools strip ── */}
        <div className="w-10 shrink-0 flex flex-col items-center py-2 gap-0.5
          border-r border-white/[0.06] bg-[#0a0f1a]/70">
          {DRAW_TOOLS.map(({ icon: Icon, label, id }) => (
            <button key={id} title={label} onClick={() => setDrawTool(id)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all
                ${drawTool === id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-white/30 hover:text-white/70 hover:bg-white/5"}`}>
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* ── Chart area ── */}
        <div className="flex-1 min-w-0 relative bg-[#080c15] overflow-hidden">

          {bars.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-sm text-white/30">
                {sseStatus === "connecting" ? "Connecting to market data…" : "Loading candles…"}
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 p-0">
              <CandlestickChart
                bars={bars}
                latestBar={mode === "live" ? latestBar : undefined}
                signals={mode === "backtest" ? signals : []}
                replayIndex={mode === "replay" ? replayIdx : undefined}
                decimals={decimals}
                priceLines={priceLines}
                indicators={indicators}
              />
            </div>
          )}

          {/* OHLCV overlay — top-left like TradingView */}
          {bars.length > 0 && (
            <div className="absolute top-2 left-2 pointer-events-none select-none">
              <div className="flex items-baseline gap-0.5">
                <span className="text-[13px] font-mono font-bold text-white/80">{pair}</span>
                <span className="text-[10px] text-white/30 ml-1 font-mono">{tf}</span>
                <span className="text-[10px] text-white/20 font-mono">{category}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {indicators.ema9  && <span className="text-[9px] font-mono text-amber-400/70">EMA 9</span>}
                {indicators.ema21 && <span className="text-[9px] font-mono text-cyan-400/70">EMA 21</span>}
                {indicators.ema50 && <span className="text-[9px] font-mono text-violet-400/70">EMA 50</span>}
                {indicators.rsi   && <span className="text-[9px] font-mono text-purple-400/70">RSI 14</span>}
              </div>
            </div>
          )}

          {/* Live badge */}
          {mode === "live" && isBinanceLive && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 pointer-events-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
              </span>
              <span className="text-[9px] font-bold text-yellow-400/80 uppercase tracking-widest">Binance Live</span>
            </div>
          )}

          {/* Open orders badge */}
          {openOrdersCount > 0 && (
            <div className="absolute bottom-3 left-2 flex items-center gap-1.5 px-2 py-1
              rounded-lg bg-primary/15 border border-primary/25 pointer-events-none">
              <ShoppingCart className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-primary font-semibold">
                {openOrdersCount} order{openOrdersCount > 1 ? "s" : ""} active
              </span>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden bg-[#0a0f1a]/80"
            >
              {/* Tab bar */}
              <div className="flex border-b border-white/[0.06] shrink-0">
                {([
                  { id: "order",    label: "Order",    icon: ShoppingCart },
                  { id: "strategy", label: mode === "backtest" ? "Backtest" : "Strategy", icon: Zap },
                  { id: "replay",   label: "Replay",   icon: Settings2 },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setRightTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5
                      text-[10px] font-semibold transition-colors border-b-2 ${
                      rightTab === id
                        ? "border-primary text-white"
                        : "border-transparent text-white/35 hover:text-white/60"
                    }`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {rightTab === "order" && (
                  <OrderPanel
                    currentPrice={currentPrice}
                    pair={pair}
                    decimals={decimals}
                    onOrder={handleOrder}
                  />
                )}

                {rightTab === "strategy" && (
                  <div className="p-3 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Strategy</span>
                      </div>
                      <select value={strategy} onChange={e => setStrategy(e.target.value)}
                        className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5
                          text-white/80 focus:outline-none cursor-pointer">
                        {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {strategies.find(s => s.id === strategy) && (
                        <p className="text-[10px] text-white/35 leading-snug">
                          {strategies.find(s => s.id === strategy)?.description}
                        </p>
                      )}
                    </div>
                    <button onClick={() => { setMode("backtest"); void runBacktest(); }}
                      disabled={backtesting}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg
                        bg-primary text-primary-foreground text-xs font-semibold
                        hover:bg-primary/90 transition-colors disabled:opacity-50">
                      <Zap className="w-3.5 h-3.5" />
                      {backtesting ? "Running…" : "Run Backtest"}
                    </button>

                    {mode === "backtest" && metrics && (
                      <>
                        <div className="w-full h-px bg-white/[0.06]" />
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Results</p>
                        <MetricsPanel metrics={metrics} strategyName={strategyName} pair={pair} tf={tf} />
                      </>
                    )}

                    {mode === "live" && (
                      <div className="text-center text-white/30 text-xs pt-4 space-y-1.5">
                        <Wifi className="w-7 h-7 mx-auto opacity-20" />
                        <p>{bars.length} candles loaded</p>
                        <p className="text-[10px] opacity-50">Switch to Backtest mode to run strategies</p>
                      </div>
                    )}
                  </div>
                )}

                {rightTab === "replay" && <ReplayControls />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
