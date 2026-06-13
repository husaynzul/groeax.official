import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type Time,
} from "lightweight-charts";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Zap, X, BarChart2, Clock, Trophy,
} from "lucide-react";
import { calcEMA, calcRSI, toLinePts } from "@/lib/indicators";

/* ── Types ──────────────────────────────────────────────────────────── */
interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }

interface VirtualTrade {
  id: string;
  direction: "BUY" | "SELL";
  entry: number;
  sl: number | null;
  tp: number | null;
  size: number;
  entryTime: number;
  exitTime?: number;
  exitPrice?: number;
  pnl?: number;
  result?: "WIN" | "LOSS" | "BE" | "OPEN";
}

interface SessionStats { wins: number; losses: number; be: number; totalPnl: number }

import { getApiBase } from "@/lib/apiBase";
const BASE = getApiBase();
const SPEEDS = [0.5, 1, 2, 4, 8] as const;
type Speed = (typeof SPEEDS)[number];

const CATEGORIES = {
  Forex:   ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","EURJPY","GBPJPY","EURGBP","EURAUD","EURCAD","GBPAUD","GBPCAD","AUDCAD","AUDNZD","CADJPY","CHFJPY","USDMXN","USDSEK"],
  Metals:  ["XAUUSD","XAGUSD","XPTUSD","XPDUSD","WTIUSD","BRENTUSD"],
  Crypto:  ["BTCUSD","ETHUSD","BNBUSD","SOLUSD","XRPUSD","ADAUSD","DOGEUSD","AVAXUSD","LINKUSD","DOTUSD","LTCUSD","MATICUSD","UNIUSD","ATOMUSD","NEARUSD"],
  Stocks:  ["AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","AMD","NFLX","JPM","GS","BAC","DIS","INTC","COIN"],
  Indices: ["SPX","SPY","QQQ","NDX","DJI","GER40","UK100","JPN225","VIX"],
};
const ALL_PAIRS = (Object.values(CATEGORIES) as string[][]).flat();
const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1"] as const;

function pairDecimals(pair: string): number {
  const jpy = ["USDJPY","EURJPY","GBPJPY","CADJPY","CHFJPY","AUDJPY","NZDJPY"];
  if (jpy.includes(pair)) return 3;
  const two = [...CATEGORIES.Crypto,...CATEGORIES.Stocks,...CATEGORIES.Metals,...CATEGORIES.Indices];
  if (two.includes(pair)) return 2;
  if (pair === "XRPUSD" || pair === "ADAUSD" || pair === "MATICUSD") return 4;
  return 5;
}

function fmtP(v: number, pair: string) { return v.toFixed(pairDecimals(pair)); }
function fmtMoney(n: number) { return `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`; }

const CHART_OPTS = {
  layout: { background: { type: ColorType.Solid, color: "#0f1117" }, textColor: "#8899aa" },
  grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
  timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
  handleScroll: true, handleScale: true,
};

/* ── Main Component ─────────────────────────────────────────────────── */
export default function Replay() {
  const [pair, setPair] = useState("EURUSD");
  const [tf, setTf]   = useState<string>("H1");
  const [catTab, setCatTab] = useState<keyof typeof CATEGORIES>("Forex");

  const [allBars, setAllBars] = useState<Bar[]>([]);
  const [dataSource, setDataSource] = useState<string>("—");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed]     = useState<Speed>(1);

  // Virtual trading
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [size, setSize]     = useState("0.10");
  const [slEnabled, setSlEnabled] = useState(true);
  const [tpEnabled, setTpEnabled] = useState(true);
  const [slInput, setSlInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [activeTrade, setActiveTrade] = useState<VirtualTrade | null>(null);
  const [closedTrades, setClosedTrades] = useState<VirtualTrade[]>([]);

  // Chart refs
  const mainDivRef = useRef<HTMLDivElement>(null);
  const rsiDivRef  = useRef<HTMLDivElement>(null);
  const mainChart  = useRef<IChartApi | null>(null);
  const rsiChart   = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema9Series   = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21Series  = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeries    = useRef<ISeriesApi<"Line"> | null>(null);
  const obSeries     = useRef<ISeriesApi<"Line"> | null>(null);
  const osSeries     = useRef<ISeriesApi<"Line"> | null>(null);
  const volSeries    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const entryLine    = useRef<ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null>(null);
  const slLine       = useRef<ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null>(null);
  const tpLine       = useRef<ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null>(null);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Pre-computed indicators ──────────────────────────────────────── */
  const indicators = useMemo(() => {
    if (!allBars.length) return null;
    const closes = allBars.map((b) => b.close);
    const times  = allBars.map((b) => b.time);
    return {
      ema9:  toLinePts(times, calcEMA(closes, 9)),
      ema21: toLinePts(times, calcEMA(closes, 21)),
      rsi14: toLinePts(times, calcRSI(closes, 14)),
    };
  }, [allBars]);

  /* ── Fetch data ───────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAllBars([]);
    setVisibleCount(60);
    setActiveTrade(null);
    setClosedTrades([]);
    setPlaying(false);

    fetch(`${BASE}/api/chart/candles?pair=${pair}&tf=${tf}&limit=500`)
      .then((r) => r.json())
      .then((d: { bars: Bar[]; source: string }) => {
        if (cancelled) return;
        setAllBars(d.bars ?? []);
        setDataSource(d.source ?? "unknown");
        setVisibleCount(Math.min(80, (d.bars ?? []).length));
      })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [pair, tf]);

  /* ── Chart init ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mainDivRef.current || !rsiDivRef.current) return;

    const mc = createChart(mainDivRef.current, {
      ...CHART_OPTS,
      width:  mainDivRef.current.clientWidth,
      height: mainDivRef.current.clientHeight,
    });

    const rc = createChart(rsiDivRef.current, {
      layout:     CHART_OPTS.layout,
      grid:       CHART_OPTS.grid,
      rightPriceScale: { ...CHART_OPTS.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale:  { ...CHART_OPTS.timeScale, visible: false },
      crosshair:  { mode: CrosshairMode.Hidden },
      handleScroll: false,
      handleScale:  false,
      width:  rsiDivRef.current.clientWidth,
      height: rsiDivRef.current.clientHeight,
    });

    const cs = mc.addCandlestickSeries({
      upColor: "#26a69a", downColor: "#ef5350",
      borderUpColor: "#26a69a", borderDownColor: "#ef5350",
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
    });

    const vs = mc.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    mc.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const e9  = mc.addLineSeries({ color: "#f59e0b", lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false });
    const e21 = mc.addLineSeries({ color: "#06b6d4", lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false });

    const rsi = rc.addLineSeries({
      color: "#a78bfa", lineWidth: 2,
      crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true,
    });

    // Overbought / oversold bands in RSI chart
    const ob = rc.addLineSeries({ color: "rgba(239,68,68,0.4)",  lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: false });
    const os = rc.addLineSeries({ color: "rgba(16,185,129,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: false });
    obSeries.current = ob;
    osSeries.current = os;

    // Time-scale sync
    mc.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) rc.timeScale().setVisibleLogicalRange(range);
    });

    mainChart.current   = mc;
    rsiChart.current    = rc;
    candleSeries.current = cs;
    volSeries.current    = vs;
    ema9Series.current   = e9;
    ema21Series.current  = e21;
    rsiSeries.current    = rsi;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainDivRef.current) mc.applyOptions({ width: mainDivRef.current.clientWidth, height: mainDivRef.current.clientHeight });
      if (rsiDivRef.current)  rc.applyOptions({ width: rsiDivRef.current.clientWidth,  height: rsiDivRef.current.clientHeight });
    });
    if (mainDivRef.current) ro.observe(mainDivRef.current);
    if (rsiDivRef.current)  ro.observe(rsiDivRef.current);

    return () => {
      ro.disconnect();
      mc.remove();
      rc.remove();
      mainChart.current = null; rsiChart.current = null;
      candleSeries.current = null; volSeries.current = null;
      ema9Series.current = null; ema21Series.current = null;
      rsiSeries.current = null;
      obSeries.current = null;
      osSeries.current = null;
    };
  }, []);

  /* ── Update chart data ────────────────────────────────────────────── */
  useEffect(() => {
    if (!allBars.length || !candleSeries.current || !indicators) return;
    const slice = allBars.slice(0, visibleCount);

    candleSeries.current.setData(
      slice.map((b) => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close }))
    );
    volSeries.current?.setData(
      slice.map((b) => ({
        time: b.time as Time, value: b.volume,
        color: b.close >= b.open ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)",
      }))
    );
    ema9Series.current?.setData(indicators.ema9.slice(0, visibleCount));
    ema21Series.current?.setData(indicators.ema21.slice(0, visibleCount));
    rsiSeries.current?.setData(indicators.rsi14.slice(0, visibleCount));

    // RSI overbought / oversold bands
    if (slice.length > 0) {
      const obData = slice.map((b) => ({ time: b.time as Time, value: 70 }));
      const osData = slice.map((b) => ({ time: b.time as Time, value: 30 }));
      obSeries.current?.setData(obData);
      osSeries.current?.setData(osData);
    }

    mainChart.current?.timeScale().scrollToRealTime();
  }, [allBars, visibleCount, indicators]);

  /* ── Price lines for active trade ───────────────────────────────────── */
  useEffect(() => {
    if (!candleSeries.current) return;
    const cs = candleSeries.current;

    // Remove old
    if (entryLine.current) { try { cs.removePriceLine(entryLine.current); } catch { /* */ } entryLine.current = null; }
    if (slLine.current)    { try { cs.removePriceLine(slLine.current);    } catch { /* */ } slLine.current    = null; }
    if (tpLine.current)    { try { cs.removePriceLine(tpLine.current);    } catch { /* */ } tpLine.current    = null; }

    if (!activeTrade) return;
    entryLine.current = cs.createPriceLine({ price: activeTrade.entry,    color: "#ffffff",  lineWidth: 1, lineStyle: LineStyle.Solid,  axisLabelVisible: true, title: activeTrade.direction });
    if (activeTrade.sl) slLine.current = cs.createPriceLine({ price: activeTrade.sl, color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "SL" });
    if (activeTrade.tp) tpLine.current = cs.createPriceLine({ price: activeTrade.tp, color: "#10b981", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "TP" });
  }, [activeTrade]);

  /* ── Playback ─────────────────────────────────────────────────────── */
  const total = allBars.length;

  const stepForward = useCallback(() => {
    setVisibleCount((c) => {
      if (c >= total) { setPlaying(false); return c; }
      return c + 1;
    });
  }, [total]);

  const stepBack = useCallback(() => {
    setVisibleCount((c) => Math.max(1, c - 1));
  }, []);

  useEffect(() => {
    if (!playing) { if (playIntervalRef.current) clearInterval(playIntervalRef.current); return; }
    const ms = Math.max(100, 1200 / speed);
    playIntervalRef.current = setInterval(stepForward, ms);
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [playing, speed, stepForward]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepBack(); }
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepForward, stepBack]);

  /* ── Check SL/TP hit on each new candle ──────────────────────────── */
  useEffect(() => {
    if (!activeTrade || !allBars.length || visibleCount < 1) return;
    const bar = allBars[visibleCount - 1];
    if (!bar || bar.time === activeTrade.entryTime) return;

    const { direction: dir, sl, tp, entry, size } = activeTrade;
    let hit: "SL" | "TP" | null = null;
    let exitPrice = bar.close;

    if (dir === "BUY") {
      if (sl && bar.low <= sl)   { hit = "SL"; exitPrice = sl; }
      else if (tp && bar.high >= tp) { hit = "TP"; exitPrice = tp; }
    } else {
      if (sl && bar.high >= sl)  { hit = "SL"; exitPrice = sl; }
      else if (tp && bar.low <= tp)  { hit = "TP"; exitPrice = tp; }
    }

    if (hit) {
      const pipMult = pairDecimals(pair) === 5 ? 10000 : pairDecimals(pair) === 3 ? 100 : 1;
      const rawPips = dir === "BUY" ? (exitPrice - entry) * pipMult : (entry - exitPrice) * pipMult;
      const pnl = parseFloat((rawPips * size * 10).toFixed(2));
      const result: VirtualTrade["result"] = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BE";
      const closed: VirtualTrade = { ...activeTrade, exitTime: bar.time, exitPrice, pnl, result };
      setClosedTrades((prev) => [...prev, closed]);
      setActiveTrade(null);
    }
  }, [visibleCount, allBars, activeTrade, pair]);

  /* ── Place order ─────────────────────────────────────────────────── */
  const placeOrder = useCallback(() => {
    if (!allBars.length || visibleCount < 1 || activeTrade) return;
    const bar = allBars[visibleCount - 1];
    const entry = bar.close;
    const dec = pairDecimals(pair);
    const sl = slEnabled && slInput ? parseFloat(slInput) : null;
    const tp = tpEnabled && tpInput ? parseFloat(tpInput) : null;
    setActiveTrade({
      id: `replay_${Date.now()}`,
      direction,
      entry,
      sl,
      tp,
      size: parseFloat(size) || 0.10,
      entryTime: bar.time,
      result: "OPEN",
    });
    // Pre-fill SL/TP defaults if not set
    const df = direction === "BUY"
      ? { sl: +(entry - 50 / 10 ** dec).toFixed(dec), tp: +(entry + 100 / 10 ** dec).toFixed(dec) }
      : { sl: +(entry + 50 / 10 ** dec).toFixed(dec), tp: +(entry - 100 / 10 ** dec).toFixed(dec) };
    if (slEnabled && !slInput) setSlInput(df.sl.toString());
    if (tpEnabled && !tpInput) setTpInput(df.tp.toString());
  }, [allBars, visibleCount, activeTrade, direction, size, pair, slEnabled, tpEnabled, slInput, tpInput]);

  const closeActiveTrade = useCallback(() => {
    if (!activeTrade || !allBars.length || visibleCount < 1) return;
    const bar = allBars[visibleCount - 1];
    const exitPrice = bar.close;
    const { direction: dir, entry, size } = activeTrade;
    const pipMult = pairDecimals(pair) === 5 ? 10000 : pairDecimals(pair) === 3 ? 100 : 1;
    const rawPips = dir === "BUY" ? (exitPrice - entry) * pipMult : (entry - exitPrice) * pipMult;
    const pnl = parseFloat((rawPips * size * 10).toFixed(2));
    const result: VirtualTrade["result"] = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BE";
    setClosedTrades((prev) => [...prev, { ...activeTrade, exitTime: bar.time, exitPrice, pnl, result }]);
    setActiveTrade(null);
  }, [activeTrade, allBars, visibleCount, pair]);

  /* ── Session stats ──────────────────────────────────────────────────── */
  const stats: SessionStats = useMemo(() => {
    return closedTrades.reduce(
      (acc, t) => ({
        wins:     acc.wins     + (t.result === "WIN"  ? 1 : 0),
        losses:   acc.losses   + (t.result === "LOSS" ? 1 : 0),
        be:       acc.be       + (t.result === "BE"   ? 1 : 0),
        totalPnl: acc.totalPnl + (t.pnl ?? 0),
      }),
      { wins: 0, losses: 0, be: 0, totalPnl: 0 },
    );
  }, [closedTrades]);

  /* ── Current bar info ─────────────────────────────────────────────── */
  const currentBar = allBars[visibleCount - 1];
  const currentRSI = indicators?.rsi14[visibleCount - 1]?.value;
  const currentEMA9 = indicators?.ema9[visibleCount - 1]?.value;
  const currentEMA21 = indicators?.ema21[visibleCount - 1]?.value;

  const livePnl = useMemo(() => {
    if (!activeTrade || !currentBar) return null;
    const { direction: dir, entry, size: sz } = activeTrade;
    const pipMult = pairDecimals(pair) === 5 ? 10000 : pairDecimals(pair) === 3 ? 100 : 1;
    const rawPips = dir === "BUY"
      ? (currentBar.close - entry) * pipMult
      : (entry - currentBar.close) * pipMult;
    return parseFloat((rawPips * sz * 10).toFixed(2));
  }, [activeTrade, currentBar, pair]);

  const sourceLabel = dataSource === "binance" ? "Binance Live"
    : dataSource === "yahoo" ? "Yahoo Finance Live"
    : "Simulated";
  const sourceDot = dataSource === "simulated" ? "bg-yellow-400" : "bg-emerald-400";

  /* ── Default SL/TP when pair/direction changes ───────────────────── */
  useEffect(() => {
    if (!currentBar) return;
    const dec = pairDecimals(pair);
    const e = currentBar.close;
    if (direction === "BUY") {
      setSlInput(+(e - 50 / 10 ** dec).toFixed(dec) + "");
      setTpInput(+(e + 100 / 10 ** dec).toFixed(dec) + "");
    } else {
      setSlInput(+(e + 50 / 10 ** dec).toFixed(dec) + "");
      setTpInput(+(e - 100 / 10 ** dec).toFixed(dec) + "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, direction]);

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-card/60">
        <BarChart2 className="w-4 h-4 text-primary shrink-0" />
        <span className="font-bold text-sm text-foreground">Bar Replay</span>

        {/* Category tabs */}
        <div className="flex items-center gap-0.5 bg-secondary/40 rounded-lg p-0.5 ml-2">
          {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((cat) => (
            <button key={cat}
              onClick={() => { setCatTab(cat); const first = CATEGORIES[cat][0]; if (first) setPair(first); }}
              className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${catTab === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >{cat}</button>
          ))}
        </div>

        {/* Pair select */}
        <select
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          className="text-xs bg-secondary/40 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {CATEGORIES[catTab].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Timeframe */}
        <div className="flex items-center gap-0.5 bg-secondary/40 rounded-lg p-0.5">
          {TIMEFRAMES.map((t) => (
            <button key={t} onClick={() => setTf(t)}
              className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-semibold transition-all ${tf === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >{t}</button>
          ))}
        </div>

        {/* Source badge */}
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className={`w-1.5 h-1.5 rounded-full ${sourceDot} animate-pulse`} />
          {loading ? "Loading…" : sourceLabel}
        </span>
      </div>

      {/* ── BODY: charts + right panel ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT: chart area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Main candle chart */}
          <div className="relative flex-[5] min-h-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/60">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  Fetching {pair} {tf} data…
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <div ref={mainDivRef} className="w-full h-full" />
          </div>

          {/* Candle OHLC info bar */}
          {currentBar && (
            <div className="shrink-0 flex items-center gap-4 px-3 py-1 bg-card/40 border-t border-border text-[10px] font-mono text-muted-foreground">
              <span className="text-foreground font-semibold">{pair}</span>
              <span>O <span className="text-foreground">{fmtP(currentBar.open, pair)}</span></span>
              <span>H <span className="text-emerald-400">{fmtP(currentBar.high, pair)}</span></span>
              <span>L <span className="text-red-400">{fmtP(currentBar.low, pair)}</span></span>
              <span>C <span className={currentBar.close >= currentBar.open ? "text-emerald-400" : "text-red-400"}>{fmtP(currentBar.close, pair)}</span></span>
              {currentEMA9  && <span>EMA9  <span className="text-yellow-400">{fmtP(currentEMA9, pair)}</span></span>}
              {currentEMA21 && <span>EMA21 <span className="text-cyan-400">{fmtP(currentEMA21, pair)}</span></span>}
              {currentRSI   && <span>RSI <span className={currentRSI > 70 ? "text-red-400" : currentRSI < 30 ? "text-emerald-400" : "text-foreground"}>{currentRSI.toFixed(1)}</span></span>}
              <span className="ml-auto flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(currentBar.time * 1000).toLocaleString()}</span>
            </div>
          )}

          {/* RSI sub-chart */}
          <div className="shrink-0 h-[110px] border-t border-border relative">
            <span className="absolute top-1 left-2 text-[9px] text-muted-foreground z-10 select-none">RSI(14)</span>
            <div ref={rsiDivRef} className="w-full h-full" />
          </div>

          {/* ── CONTROLS BAR ── */}
          <div className="shrink-0 border-t border-border bg-card/80 px-4 py-2">
            {/* Scrubber */}
            <div className="mb-2">
              <input type="range" min={1} max={Math.max(total, 2)} value={visibleCount}
                onChange={(e) => { setVisibleCount(Number(e.target.value)); setPlaying(false); }}
                className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>{allBars[0] ? new Date(allBars[0].time * 1000).toLocaleDateString() : "—"}</span>
                <span className="font-semibold text-foreground">{visibleCount} / {total} candles</span>
                <span>{currentBar ? new Date(currentBar.time * 1000).toLocaleDateString() : "—"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {/* Speed */}
              <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold transition-all ${speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >{s}×</button>
                ))}
              </div>

              {/* Playback buttons */}
              <div className="flex items-center gap-1">
                <button onClick={() => { setVisibleCount(1); setPlaying(false); }}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Restart">
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button onClick={stepBack} disabled={visibleCount <= 1}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPlaying((p) => !p)}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-md"
                  title="Play/Pause (Space)">
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {playing ? "Pause" : "Play"}
                </button>
                <button onClick={stepForward} disabled={visibleCount >= total}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => { setVisibleCount(total); setPlaying(false); }}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Jump to latest">
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-[10px] text-muted-foreground">← → Space</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: virtual trade panel ── */}
        <div className="w-72 shrink-0 border-l border-border flex flex-col overflow-y-auto">

          {/* ── ORDER ENTRY ── */}
          <div className="p-3 border-b border-border space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Virtual Trade</p>

            {/* BUY / SELL */}
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setDirection("BUY")}
                className={`py-2 rounded-lg text-sm font-bold transition-all border ${direction === "BUY" ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400" : "border-border text-muted-foreground hover:border-emerald-500/30"}`}>
                <TrendingUp className="w-3.5 h-3.5 inline mr-1" />BUY
              </button>
              <button onClick={() => setDirection("SELL")}
                className={`py-2 rounded-lg text-sm font-bold transition-all border ${direction === "SELL" ? "bg-red-500/20 border-red-500/60 text-red-400" : "border-border text-muted-foreground hover:border-red-500/30"}`}>
                <TrendingDown className="w-3.5 h-3.5 inline mr-1" />SELL
              </button>
            </div>

            {/* Size */}
            <div>
              <label className="text-[10px] text-muted-foreground">Lot Size</label>
              <input value={size} onChange={(e) => setSize(e.target.value)}
                className="w-full mt-0.5 bg-secondary/40 border border-border rounded-lg px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {/* SL */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <button onClick={() => setSlEnabled((v) => !v)}
                    className={`w-3 h-3 rounded-sm border transition-colors ${slEnabled ? "bg-red-500 border-red-500" : "border-border"}`} />
                  Stop Loss
                </label>
              </div>
              <input value={slInput} onChange={(e) => setSlInput(e.target.value)} disabled={!slEnabled}
                className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1.5 text-sm text-right text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500/50 disabled:opacity-40" />
            </div>

            {/* TP */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <button onClick={() => setTpEnabled((v) => !v)}
                    className={`w-3 h-3 rounded-sm border transition-colors ${tpEnabled ? "bg-emerald-500 border-emerald-500" : "border-border"}`} />
                  Take Profit
                </label>
              </div>
              <input value={tpInput} onChange={(e) => setTpInput(e.target.value)} disabled={!tpEnabled}
                className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1.5 text-sm text-right text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-40" />
            </div>

            {/* Place order */}
            <button onClick={placeOrder} disabled={!!activeTrade || !allBars.length}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md
                ${direction === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white disabled:bg-emerald-500/30 disabled:text-emerald-500/50"
                  : "bg-red-500 hover:bg-red-400 text-white disabled:bg-red-500/30 disabled:text-red-500/50"
                } disabled:cursor-not-allowed`}
            >
              <Zap className="w-4 h-4" />
              {activeTrade ? "Trade Active" : `Place ${direction}`}
            </button>
          </div>

          {/* ── ACTIVE TRADE ── */}
          {activeTrade && (
            <div className="p-3 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Position</span>
                <button onClick={closeActiveTrade} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5">
                  <X className="w-3 h-3" />Close
                </button>
              </div>
              <div className={`p-2.5 rounded-lg border ${activeTrade.direction === "BUY" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${activeTrade.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                    {activeTrade.direction} {pair}
                  </span>
                  <span className={`text-sm font-bold ${(livePnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {livePnl != null ? fmtMoney(livePnl) : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div><span className="text-muted-foreground">Entry</span><br /><span className="font-mono">{fmtP(activeTrade.entry, pair)}</span></div>
                  <div><span className="text-red-400">SL</span><br /><span className="font-mono">{activeTrade.sl ? fmtP(activeTrade.sl, pair) : "—"}</span></div>
                  <div><span className="text-emerald-400">TP</span><br /><span className="font-mono">{activeTrade.tp ? fmtP(activeTrade.tp, pair) : "—"}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── SESSION STATS ── */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3 h-3" />Session
              </span>
              {closedTrades.length > 0 && (
                <button onClick={() => setClosedTrades([])} className="text-[9px] text-muted-foreground hover:text-foreground">Reset</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Win / Loss", val: `${stats.wins}W / ${stats.losses}L`, color: stats.wins > stats.losses ? "text-emerald-400" : "text-foreground" },
                { label: "Win Rate",   val: stats.wins + stats.losses > 0 ? `${Math.round(stats.wins / (stats.wins + stats.losses) * 100)}%` : "—", color: stats.wins / Math.max(1, stats.wins + stats.losses) >= 0.5 ? "text-emerald-400" : "text-red-400" },
                { label: "Net P&L",    val: stats.totalPnl !== 0 ? fmtMoney(stats.totalPnl) : "$0.00", color: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Trades",     val: String(closedTrades.length + (activeTrade ? 1 : 0)), color: "text-foreground" },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-secondary/30 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${color}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CLOSED TRADES LOG ── */}
          {closedTrades.length > 0 && (
            <div className="p-3 flex-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trade Log</p>
              <div className="space-y-1.5">
                {[...closedTrades].reverse().map((t) => (
                  <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg text-[10px] border ${t.result === "WIN" ? "border-emerald-500/20 bg-emerald-500/5" : t.result === "LOSS" ? "border-red-500/20 bg-red-500/5" : "border-border"}`}>
                    <span className={`font-bold ${t.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{t.direction}</span>
                    <span className="text-muted-foreground font-mono">{fmtP(t.entry, pair)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono">{t.exitPrice ? fmtP(t.exitPrice, pair) : "—"}</span>
                    <span className={`font-bold ${(t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{t.pnl != null ? fmtMoney(t.pnl) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!closedTrades.length && !activeTrade && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <BarChart2 className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">Press Play then place virtual trades to practice your strategy</p>
              <p className="text-[10px] text-muted-foreground/60">← → Space to control playback</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
