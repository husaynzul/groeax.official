import type { OHLCBar } from "./candleGenerator.js";

export interface Signal {
  time: number;
  type: "BUY" | "SELL";
  price: number;
  label?: string;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  type: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  pnlPips: number;
  pnlUSD: number;
}

export interface BacktestResult {
  strategy: string;
  signals: Signal[];
  trades: BacktestTrade[];
  metrics: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnLPips: number;
    totalPnLUSD: number;
    expectancy: number;
    maxDrawdownUSD: number;
    profitFactor: number;
    avgWinPips: number;
    avgLossPips: number;
  };
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  for (const v of values) {
    const e = v * k + prev * (1 - k);
    result.push(e);
    prev = e;
  }
  return result;
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function simulateTrades(bars: OHLCBar[], signals: Signal[], pipValue = 10): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let openTrade: { signal: Signal; bar: OHLCBar } | null = null;

  for (let i = 0; i < signals.length; i++) {
    const sig = signals[i];
    const bar = bars.find((b) => b.time >= sig.time) ?? bars[bars.length - 1];

    if (!openTrade) {
      openTrade = { signal: sig, bar };
    } else {
      const entry = openTrade.signal;
      const diff = sig.price - entry.price;
      const pips = entry.type === "BUY" ? diff * 10000 : -diff * 10000;
      trades.push({
        entryTime: entry.time,
        exitTime: sig.time,
        type: entry.type,
        entryPrice: entry.price,
        exitPrice: sig.price,
        pnlPips: +pips.toFixed(1),
        pnlUSD: +(pips * pipValue * 0.01).toFixed(2),
      });
      openTrade = { signal: sig, bar };
    }
  }
  return trades;
}

function computeMetrics(trades: BacktestTrade[], strategy: string): BacktestResult["metrics"] {
  const wins = trades.filter((t) => t.pnlPips > 0);
  const losses = trades.filter((t) => t.pnlPips <= 0);
  const totalPnLPips = trades.reduce((a, t) => a + t.pnlPips, 0);
  const totalPnLUSD = trades.reduce((a, t) => a + t.pnlUSD, 0);
  const avgWinPips = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlPips, 0) / wins.length : 0;
  const avgLossPips = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnlPips, 0) / losses.length) : 0;
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const expectancy = winRate * avgWinPips - (1 - winRate) * avgLossPips;
  const grossWin = wins.reduce((a, t) => a + t.pnlUSD, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlUSD, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  let peak = 0, equity = 0, maxDrawdownUSD = 0;
  for (const t of trades) {
    equity += t.pnlUSD;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdownUSD) maxDrawdownUSD = dd;
  }

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: +winRate.toFixed(4),
    totalPnLPips: +totalPnLPips.toFixed(1),
    totalPnLUSD: +totalPnLUSD.toFixed(2),
    expectancy: +expectancy.toFixed(2),
    maxDrawdownUSD: +maxDrawdownUSD.toFixed(2),
    profitFactor: +profitFactor.toFixed(3),
    avgWinPips: +avgWinPips.toFixed(1),
    avgLossPips: +avgLossPips.toFixed(1),
  };
}

export function runEMACrossover(bars: OHLCBar[], fast = 9, slow = 21): BacktestResult {
  const closes = bars.map((b) => b.close);
  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);

  const signals: Signal[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prevCross = fastEMA[i - 1] - slowEMA[i - 1];
    const currCross = fastEMA[i] - slowEMA[i];
    if (prevCross <= 0 && currCross > 0) {
      signals.push({ time: bars[i].time, type: "BUY", price: bars[i].close, label: `EMA${fast}×${slow} BUY` });
    } else if (prevCross >= 0 && currCross < 0) {
      signals.push({ time: bars[i].time, type: "SELL", price: bars[i].close, label: `EMA${fast}×${slow} SELL` });
    }
  }

  const trades = simulateTrades(bars, signals);
  return { strategy: `EMA ${fast}/${slow} Crossover`, signals, trades, metrics: computeMetrics(trades, `EMA ${fast}/${slow}`) };
}

export function runSMACrossover(bars: OHLCBar[], fast = 20, slow = 50): BacktestResult {
  const closes = bars.map((b) => b.close);
  const fastSMA = sma(closes, fast);
  const slowSMA = sma(closes, slow);

  const signals: Signal[] = [];
  for (let i = 1; i < bars.length; i++) {
    const pf = fastSMA[i - 1], ps = slowSMA[i - 1];
    const cf = fastSMA[i], cs = slowSMA[i];
    if (pf == null || ps == null || cf == null || cs == null) continue;
    if (pf <= ps && cf > cs) signals.push({ time: bars[i].time, type: "BUY", price: bars[i].close, label: `SMA${fast}×${slow} BUY` });
    else if (pf >= ps && cf < cs) signals.push({ time: bars[i].time, type: "SELL", price: bars[i].close, label: `SMA${fast}×${slow} SELL` });
  }

  const trades = simulateTrades(bars, signals);
  return { strategy: `SMA ${fast}/${slow} Crossover`, signals, trades, metrics: computeMetrics(trades, `SMA ${fast}/${slow}`) };
}

export function runRSI(bars: OHLCBar[], period = 14, oversold = 30, overbought = 70): BacktestResult {
  const closes = bars.map((b) => b.close);
  const rsiVals = rsi(closes, period);
  const signals: Signal[] = [];
  let inTrade: "BUY" | "SELL" | null = null;

  for (let i = 1; i < bars.length; i++) {
    const prev = rsiVals[i - 1], curr = rsiVals[i];
    if (prev == null || curr == null) continue;
    if (prev <= oversold && curr > oversold && inTrade !== "BUY") {
      signals.push({ time: bars[i].time, type: "BUY", price: bars[i].close, label: `RSI(${period}) BUY` });
      inTrade = "BUY";
    } else if (prev >= overbought && curr < overbought && inTrade !== "SELL") {
      signals.push({ time: bars[i].time, type: "SELL", price: bars[i].close, label: `RSI(${period}) SELL` });
      inTrade = "SELL";
    }
  }

  const trades = simulateTrades(bars, signals);
  return { strategy: `RSI(${period}) ${oversold}/${overbought}`, signals, trades, metrics: computeMetrics(trades, `RSI`) };
}

export function runBollingerBreakout(bars: OHLCBar[], period = 20, stdDev = 2): BacktestResult {
  const closes = bars.map((b) => b.close);
  const signals: Signal[] = [];

  for (let i = period; i < bars.length; i++) {
    const slice = closes.slice(i - period, i);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    const upper = mean + stdDev * std;
    const lower = mean - stdDev * std;
    const price = bars[i].close;
    const prevPrice = bars[i - 1].close;
    if (prevPrice <= lower && price > lower) signals.push({ time: bars[i].time, type: "BUY", price, label: "BB BUY" });
    else if (prevPrice >= upper && price < upper) signals.push({ time: bars[i].time, type: "SELL", price, label: "BB SELL" });
  }

  const trades = simulateTrades(bars, signals);
  return { strategy: `Bollinger Breakout (${period}, ${stdDev}σ)`, signals, trades, metrics: computeMetrics(trades, "BB") };
}

export const STRATEGIES: Record<string, (bars: OHLCBar[]) => BacktestResult> = {
  ema_9_21: (bars) => runEMACrossover(bars, 9, 21),
  ema_5_20: (bars) => runEMACrossover(bars, 5, 20),
  sma_20_50: (bars) => runSMACrossover(bars, 20, 50),
  rsi_14: (bars) => runRSI(bars, 14),
  bb_breakout: (bars) => runBollingerBreakout(bars, 20, 2),
};
