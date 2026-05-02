import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type SeriesMarker,
  type Time,
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

interface Props {
  bars: ChartBar[];
  signals?: ChartSignal[];
  replayIndex?: number;
  decimals?: number;
}

export default function CandlestickChart({ bars, signals = [], replayIndex, decimals = 5 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

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
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceFormat: {
        type: "price",
        precision: decimals,
        minMove: 1 / Math.pow(10, decimals),
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(255,255,255,0.08)",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Sync candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || bars.length === 0) return;
    const data: CandlestickData[] = bars.map((b) => ({
      time: b.time as Time,
      open: b.open, high: b.high, low: b.low, close: b.close,
    }));
    candleSeriesRef.current.setData(data);

    volumeSeriesRef.current.setData(
      bars.map((b) => ({
        time: b.time as Time,
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
      }))
    );

    // Fit visible range
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // Sync signals as markers
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const markers: SeriesMarker<Time>[] = signals.map((s) => ({
      time: s.time as Time,
      position: s.type === "BUY" ? "belowBar" : "aboveBar",
      color: s.type === "BUY" ? "#10b981" : "#ef4444",
      shape: s.type === "BUY" ? "arrowUp" : "arrowDown",
      text: s.label ?? s.type,
      size: 1.2,
    }));
    candleSeriesRef.current.setMarkers(markers);
  }, [signals]);

  // Scroll to replay index
  useEffect(() => {
    if (replayIndex !== undefined && candleSeriesRef.current && bars[replayIndex]) {
      chartRef.current?.timeScale().scrollToPosition(0, false);
    }
  }, [replayIndex, bars]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 320 }}
    />
  );
}
