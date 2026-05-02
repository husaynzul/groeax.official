export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const PAIR_CONFIG: Record<string, { base: number; volatility: number }> = {
  EURUSD: { base: 1.0850, volatility: 0.0008 },
  GBPUSD: { base: 1.2700, volatility: 0.0012 },
  USDJPY: { base: 149.50, volatility: 0.12 },
  AUDUSD: { base: 0.6540, volatility: 0.0007 },
  USDCAD: { base: 1.3600, volatility: 0.0008 },
  USDCHF: { base: 0.8900, volatility: 0.0007 },
  NZDUSD: { base: 0.6050, volatility: 0.0007 },
  EURJPY: { base: 162.20, volatility: 0.15 },
  GBPJPY: { base: 189.80, volatility: 0.18 },
  XAUUSD: { base: 2320.0, volatility: 2.5 },
};

const TF_SECONDS: Record<string, number> = {
  M1: 60, M5: 300, M15: 900, M30: 1800,
  H1: 3600, H4: 14400, D1: 86400,
};

function seed(n: number): number {
  let x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

function seededRandNorm(n: number): number {
  const u1 = seed(n * 1.2345 + 0.678);
  const u2 = seed(n * 9.8765 + 4.321);
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
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

  for (let i = 0; i < count; i++) {
    const t = startTime + i * tfSec;
    const r1 = seededRandNorm(t + pair.charCodeAt(0));
    const r2 = seededRandNorm(t + pair.charCodeAt(1) + 100);
    const r3 = seededRandNorm(t + pair.charCodeAt(2) + 200);
    const r4 = seededRandNorm(t + pair.charCodeAt(3) + 300);

    const change = r1 * cfg.volatility;
    const open = price;
    const close = +(open + change).toFixed(5);
    const wickRange = cfg.volatility * (0.5 + Math.abs(r2) * 1.5);
    const high = +(Math.max(open, close) + Math.abs(r3) * wickRange).toFixed(5);
    const low = +(Math.min(open, close) - Math.abs(r4) * wickRange).toFixed(5);
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
  const r1 = (Math.random() - 0.5) * 2;
  const r2 = Math.random();
  const r3 = Math.random();

  const change = r1 * cfg.volatility;
  const open = prevBar.close;
  const close = +(open + change).toFixed(5);
  const wickRange = cfg.volatility * (0.5 + r2 * 1.5);
  const high = +(Math.max(open, close) + r3 * wickRange).toFixed(5);
  const low = +(Math.min(open, close) - (1 - r3) * wickRange).toFixed(5);
  const volume = Math.floor(500 + Math.random() * 2000);

  return { time: t, open, high, low, close, volume };
}

export const PAIRS = Object.keys(PAIR_CONFIG);
export const TIMEFRAMES = Object.keys(TF_SECONDS);
