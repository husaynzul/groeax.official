import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  RefreshCw, Settings2, TrendingUp, Wifi, Zap, Radio,
  ShoppingCart, X,
} from "lucide-react";
import CandlestickChart, {
  type ChartBar,
  type ChartSignal,
  type ChartPriceLines,
} from "@/components/chart/CandlestickChart";
import MetricsPanel from "@/components/chart/MetricsPanel";
import OrderPanel, { type PlacedOrder } from "@/components/chart/OrderPanel";
import { useTradeStore } from "@/store/tradeStore";
import type { Trade } from "@/types";

/* ── Pair catalogue ─────────────────────────────────────────────────── */
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
  USDJPY:3, EURJPY:3, GBPJPY:3, CADJPY:3, CHFJPY:3, USDMXN:4, USDSEK:4,
  XAGUSD:3, AVAXUSD:3, LINKUSD:3, DOTUSD:3, MATICUSD:4, UNIUSD:3, ATOMUSD:3, NEARUSD:3,
  XRPUSD:4, ADAUSD:4, DOGEUSD:5,
  BTCUSD:2, ETHUSD:2, BNBUSD:2, SOLUSD:2, LTCUSD:2,
  XAUUSD:2, XPTUSD:2, XPDUSD:2, WTIUSD:2, BRENTUSD:2,
  AAPL:2, MSFT:2, GOOGL:2, AMZN:2, META:2, NVDA:2, TSLA:2, AMD:2,
  NFLX:2, JPM:2, GS:2, BAC:2, DIS:2, INTC:2, COIN:2,
  SPY:2, QQQ:2, SPX:2, NDX:2, DJI:2, GER40:2, UK100:2, JPN225:2, VIX:2,
};

const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1"];
const SPEEDS     = [0.5, 1, 2, 4, 8] as const;
type  Speed = (typeof SPEEDS)[number];
type  Mode  = "live" | "replay" | "backtest";
type  RightTab = "order" | "strategy" | "replay";

interface Metrics {
  totalTrades: number; wins: number; losses: number; winRate: number;
  totalPnLPips: number; totalPnLUSD: number; expectancy: number;
  maxDrawdownUSD: number; profitFactor: number; avgWinPips: number; avgLossPips: number;
}
interface StrategyMeta { id: string; name: string; description: string }

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

export default function ChartPage() {
  const { addTrade } = useTradeStore();

  const [category, setCategory] = useState("Crypto");
  const [pair,     setPair]     = useState("BTCUSD");
  const [tf,       setTf]       = useState("H1");
  const [mode,     setMode]     = useState<Mode>("live");
  const [strategy, setStrategy] = useState("ema_9_21");
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [speed,    setSpeed]    = useState<Speed>(1);
  const [rightTab, setRightTab] = useState<RightTab>("order");

  const [bars,      setBars]      = useState<ChartBar[]>([]);
  const [latestBar, setLatestBar] = useState<ChartBar | undefined>();
  const [signals,   setSignals]   = useState<ChartSignal[]>([]);
  const [metrics,   setMetrics]   = useState<Metrics | null>(null);
  const [strategyName, setStrategyName] = useState<string | undefined>();

  const [sseStatus, setSseStatus]   = useState<"connecting"|"open"|"closed">("closed");
  const [sseSource, setSseSource]   = useState<"binance"|"yahoo"|"simulated"|"">("");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceLines, setPriceLines] = useState<ChartPriceLines>({});
  const [openOrdersCount, setOpenOrdersCount] = useState(0);

  const evsRef = useRef<EventSource | null>(null);

  const allBarsRef    = useRef<ChartBar[]>([]);
  const [replayIdx,   setReplayIdx]   = useState(0);
  const [replayTotal, setReplayTotal] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const playTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [backtesting, setBacktesting] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/chart/strategies`)
      .then(r => r.json())
      .then(d => setStrategies(d.strategies ?? []))
      .catch(() => {});
  }, []);

  /* ── SSE ────────────────────────────────────────────────────────── */
  const stopSse = useCallback(() => {
    evsRef.current?.close(); evsRef.current = null; setSseStatus("closed");
  }, []);

  const startSse = useCallback((p: string, t: string) => {
    stopSse();
    setBars([]); setLatestBar(undefined);
    setSseStatus("connecting"); setSseSource("");
    const es = new EventSource(`${BASE}/api/chart/live?pair=${p}&tf=${t}`);
    evsRef.current = es;
    es.onopen  = () => setSseStatus("open");
    es.onerror = () => setSseStatus("closed");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          type: string; bars?: ChartBar[]; bar?: ChartBar; source?: string;
        };
        if (msg.source) setSseSource(msg.source as "binance" | "yahoo" | "simulated");

        if (msg.type === "history" && msg.bars) {
          // Full history — triggers setData() in CandlestickChart
          setBars(msg.bars);
          const last = msg.bars[msg.bars.length - 1];
          if (last) { setLatestBar(last); setCurrentPrice(last.close); }
        }

        if ((msg.type === "candle" || msg.type === "tick") && msg.bar) {
          // Live tick — triggers series.update() only, no setData()
          setLatestBar(msg.bar);
          setCurrentPrice(msg.bar.close);
        }
      } catch { /* ignore */ }
    };
  }, [stopSse]);

  /* ── Replay ─────────────────────────────────────────────────────── */
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

  const togglePlay = useCallback(() => {
    isPlaying ? stopPlay() : startPlay();
  }, [isPlaying, stopPlay, startPlay]);

  const stepBy = useCallback((delta: number) => {
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
    setReplayIdx(c);
    setBars(allBarsRef.current.slice(0, c + 1));
    const bar = allBarsRef.current[c];
    if (bar) setCurrentPrice(bar.close);
  }, [stopPlay]);

  /* ── Backtest ────────────────────────────────────────────────────── */
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

  /* ── Mode switch ─────────────────────────────────────────────────── */
  const switchMode = useCallback((m: Mode) => {
    stopSse(); stopPlay(); setSignals([]); setMetrics(null); setStrategyName(undefined); setMode(m);
    if (m === "live")    startSse(pair, tf);
    else if (m === "replay") loadReplayBars(pair, tf);
  }, [stopSse, stopPlay, startSse, loadReplayBars, pair, tf]);

  // Initial mount
  useEffect(() => { startSse(pair, tf); return stopSse; }, []); // eslint-disable-line

  // Pair/TF change
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

  /* ── Order handling ──────────────────────────────────────────────── */
  const handleOrder = useCallback((order: PlacedOrder) => {
    const trade: Trade = {
      id:          `chart_order_${Date.now()}`,
      pair,
      direction:   order.direction,
      entryPrice:  order.entryPrice,
      stopLoss:    order.sl ?? 0,
      takeProfit:  order.tp ?? 0,
      lotSize:     order.lotSize,
      date:        new Date().toISOString(),
      notes:       `${order.orderType} order placed from chart`,
      outcome:     undefined,
      netProfit:   0,
      netLoss:     0,
      rr:          order.sl && order.tp
        ? Math.abs(order.tp - order.entryPrice) / Math.abs(order.entryPrice - order.sl)
        : 0,
      strategy: "Manual",
    };
    addTrade(trade);
    setPriceLines({ entry: order.entryPrice, sl: order.sl, tp: order.tp });
    setOpenOrdersCount(c => c + 1);
  }, [pair, addTrade]);

  const clearPriceLines = () => setPriceLines({});

  /* ── Category / pair select ─────────────────────────────────────── */
  const pairsInCategory = PAIR_CATEGORIES[category] ?? [];

  const handleCategory = (cat: string) => {
    setCategory(cat);
    const first = PAIR_CATEGORIES[cat]?.[0];
    if (first && first !== pair) setPair(first);
  };

  const decimals = PAIR_DECIMALS[pair] ?? 5;

  const isBinanceLive = sseSource === "binance" && sseStatus === "open";
  const isYahooLive   = sseSource === "yahoo"   && sseStatus === "open";
  const isSimLive     = sseSource === "simulated" && sseStatus === "open";

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

        {/* Data source badge */}
        {mode === "live" && (
          <div className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border ${
            isBinanceLive
              ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
              : isYahooLive
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : isSimLive
              ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
              : "text-muted-foreground border-border"
          }`}>
            {isBinanceLive ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" /> Binance Live</>
            ) : isYahooLive ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Yahoo Live</>
            ) : isSimLive ? (
              <><Radio className="w-3 h-3" /> Simulated</>
            ) : (
              <><RefreshCw className="w-3 h-3 animate-spin" /> Connecting</>
            )}
          </div>
        )}

        {/* Current price */}
        {currentPrice > 0 && (
          <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
            {currentPrice.toFixed(decimals)}
          </span>
        )}

        {/* Clear order lines */}
        {(priceLines.entry || priceLines.sl || priceLines.tp) && (
          <button onClick={clearPriceLines}
            title="Clear order lines"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button onClick={() => switchMode(mode)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
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
              <p className="text-sm">{sseStatus === "connecting" ? "Connecting to market data…" : "Loading candles…"}</p>
            </div>
          ) : (
            <div className="absolute inset-0 p-1">
              <CandlestickChart
                bars={bars}
                latestBar={mode === "live" ? latestBar : undefined}
                signals={mode === "backtest" ? signals : []}
                replayIndex={mode === "replay" ? replayIdx : undefined}
                decimals={decimals}
                priceLines={priceLines}
              />
            </div>
          )}

          {/* Pair label overlay */}
          <div className="absolute top-3 left-3 pointer-events-none select-none">
            <p className="text-sm font-bold text-white/40 font-mono">{pair}</p>
            <p className="text-[10px] text-white/25 font-mono">{tf} · {category}</p>
          </div>

          {/* LIVE badge */}
          {mode === "live" && isBinanceLive && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
              </span>
              <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-widest">BINANCE LIVE</span>
            </div>
          )}
          {mode === "live" && isSimLive && (
            <div className="absolute top-3 right-3 pointer-events-none">
              <span className="text-[9px] font-bold text-blue-400/60 uppercase tracking-widest">SIM</span>
            </div>
          )}

          {/* Open orders badge */}
          {openOrdersCount > 0 && (
            <div className="absolute bottom-14 left-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/20 border border-primary/30 pointer-events-none">
              <ShoppingCart className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-primary font-semibold">{openOrdersCount} order{openOrdersCount > 1 ? "s" : ""} placed</span>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="w-64 shrink-0 border-l border-border flex flex-col overflow-hidden bg-card/30">

          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            {([
              { id: "order",    label: "Order",    icon: ShoppingCart },
              { id: "strategy", label: mode === "backtest" ? "Backtest" : "Strategy", icon: Zap },
              { id: "replay",   label: "Replay",   icon: Settings2 },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setRightTab(id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors border-b-2 ${
                  rightTab === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ORDER TAB */}
            {rightTab === "order" && (
              <OrderPanel
                currentPrice={currentPrice}
                pair={pair}
                decimals={decimals}
                onOrder={handleOrder}
              />
            )}

            {/* STRATEGY / BACKTEST TAB */}
            {rightTab === "strategy" && (
              <div className="p-3 space-y-3">
                <div className="space-y-1.5">
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
                </div>
                <button onClick={() => { setMode("backtest"); runBacktest(); }}
                  disabled={backtesting}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Zap className="w-3.5 h-3.5" />
                  {backtesting ? "Running…" : "Run Backtest"}
                </button>

                {mode === "backtest" && (
                  <>
                    <div className="w-full h-px bg-border" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Results</p>
                    <MetricsPanel metrics={metrics} strategyName={strategyName} pair={pair} tf={tf} />
                  </>
                )}

                {mode === "live" && (
                  <div className="text-center text-muted-foreground text-xs pt-4 space-y-1.5">
                    <Wifi className="w-7 h-7 mx-auto opacity-20" />
                    <p>{bars.length} candles loaded</p>
                    <p className="text-[10px] opacity-50">Switch to Backtest mode to run strategies</p>
                  </div>
                )}
              </div>
            )}

            {/* REPLAY TAB */}
            {rightTab === "replay" && (
              <div className="p-3 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Replay Speed</p>
                <div className="flex gap-1 flex-wrap">
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`flex-1 min-w-[32px] py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all
                        ${speed === s ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                      {s}×
                    </button>
                  ))}
                </div>
                <button onClick={() => { setMode("replay"); loadReplayBars(pair, tf); }}
                  className="w-full py-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-xs font-semibold text-muted-foreground transition-colors">
                  ⏮ Load Replay
                </button>

                {mode === "replay" && allBarsRef.current[replayIdx] && (
                  <div className="rounded-xl p-3 bg-secondary/30 border border-border space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-semibold">Bar {replayIdx + 1} / {replayTotal}</p>
                    {[["O",allBarsRef.current[replayIdx].open],["H",allBarsRef.current[replayIdx].high],
                      ["L",allBarsRef.current[replayIdx].low],["C",allBarsRef.current[replayIdx].close]].map(([k,v]) => (
                      <div key={String(k)} className="flex justify-between">
                        <span className={`text-[10px] font-mono ${k==="H"?"text-emerald-400":k==="L"?"text-red-400":"text-muted-foreground"}`}>{k}</span>
                        <span className="text-[10px] font-mono text-foreground">{Number(v).toFixed(decimals)}</span>
                      </div>
                    ))}
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
