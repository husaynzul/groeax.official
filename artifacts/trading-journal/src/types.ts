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
}
