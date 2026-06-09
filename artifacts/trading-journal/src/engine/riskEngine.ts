export interface PipConfig {
  pipSize: number;
  pipValue: number;
}

const PIP_MAP: Record<string, PipConfig> = {
  // ── Gold / XAU (all broker variants) ──────────────────────────────────
  "XAUUSD":   { pipSize: 0.01, pipValue: 1 },
  "XAU/USD":  { pipSize: 0.01, pipValue: 1 },
  "XAUUSDM":  { pipSize: 0.01, pipValue: 1 },   // suffix "m" micro accounts
  "XAUUSDPRO":{ pipSize: 0.01, pipValue: 1 },
  "XAUUSD.":  { pipSize: 0.01, pipValue: 1 },
  "GOLD":     { pipSize: 0.01, pipValue: 1 },
  "XAUUSDT":  { pipSize: 0.01, pipValue: 1 },   // some crypto-ish brokers
  "GOLDUSD":  { pipSize: 0.01, pipValue: 1 },
  "XAUM":     { pipSize: 0.01, pipValue: 1 },
  // ── Silver ────────────────────────────────────────────────────────────
  "XAGUSD":   { pipSize: 0.001, pipValue: 5 },
  "XAG/USD":  { pipSize: 0.001, pipValue: 5 },
  "SILVER":   { pipSize: 0.001, pipValue: 5 },
  // ── Indices ───────────────────────────────────────────────────────────
  "US30":     { pipSize: 1, pipValue: 1 },
  "DJ30":     { pipSize: 1, pipValue: 1 },
  "DOWJONES": { pipSize: 1, pipValue: 1 },
  "NAS100":   { pipSize: 1, pipValue: 1 },
  "NASDAQ":   { pipSize: 1, pipValue: 1 },
  "NDX100":   { pipSize: 1, pipValue: 1 },
  "USTEC":    { pipSize: 1, pipValue: 1 },
  "US100":    { pipSize: 1, pipValue: 1 },
  "UK100":    { pipSize: 1, pipValue: 1 },
  "GER40":    { pipSize: 1, pipValue: 1 },
  "GER30":    { pipSize: 1, pipValue: 1 },
  "DAX40":    { pipSize: 1, pipValue: 1 },
  "DE40":     { pipSize: 1, pipValue: 1 },
  "SPX500":   { pipSize: 0.1, pipValue: 1 },
  "SP500":    { pipSize: 0.1, pipValue: 1 },
  "US500":    { pipSize: 0.1, pipValue: 1 },
  "FRA40":    { pipSize: 1, pipValue: 1 },
  "AUS200":   { pipSize: 1, pipValue: 1 },
  "JPN225":   { pipSize: 1, pipValue: 1 },
  // ── Crypto ────────────────────────────────────────────────────────────
  "BTCUSD":   { pipSize: 1,   pipValue: 0.001 },
  "BTCUSDT":  { pipSize: 1,   pipValue: 0.001 },
  "ETHUSD":   { pipSize: 0.1, pipValue: 0.01  },
  "ETHUSDT":  { pipSize: 0.1, pipValue: 0.01  },
};

const DEFAULT_PIP: PipConfig = { pipSize: 0.0001, pipValue: 10 };

export function getPipConfig(pair: string): PipConfig {
  // Strip spaces, slashes, and trailing broker suffixes like "m", ".b", etc.
  const norm = pair.toUpperCase().replace(/[\s/]/g, "");

  // Exact match first
  if (PIP_MAP[norm]) return PIP_MAP[norm];

  // Match any key that the normalised pair STARTS WITH
  // e.g. "XAUUSDm" starts with "XAUUSD"
  for (const key of Object.keys(PIP_MAP)) {
    if (norm.startsWith(key)) return PIP_MAP[key];
  }

  // JPY pairs use 0.01 pip size
  if (norm.includes("JPY")) return { pipSize: 0.01, pipValue: 1000 };

  return DEFAULT_PIP;
}

export function calcNetProfit(entry: number, tp: number, lotSize: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  const pips = (tp - entry) / cfg.pipSize;
  return parseFloat((pips * cfg.pipValue * lotSize).toFixed(2));
}

export function calcNetLoss(entry: number, sl: number, lotSize: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  const pips = (entry - sl) / cfg.pipSize;
  return parseFloat((pips * cfg.pipValue * lotSize).toFixed(2));
}

export function calcExitPnL(
  entry: number,
  exitPrice: number,
  lotSize: number,
  direction: "BUY" | "SELL",
  pair = "EUR/USD",
): number {
  const cfg = getPipConfig(pair);
  const rawDiff = direction === "BUY" ? exitPrice - entry : entry - exitPrice;
  return parseFloat(((rawDiff / cfg.pipSize) * cfg.pipValue * lotSize).toFixed(2));
}

export function calcRR(netProfit: number, netLoss: number): number {
  return netLoss === 0 ? 0 : parseFloat((netProfit / netLoss).toFixed(2));
}

export const PIP_SIZE = 0.0001;
export const PIP_VALUE_PER_LOT = 10;

export function calcProfitPips(entry: number, tp: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  return parseFloat(((tp - entry) / cfg.pipSize).toFixed(1));
}

export function calcLossPips(entry: number, sl: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  return parseFloat(((entry - sl) / cfg.pipSize).toFixed(1));
}

export function calcPipValue(lotSize: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  return parseFloat((cfg.pipValue * lotSize).toFixed(2));
}
