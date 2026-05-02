import { useEffect, useRef } from "react";
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
} from "lightweight-charts";

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

interface Props {
  bars: ChartBar[];
  latestBar?: ChartBar;
  signals?: ChartSignal[];
  replayIndex?: number;
  decimals?: number;
  priceLines?: ChartPriceLines;
}

export default function CandlestickChart({
  bars,
  latestBar,
  signals = [],
  replayIndex,
  decimals = 5,
  priceLines,
}: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const entryLineRef    = useRef<IPriceLine | null>(null);
  const slLineRef       = useRef<IPriceLine | null>(null);
  const tpLineRef       = useRef<IPriceLine | null>(null);

  // ── Chart init ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#080c15" },
        textColor: "#6b7a99",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.2)", labelBackgroundColor: "#1e2433" },
        horzLine: { color: "rgba(255,255,255,0.2)", labelBackgroundColor: "#1e2433" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "#6b7a99",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor:        "#10b981",
      downColor:      "#ef4444",
      borderUpColor:  "#10b981",
      borderDownColor:"#ef4444",
      wickUpColor:    "#10b981",
      wickDownColor:  "#ef4444",
      priceFormat: {
        type:     "price",
        precision: decimals,
        minMove:   1 / Math.pow(10, decimals),
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat:  { type: "volume" },
      priceScaleId: "volume",
      color:        "rgba(255,255,255,0.08)",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current        = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current        = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      entryLineRef.current    = null;
      slLineRef.current       = null;
      tpLineRef.current       = null;
    };
  }, []); // eslint-disable-line

  // ── Full history load via setData ──────────────────────────────────
  // Only called when the bars array itself changes (pair/tf switch or history load)
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || bars.length === 0) return;

    const data: CandlestickData[] = bars.map((b) => ({
      time: b.time as Time,
      open: b.open, high: b.high, low: b.low, close: b.close,
    }));
    candleSeriesRef.current.setData(data);

    volumeSeriesRef.current.setData(
      bars.map((b) => ({
        time:  b.time as Time,
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
      }))
    );

    chartRef.current?.timeScale().scrollToRealTime();
  }, [bars]);

  // ── Live tick update via series.update() ───────────────────────────
  // Called on every tick WITHOUT re-rendering the full dataset.
  // LW Charts update() handles both in-place updates (same timestamp)
  // and new candle creation (newer timestamp) automatically.
  useEffect(() => {
    if (!candleSeriesRef.current || !latestBar) return;

    candleSeriesRef.current.update({
      time:  latestBar.time as Time,
      open:  latestBar.open,
      high:  latestBar.high,
      low:   latestBar.low,
      close: latestBar.close,
    });

    volumeSeriesRef.current?.update({
      time:  latestBar.time as Time,
      value: latestBar.volume ?? 0,
      color: latestBar.close >= latestBar.open
        ? "rgba(16,185,129,0.25)"
        : "rgba(239,68,68,0.25)",
    });
  }, [latestBar]);

  // ── Signal markers ─────────────────────────────────────────────────
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

  // ── Replay scroll ──────────────────────────────────────────────────
  useEffect(() => {
    if (replayIndex !== undefined && candleSeriesRef.current && bars[replayIndex]) {
      chartRef.current?.timeScale().scrollToPosition(0, false);
    }
  }, [replayIndex, bars]);

  // ── SL / TP / Entry price lines ────────────────────────────────────
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    if (entryLineRef.current) { try { series.removePriceLine(entryLineRef.current); } catch { /* ignore */ } entryLineRef.current = null; }
    if (slLineRef.current)    { try { series.removePriceLine(slLineRef.current); }    catch { /* ignore */ } slLineRef.current    = null; }
    if (tpLineRef.current)    { try { series.removePriceLine(tpLineRef.current); }    catch { /* ignore */ } tpLineRef.current    = null; }

    if (!priceLines) return;

    if (priceLines.entry) {
      entryLineRef.current = series.createPriceLine({
        price:              priceLines.entry,
        color:              "#6b7a99",
        lineWidth:          1,
        lineStyle:          LineStyle.Solid,
        axisLabelVisible:   true,
        title:              "Entry",
      });
    }
    if (priceLines.sl) {
      slLineRef.current = series.createPriceLine({
        price:              priceLines.sl,
        color:              "#ef4444",
        lineWidth:          1,
        lineStyle:          LineStyle.Dashed,
        axisLabelVisible:   true,
        title:              "SL",
      });
    }
    if (priceLines.tp) {
      tpLineRef.current = series.createPriceLine({
        price:              priceLines.tp,
        color:              "#10b981",
        lineWidth:          1,
        lineStyle:          LineStyle.Dashed,
        axisLabelVisible:   true,
        title:              "TP",
      });
    }
  }, [priceLines?.entry, priceLines?.sl, priceLines?.tp]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 320 }}
    />
  );
}
