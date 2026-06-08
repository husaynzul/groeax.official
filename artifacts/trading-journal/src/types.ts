export const PRIMARY_STRATEGIES = [
  "Fair Value Gap (FVG)",
  "Order Block",
  "Break of Structure (BOS)",
  "Change of Character (CHoCH)",
  "Liquidity Grab / Stop Hunt",
  "Support / Resistance",
  "Trend Continuation",
  "Reversal Setup",
] as const;

export const PATTERN_TYPES = [
  "Continuation Pattern",
  "Reversal Pattern",
  "Breakout Pattern",
  "Pullback Entry",
  "Range Trading",
] as const;

export type PrimaryStrategy = (typeof PRIMARY_STRATEGIES)[number];
export type PatternType = (typeof PATTERN_TYPES)[number];

export const TRADING_SESSIONS = ["ASIA", "TOKYO", "LONDON", "NEW_YORK"] as const;
export type TradingSession = (typeof TRADING_SESSIONS)[number];

export const SESSION_LABELS: Record<TradingSession, string> = {
  ASIA: "Asia",
  TOKYO: "Tokyo",
  LONDON: "London",
  NEW_YORK: "New York",
};

export const SESSION_HOURS_UTC: Record<TradingSession, { start: number; end: number }> = {
  ASIA:     { start: 23, end: 8 },
  TOKYO:    { start: 0,  end: 9 },
  LONDON:   { start: 8,  end: 17 },
  NEW_YORK: { start: 13, end: 22 },
};

export function detectSession(date: Date = new Date()): TradingSession | undefined {
  const h = date.getUTCHours();
  if (h >= 13 && h < 22) return "NEW_YORK";
  if (h >= 8  && h < 17) return "LONDON";
  if (h >= 0  && h < 9)  return "TOKYO";
  if (h >= 23 || h < 8)  return "ASIA";
  return undefined;
}

export interface Trade {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  date: string;
  notes?: string;
  outcome?: "WIN" | "LOSS" | "BE";
  netProfit: number;
  netLoss: number;
  rr: number;
  strategy?: string;
  patterns?: string[];
  session?: TradingSession;
}
