import type { Time } from "lightweight-charts";

export interface LinePt { time: Time; value: number }

/* ── EMA ──────────────────────────────────────────────────────────── */
export function calcEMA(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += closes[i];
  result[period - 1] = seed / period;
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

/* ── RSI (Wilder smoothing) ───────────────────────────────────────── */
export function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }
  return result;
}

/* ── MACD ─────────────────────────────────────────────────────────── */
export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i],
  );
  // Build signal EMA only over non-NaN MACD values
  const nonNan: number[] = macdLine.filter((v) => !isNaN(v));
  const sigValues = calcEMA(nonNan, signal);
  let si = 0;
  const signalLine = macdLine.map((v) => (isNaN(v) ? NaN : sigValues[si++] ?? NaN));
  const histogram = macdLine.map((v, i) =>
    isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i],
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

/* ── LW Charts helpers ────────────────────────────────────────────── */
export function toLinePts(times: number[], values: number[]): LinePt[] {
  const out: LinePt[] = [];
  for (let i = 0; i < times.length; i++) {
    if (!isNaN(values[i]) && isFinite(values[i])) {
      out.push({ time: times[i] as Time, value: values[i] });
    }
  }
  return out;
}
