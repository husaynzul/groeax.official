export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type PairCategory = "Forex" | "Metals" | "Crypto" | "Stocks" | "Indices";

export interface PairMeta {
  base: number;
  volatility: number;
  category: PairCategory;
  decimals: number;
}

export const PAIR_CONFIG: Record<string, PairMeta> = {
  // ── Forex Majors ──
  EURUSD: { base: 1.0850, volatility: 0.0008, category: "Forex", decimals: 5 },
  GBPUSD: { base: 1.2700, volatility: 0.0012, category: "Forex", decimals: 5 },
  USDJPY: { base: 149.50, volatility: 0.12,   category: "Forex", decimals: 3 },
  AUDUSD: { base: 0.6540, volatility: 0.0007, category: "Forex", decimals: 5 },
  USDCAD: { base: 1.3600, volatility: 0.0008, category: "Forex", decimals: 5 },
  USDCHF: { base: 0.8900, volatility: 0.0007, category: "Forex", decimals: 5 },
  NZDUSD: { base: 0.6050, volatility: 0.0007, category: "Forex", decimals: 5 },
  // ── Forex Crosses ──
  EURJPY: { base: 162.20, volatility: 0.15, category: "Forex", decimals: 3 },
  GBPJPY: { base: 189.80, volatility: 0.18, category: "Forex", decimals: 3 },
  EURGBP: { base: 0.8540, volatility: 0.0006, category: "Forex", decimals: 5 },
  EURAUD: { base: 1.6580, volatility: 0.0014, category: "Forex", decimals: 5 },
  EURCAD: { base: 1.4720, volatility: 0.0012, category: "Forex", decimals: 5 },
  GBPAUD: { base: 1.9380, volatility: 0.0016, category: "Forex", decimals: 5 },
  GBPCAD: { base: 1.7230, volatility: 0.0014, category: "Forex", decimals: 5 },
  AUDCAD: { base: 0.8880, volatility: 0.0008, category: "Forex", decimals: 5 },
  AUDNZD: { base: 1.0830, volatility: 0.0009, category: "Forex", decimals: 5 },
  CADJPY: { base: 109.80, volatility: 0.10,  category: "Forex", decimals: 3 },
  CHFJPY: { base: 167.90, volatility: 0.13,  category: "Forex", decimals: 3 },
  USDMXN: { base: 17.12, volatility: 0.025,  category: "Forex", decimals: 4 },
  USDSEK: { base: 10.45, volatility: 0.015,  category: "Forex", decimals: 4 },
  // ── Metals / Commodities ──
  XAUUSD: { base: 2320.0, volatility: 4.5, category: "Metals", decimals: 2 },
  XAGUSD: { base: 27.50,  volatility: 0.18, category: "Metals", decimals: 3 },
  XPTUSD: { base: 980.0,  volatility: 3.5, category: "Metals", decimals: 2 },
  XPDUSD: { base: 1050.0, volatility: 6.0, category: "Metals", decimals: 2 },
  WTIUSD: { base: 82.50,  volatility: 0.80, category: "Metals", decimals: 2 },
  BRENTUSD: { base: 87.20, volatility: 0.90, category: "Metals", decimals: 2 },
  // ── Crypto ──
  BTCUSD:  { base: 65000, volatility: 600,  category: "Crypto", decimals: 2 },
  ETHUSD:  { base: 3450,  volatility: 55,   category: "Crypto", decimals: 2 },
  BNBUSD:  { base: 410,   volatility: 6.0,  category: "Crypto", decimals: 2 },
  SOLUSD:  { base: 172,   volatility: 4.5,  category: "Crypto", decimals: 2 },
  XRPUSD:  { base: 0.548, volatility: 0.008, category: "Crypto", decimals: 4 },
  ADAUSD:  { base: 0.445, volatility: 0.007, category: "Crypto", decimals: 4 },
  DOGEUSD: { base: 0.148, volatility: 0.004, category: "Crypto", decimals: 5 },
  AVAXUSD: { base: 36.5,  volatility: 1.2,  category: "Crypto", decimals: 3 },
  LINKUSD: { base: 18.2,  volatility: 0.55, category: "Crypto", decimals: 3 },
  DOTUSD:  { base: 7.85,  volatility: 0.22, category: "Crypto", decimals: 3 },
  LTCUSD:  { base: 82.5,  volatility: 1.8,  category: "Crypto", decimals: 2 },
  MATICUSD:{ base: 0.890, volatility: 0.020, category: "Crypto", decimals: 4 },
  UNIUSD:  { base: 9.80,  volatility: 0.30, category: "Crypto", decimals: 3 },
  ATOMUSD: { base: 8.50,  volatility: 0.25, category: "Crypto", decimals: 3 },
  NEARUSD: { base: 7.10,  volatility: 0.22, category: "Crypto", decimals: 3 },
  // ── US Stocks ──
  AAPL:   { base: 182.0,  volatility: 1.8,  category: "Stocks", decimals: 2 },
  MSFT:   { base: 415.0,  volatility: 3.5,  category: "Stocks", decimals: 2 },
  GOOGL:  { base: 175.0,  volatility: 2.2,  category: "Stocks", decimals: 2 },
  AMZN:   { base: 192.0,  volatility: 2.8,  category: "Stocks", decimals: 2 },
  META:   { base: 525.0,  volatility: 8.0,  category: "Stocks", decimals: 2 },
  NVDA:   { base: 875.0,  volatility: 20.0, category: "Stocks", decimals: 2 },
  TSLA:   { base: 245.0,  volatility: 10.0, category: "Stocks", decimals: 2 },
  AMD:    { base: 175.0,  volatility: 5.0,  category: "Stocks", decimals: 2 },
  NFLX:   { base: 635.0,  volatility: 9.0,  category: "Stocks", decimals: 2 },
  JPM:    { base: 198.0,  volatility: 2.5,  category: "Stocks", decimals: 2 },
  GS:     { base: 455.0,  volatility: 5.5,  category: "Stocks", decimals: 2 },
  BAC:    { base: 38.5,   volatility: 0.55, category: "Stocks", decimals: 2 },
  DIS:    { base: 115.0,  volatility: 1.8,  category: "Stocks", decimals: 2 },
  INTC:   { base: 43.5,   volatility: 0.80, category: "Stocks", decimals: 2 },
  COIN:   { base: 225.0,  volatility: 12.0, category: "Stocks", decimals: 2 },
  // ── Indices ──
  SPX:    { base: 5200.0, volatility: 25.0, category: "Indices", decimals: 2 },
  SPY:    { base: 521.0,  volatility: 4.5,  category: "Indices", decimals: 2 },
  QQQ:    { base: 445.0,  volatility: 5.5,  category: "Indices", decimals: 2 },
  NDX:    { base: 18200,  volatility: 90.0, category: "Indices", decimals: 2 },
  DJI:    { base: 38500,  volatility: 180,  category: "Indices", decimals: 2 },
  GER40:  { base: 18200,  volatility: 80.0, category: "Indices", decimals: 2 },
  UK100:  { base: 8150,   volatility: 35.0, category: "Indices", decimals: 2 },
  JPN225: { base: 38400,  volatility: 200,  category: "Indices", decimals: 2 },
  VIX:    { base: 15.5,   volatility: 0.6,  category: "Indices", decimals: 2 },
};

const TF_SECONDS: Record<string, number> = {
  M1: 60, M5: 300, M15: 900, M30: 1800,
  H1: 3600, H4: 14400, D1: 86400,
};

function seed(n: number): number {
  const x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

function seededRandNorm(n: number): number {
  const u1 = seed(n * 1.2345 + 0.678);
  const u2 = seed(n * 9.8765 + 4.321);
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

function fmt(v: number, decimals: number): number {
  return +v.toFixed(decimals);
}

export function generateHistory(
  pair: string,
  tf: string,
  count: number = 500,
  endTime?: number,
): OHLCBar[] {
  const cfg = PAIR_CONFIG[pair] ?? PAIR_CONFIG["EURUSD"];
  const tfSec = TF_SECONDS[tf] ?? 3600;
  const now = endTime ?? Math.floor(Date.now() / 1000);
  const startTime = now - tfSec * count;

  const bars: OHLCBar[] = [];
  let price = cfg.base;
  const c0 = pair.charCodeAt(0) ?? 69;
  const c1 = pair.charCodeAt(1) ?? 85;
  const c2 = pair.charCodeAt(2) ?? 82;
  const c3 = pair.charCodeAt(3) ?? 85;

  for (let i = 0; i < count; i++) {
    const t = startTime + i * tfSec;
    const r1 = seededRandNorm(t + c0);
    const r2 = seededRandNorm(t + c1 + 100);
    const r3 = seededRandNorm(t + c2 + 200);
    const r4 = seededRandNorm(t + c3 + 300);

    const change = r1 * cfg.volatility;
    const open = price;
    const close = fmt(open + change, cfg.decimals);
    const wickRange = cfg.volatility * (0.5 + Math.abs(r2) * 1.5);
    const high = fmt(Math.max(open, close) + Math.abs(r3) * wickRange, cfg.decimals);
    const low  = fmt(Math.min(open, close) - Math.abs(r4) * wickRange, cfg.decimals);
    const volume = Math.floor(500 + seed(t) * 2000);

    bars.push({ time: t, open, high, low, close, volume });
    price = close;
  }
  return bars;
}

export function getNextCandle(prevBar: OHLCBar, pair: string, tf: string): OHLCBar {
  const cfg = PAIR_CONFIG[pair] ?? PAIR_CONFIG["EURUSD"];
  const tfSec = TF_SECONDS[tf] ?? 3600;
  const t = prevBar.time + tfSec;

  const change = (Math.random() - 0.5) * 2 * cfg.volatility;
  const open  = prevBar.close;
  const close = fmt(open + change, cfg.decimals);
  const wick  = cfg.volatility * (0.5 + Math.random() * 1.5);
  const r     = Math.random();
  const high  = fmt(Math.max(open, close) + r * wick, cfg.decimals);
  const low   = fmt(Math.min(open, close) - (1 - r) * wick, cfg.decimals);
  const volume = Math.floor(500 + Math.random() * 2000);

  return { time: t, open, high, low, close, volume };
}

export const PAIRS = Object.keys(PAIR_CONFIG);
export const TIMEFRAMES = Object.keys(TF_SECONDS);

export function getPairsByCategory(): Record<PairCategory, string[]> {
  const out: Record<PairCategory, string[]> = {
    Forex: [], Metals: [], Crypto: [], Stocks: [], Indices: [],
  };
  for (const [symbol, meta] of Object.entries(PAIR_CONFIG)) {
    out[meta.category].push(symbol);
  }
  return out;
}

export function getPairMeta(pair: string): PairMeta {
  return PAIR_CONFIG[pair] ?? PAIR_CONFIG["EURUSD"];
}
