import WebSocket from "ws";
import type { OHLCBar } from "./candleGenerator.js";
import { logger } from "../lib/logger.js";

/* ── Symbol & interval maps ────────────────────────────────────────── */
const SYMBOL_MAP: Record<string, string> = {
  BTCUSD:  "BTCUSDT",
  ETHUSD:  "ETHUSDT",
  BNBUSD:  "BNBUSDT",
  SOLUSD:  "SOLUSDT",
  XRPUSD:  "XRPUSDT",
  ADAUSD:  "ADAUSDT",
  DOGEUSD: "DOGEUSDT",
  AVAXUSD: "AVAXUSDT",
  LINKUSD: "LINKUSDT",
  DOTUSD:  "DOTUSDT",
  LTCUSD:  "LTCUSDT",
  MATICUSD:"MATICUSDT",
  UNIUSD:  "UNIUSDT",
  ATOMUSD: "ATOMUSDT",
  NEARUSD: "NEARUSDT",
};

const TF_MAP: Record<string, string> = {
  M1: "1m", M5: "5m", M15: "15m", M30: "30m",
  H1: "1h", H4: "4h", D1: "1d",
};

export const BINANCE_SUPPORTED = new Set(Object.keys(SYMBOL_MAP));

type KlineRow = [number, string, string, string, string, string, ...unknown[]];

interface BinanceKlineMsg {
  k: {
    t: number; o: string; h: string; l: string; c: string; v: string;
  };
}

function parseKline(k: KlineRow): OHLCBar {
  return {
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  };
}

/* ── REST helpers ───────────────────────────────────────────────────── */
export async function fetchBinanceHistory(
  pair: string,
  tf: string,
  limit = 500,
): Promise<OHLCBar[]> {
  const symbol   = SYMBOL_MAP[pair];
  const interval = TF_MAP[tf] ?? "1h";
  if (!symbol) throw new Error(`No Binance mapping for ${pair}`);

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance klines HTTP ${r.status}`);

  const data = (await r.json()) as KlineRow[];
  return data.map(parseKline);
}

export async function fetchLatestBinanceCandle(
  pair: string,
  tf: string,
): Promise<OHLCBar | null> {
  const symbol   = SYMBOL_MAP[pair];
  const interval = TF_MAP[tf] ?? "1h";
  if (!symbol) return null;

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=2`;
    const r   = await fetch(url);
    if (!r.ok) return null;
    const data = (await r.json()) as KlineRow[];
    if (!data.length) return null;
    return parseKline(data[data.length - 1]);
  } catch (e) {
    logger.warn({ pair, err: String(e) }, "fetchLatestBinanceCandle error");
    return null;
  }
}

/* ── Current price (ticker) ─────────────────────────────────────────── */
export async function fetchBinanceTicker(pair: string): Promise<number | null> {
  const symbol = SYMBOL_MAP[pair];
  if (!symbol) return null;
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (!r.ok) return null;
    const d = await r.json() as { price: string };
    return parseFloat(d.price);
  } catch {
    return null;
  }
}

/* ── WebSocket real-time kline stream ──────────────────────────────── */
/**
 * Opens a Binance WebSocket kline stream for real-time candle updates.
 * Calls onBar on every price tick (≈every 1-2s when market is active).
 * Returns a cleanup function that closes the WebSocket.
 */
export function startBinanceWSStream(
  pair: string,
  tf: string,
  onBar: (bar: OHLCBar) => void,
  onFail: () => void,
): () => void {
  const symbol   = SYMBOL_MAP[pair]?.toLowerCase();
  const interval = TF_MAP[tf] ?? "1h";
  if (!symbol) { onFail(); return () => {}; }

  const url = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
  let ws: WebSocket | null = null;
  let dead = false;

  try {
    ws = new WebSocket(url);

    ws.on("open", () => {
      logger.info({ pair, tf }, "Binance WS kline stream opened");
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as BinanceKlineMsg;
        const k = msg.k;
        onBar({
          time:   Math.floor(k.t / 1000),
          open:   parseFloat(k.o),
          high:   parseFloat(k.h),
          low:    parseFloat(k.l),
          close:  parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      } catch { /* ignore */ }
    });

    ws.on("error", (err) => {
      logger.warn({ pair, err: String(err) }, "Binance WS error — falling back");
      if (!dead) { dead = true; onFail(); }
    });

    ws.on("close", () => {
      if (!dead) {
        logger.warn({ pair }, "Binance WS closed unexpectedly — falling back");
        dead = true; onFail();
      }
    });
  } catch (err) {
    logger.warn({ pair, err: String(err) }, "Binance WS connect failed — falling back");
    onFail();
  }

  return () => {
    dead = true;
    try { ws?.close(); } catch { /* ignore */ }
  };
}
