import type { OHLCBar } from "./candleGenerator.js";
import { logger } from "../lib/logger.js";

export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  // Forex Majors
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  AUDUSD: "AUDUSD=X", USDCAD: "USDCAD=X", USDCHF: "USDCHF=X",
  NZDUSD: "NZDUSD=X",
  // Forex Crosses
  EURJPY: "EURJPY=X", GBPJPY: "GBPJPY=X", EURGBP: "EURGBP=X",
  EURAUD: "EURAUD=X", EURCAD: "EURCAD=X", GBPAUD: "GBPAUD=X",
  GBPCAD: "GBPCAD=X", AUDCAD: "AUDCAD=X", AUDNZD: "AUDNZD=X",
  CADJPY: "CADJPY=X", CHFJPY: "CHFJPY=X", USDMXN: "USDMXN=X",
  USDSEK: "USDSEK=X",
  // Metals / Commodities
  XAUUSD: "GC=F",  XAGUSD: "SI=F",  XPTUSD: "PL=F",
  XPDUSD: "PA=F",  WTIUSD: "CL=F",  BRENTUSD: "BZ=F",
  // US Stocks
  AAPL: "AAPL", MSFT: "MSFT", GOOGL: "GOOGL", AMZN: "AMZN",
  META: "META", NVDA: "NVDA", TSLA: "TSLA",  AMD: "AMD",
  NFLX: "NFLX", JPM: "JPM",  GS: "GS",    BAC: "BAC",
  DIS: "DIS",  INTC: "INTC", COIN: "COIN",
  // Indices
  SPX:    "^GSPC", SPY:    "SPY",   QQQ:    "QQQ",
  NDX:    "^NDX",  DJI:    "^DJI",  GER40:  "^GDAXI",
  UK100:  "^FTSE", JPN225: "^N225", VIX:    "^VIX",
};

export const YAHOO_SUPPORTED = new Set(Object.keys(YAHOO_SYMBOL_MAP));

const TF_TO_YAHOO: Record<string, { interval: string; range: string }> = {
  M1:  { interval: "1m",  range: "1d"  },
  M5:  { interval: "5m",  range: "5d"  },
  M15: { interval: "15m", range: "5d"  },
  M30: { interval: "30m", range: "1mo" },
  H1:  { interval: "60m", range: "3mo" },
  H4:  { interval: "60m", range: "6mo" },
  D1:  { interval: "1d",  range: "1y"  },
};

interface CacheEntry { bars: OHLCBar[]; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

type YahooChart = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?:   (number | null)[];
          high?:   (number | null)[];
          low?:    (number | null)[];
          close?:  (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
};

async function rawFetch(symbol: string, interval: string, range: string): Promise<OHLCBar[]> {
  const cacheKey = `${symbol}:${interval}:${range}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.bars;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;

  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!r.ok) throw new Error(`Yahoo Finance HTTP ${r.status} for ${symbol}`);

  const data = (await r.json()) as YahooChart;
  if (data.chart.error) throw new Error(`Yahoo: ${data.chart.error.description}`);

  const result = data.chart.result?.[0];
  if (!result) throw new Error(`No Yahoo data for ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};

  const bars: OHLCBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open?.[i] ?? null;
    const h = q.high?.[i] ?? null;
    const l = q.low?.[i]  ?? null;
    const c = q.close?.[i]?? null;
    if (o == null || h == null || l == null || c == null) continue;
    if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
    bars.push({
      time:   timestamps[i],
      open:   o,
      high:   h,
      low:    l,
      close:  c,
      volume: q.volume?.[i] ?? 0,
    });
  }

  cache.set(cacheKey, { bars, ts: now });
  return bars;
}

export async function fetchYahooHistory(
  pair: string,
  tf: string,
  limit = 500,
): Promise<OHLCBar[]> {
  const symbol = YAHOO_SYMBOL_MAP[pair];
  if (!symbol) throw new Error(`No Yahoo symbol for ${pair}`);
  const { interval, range } = TF_TO_YAHOO[tf] ?? TF_TO_YAHOO["H1"];
  const bars = await rawFetch(symbol, interval, range);
  return bars.slice(-limit);
}

export async function fetchLatestYahooBar(
  pair: string,
  tf: string,
): Promise<OHLCBar | null> {
  try {
    const symbol = YAHOO_SYMBOL_MAP[pair];
    if (!symbol) return null;
    const { interval } = TF_TO_YAHOO[tf] ?? TF_TO_YAHOO["H1"];
    const shortRange = ["1m", "5m", "15m", "30m"].includes(interval) ? "1d" : "5d";
    const cacheKey = `${symbol}:${interval}:${shortRange}`;
    cache.delete(cacheKey);
    const bars = await rawFetch(symbol, interval, shortRange);
    return bars[bars.length - 1] ?? null;
  } catch (e) {
    logger.warn({ pair, err: String(e) }, "fetchLatestYahooBar error");
    return null;
  }
}
