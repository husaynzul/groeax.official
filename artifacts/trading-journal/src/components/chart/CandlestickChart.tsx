import { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type SeriesMarker,
  type Time,
  type IPriceLine,
  type LogicalRange,
} from "lightweight-charts";
import { calcEMA, calcRSI, toLinePts } from "@/lib/indicators";

export interface ChartBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartSignal {
  time: number;
  type: "BUY" | "SELL";
  price: number;
  label?: string;
}

export interface ChartPriceLines {
  entry?: number | null;
  sl?: number | null;
  tp?: number | null;
}

export interface ChartIndicators {
  ema9?: boolean;
  ema21?: boolean;
  ema50?: boolean;
  rsi?: boolean;
  volume?: boolean;
}

interface Props {
  bars: ChartBar[];
  latestBar?: ChartBar;
  signals?: ChartSignal[];
  replayIndex?: number;
  decimals?: number;
  priceLines?: ChartPriceLines;
  indicators?: ChartIndicators;
}

const CHART_BG    = "#080c15";
const GRID_COLOR  = "rgba(255,255,255,0.04)";
const AXIS_COLOR  = "rgba(255,255,255,0.08)";
const TEXT_COLOR  = "#6b7a99";
const LABEL_BG    = "#1e2433";
const CROSS_COLOR = "rgba(255,255,255,0.2)";

function makeChartOptions(height: number) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: CHART_BG },
      textColor: TEXT_COLOR,
      fontFamily: "ui-monospace, monospace",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: CROSS_COLOR, labelBackgroundColor: LABEL_BG },
      horzLine: { color: CROSS_COLOR, labelBackgroundColor: LABEL_BG },
    },
    rightPriceScale: {
      borderColor: AXIS_COLOR,
      textColor: TEXT_COLOR,
    },
    timeScale: {
      borderColor: AXIS_COLOR,
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll: true,
    handleScale: true,
    height,
    width: 0,
  };
}

export default function CandlestickChart({
  bars,
  latestBar,
  signals = [],
  replayIndex,
  decimals = 5,
  priceLines,
  indicators = { ema9: true, ema21: true, rsi: true, volume: true },
}: Props) {
  const wrapRef        = useRef<HTMLDivElement>(null);
  const mainRef        = useRef<HTMLDivElement>(null);
  const rsiRef         = useRef<HTMLDivElement>(null);

  const chartRef        = useRef<IChartApi | null>(null);
  const rsiChartRef     = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9SeriesRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOBRef        = useRef<IPriceLine | null>(null);
  const rsiOSRef        = useRef<IPriceLine | null>(null);

  const entryLineRef    = useRef<IPriceLine | null>(null);
  const slLineRef       = useRef<IPriceLine | null>(null);
  const tpLineRef       = useRef<IPriceLine | null>(null);

  const showRSI    = indicators?.rsi !== false;
  const showVol    = indicators?.volume !== false;
  const showEMA9   = indicators?.ema9  !== false;
  const showEMA21  = indicators?.ema21 !== false;
  const showEMA50  = indicators?.ema50 === true;

  // Computed indicators from bars
  const closes = useMemo(() => bars.map((b) => b.close), [bars]);
  const times  = useMemo(() => bars.map((b) => b.time),  [bars]);

  const ema9Pts  = useMemo(() => toLinePts(times, calcEMA(closes, 9)),  [times, closes]);
  const ema21Pts = useMemo(() => toLinePts(times, calcEMA(closes, 21)), [times, closes]);
  const ema50Pts = useMemo(() => toLinePts(times, calcEMA(closes, 50)), [times, closes]);
  const rsiPts   = useMemo(() => toLinePts(times, calcRSI(closes, 14)), [times, closes]);

  // ── Chart init ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !wrapRef.current) return;

    const totalH = wrapRef.current.clientHeight || 400;
    const rsiH   = showRSI ? Math.round(totalH * 0.22) : 0;
    const mainH  = totalH - rsiH;

    // Main chart
    const chart = createChart(mainRef.current, makeChartOptions(mainH));
    chartRef.current = chart;

    // Candle series
    const candleSeries = chart.addCandlestickSeries({
      upColor:         "#10b981",
      downColor:       "#ef4444",
      borderUpColor:   "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor:     "#10b981",
      wickDownColor:   "#ef4444",
      priceFormat: {
        type:      "price",
        precision: decimals,
        minMove:   1 / Math.pow(10, decimals),
      },
    });
    candleSeriesRef.current = candleSeries;

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat:  { type: "volume" },
      priceScaleId: "volume",
      color:        "rgba(255,255,255,0.08)",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // EMA series
    const commonLine = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false };

    ema9SeriesRef.current = chart.addLineSeries({
      ...commonLine, color: "#f59e0b", lineWidth: 1,
    });
    ema21SeriesRef.current = chart.addLineSeries({
      ...commonLine, color: "#06b6d4", lineWidth: 1,
    });
    ema50SeriesRef.current = chart.addLineSeries({
      ...commonLine, color: "#a78bfa", lineWidth: 1,
    });

    // ── RSI sub-chart ─────────────────────────────────────────────
    const rsiChartEl = rsiRef.current;
    rsiChartEl.style.height = `${rsiH}px`;

    const rsiChart = createChart(rsiChartEl, {
      ...makeChartOptions(rsiH),
      layout: {
        background: { type: ColorType.Solid, color: "#060a12" },
        textColor: TEXT_COLOR,
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
      },
      timeScale: { borderColor: AXIS_COLOR, timeVisible: false, secondsVisible: false },
      rightPriceScale: {
        borderColor: AXIS_COLOR,
        textColor: TEXT_COLOR,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addLineSeries({
      color: "#8b5cf6",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    rsiSeriesRef.current = rsiSeries;

    // OB/OS reference lines
    rsiOBRef.current = rsiSeries.createPriceLine({
      price: 70, color: "rgba(239,68,68,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed,
      axisLabelVisible: true, title: "OB",
    });
    rsiOSRef.current = rsiSeries.createPriceLine({
      price: 30, color: "rgba(16,185,129,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed,
      axisLabelVisible: true, title: "OS",
    });

    // ── Timescale sync (no infinite loop) ─────────────────────────
    let syncing = false;
    const onMainRange = (range: LogicalRange | null) => {
      if (syncing || !range) return;
      syncing = true;
      rsiChart.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    };
    const onRsiRange = (range: LogicalRange | null) => {
      if (syncing || !range) return;
      syncing = true;
      chart.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onMainRange);
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(onRsiRange);

    // ── ResizeObserver ────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      const total = wrapRef.current.clientHeight;
      const rH    = showRSI ? Math.round(total * 0.22) : 0;
      const mH    = total - rH;
      const w     = wrapRef.current.clientWidth;

      chart.applyOptions({ width: w, height: mH });
      rsiChart.applyOptions({ width: w, height: rH });
      rsiChartEl.style.height = `${rH}px`;
    });
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onMainRange);
      rsiChart.timeScale().unsubscribeVisibleLogicalRangeChange(onRsiRange);
      chart.remove();
      rsiChart.remove();
      chartRef.current = candleSeriesRef.current = volumeSeriesRef.current = null;
      ema9SeriesRef.current = ema21SeriesRef.current = ema50SeriesRef.current = null;
      rsiSeriesRef.current = rsiChartRef.current = null;
      entryLineRef.current = slLineRef.current = tpLineRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Show/hide EMA series based on indicator toggles ──────────────
  useEffect(() => {
    ema9SeriesRef.current?.applyOptions({ visible: showEMA9 });
    ema21SeriesRef.current?.applyOptions({ visible: showEMA21 });
    ema50SeriesRef.current?.applyOptions({ visible: showEMA50 });
  }, [showEMA9, showEMA21, showEMA50]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVol });
  }, [showVol]);

  useEffect(() => {
    if (rsiRef.current) rsiRef.current.style.display = showRSI ? "" : "none";
    rsiChartRef.current?.applyOptions({ height: showRSI ? undefined : 0 });
  }, [showRSI]);

  // ── Full history load ─────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || bars.length === 0) return;

    const data: CandlestickData[] = bars.map((b) => ({
      time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close,
    }));
    candleSeriesRef.current.setData(data);

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(bars.map((b) => ({
        time:  b.time as Time,
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
      })));
    }

    if (ema9SeriesRef.current)  ema9SeriesRef.current.setData(ema9Pts);
    if (ema21SeriesRef.current) ema21SeriesRef.current.setData(ema21Pts);
    if (ema50SeriesRef.current) ema50SeriesRef.current.setData(ema50Pts);
    if (rsiSeriesRef.current)   rsiSeriesRef.current.setData(rsiPts);

    chartRef.current?.timeScale().scrollToRealTime();
    rsiChartRef.current?.timeScale().scrollToRealTime();
  }, [bars, ema9Pts, ema21Pts, ema50Pts, rsiPts]);

  // ── Live tick update ──────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || !latestBar) return;
    candleSeriesRef.current.update({
      time: latestBar.time as Time,
      open: latestBar.open, high: latestBar.high,
      low:  latestBar.low,  close: latestBar.close,
    });
    volumeSeriesRef.current?.update({
      time:  latestBar.time as Time,
      value: latestBar.volume ?? 0,
      color: latestBar.close >= latestBar.open
        ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
    });
  }, [latestBar]);

  // ── Signal markers ────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const markers: SeriesMarker<Time>[] = signals.map((s) => ({
      time:     s.time as Time,
      position: s.type === "BUY" ? "belowBar" : "aboveBar",
      color:    s.type === "BUY" ? "#10b981"  : "#ef4444",
      shape:    s.type === "BUY" ? "arrowUp"  : "arrowDown",
      text:     s.label ?? s.type,
      size:     1.2,
    }));
    candleSeriesRef.current.setMarkers(markers);
  }, [signals]);

  // ── Replay scroll ─────────────────────────────────────────────────
  useEffect(() => {
    if (replayIndex !== undefined && bars[replayIndex]) {
      chartRef.current?.timeScale().scrollToPosition(0, false);
    }
  }, [replayIndex, bars]);

  // ── Price lines (entry / SL / TP) ────────────────────────────────
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    if (entryLineRef.current) { try { series.removePriceLine(entryLineRef.current); } catch { /**/ } entryLineRef.current = null; }
    if (slLineRef.current)    { try { series.removePriceLine(slLineRef.current);    } catch { /**/ } slLineRef.current    = null; }
    if (tpLineRef.current)    { try { series.removePriceLine(tpLineRef.current);    } catch { /**/ } tpLineRef.current    = null; }
    if (!priceLines) return;
    if (priceLines.entry) {
      entryLineRef.current = series.createPriceLine({ price: priceLines.entry, color: "#6b7a99",  lineWidth: 1, lineStyle: LineStyle.Solid,  axisLabelVisible: true, title: "Entry" });
    }
    if (priceLines.sl) {
      slLineRef.current = series.createPriceLine({ price: priceLines.sl, color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "SL" });
    }
    if (priceLines.tp) {
      tpLineRef.current = series.createPriceLine({ price: priceLines.tp, color: "#10b981", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "TP" });
    }
  }, [priceLines?.entry, priceLines?.sl, priceLines?.tp]); // eslint-disable-line

  return (
    <div ref={wrapRef} className="flex flex-col w-full h-full">
      <div ref={mainRef} className="flex-1 min-h-0" />
      <div
        ref={rsiRef}
        className="shrink-0 border-t border-white/5"
        style={{ display: showRSI ? undefined : "none" }}
      >
        <div className="px-2 pt-1 absolute pointer-events-none">
          <span className="text-[9px] text-purple-400/60 font-mono font-semibold uppercase tracking-wider">RSI 14</span>
        </div>
      </div>
    </div>
  );
}
