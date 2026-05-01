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

export interface Trade {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
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
}
