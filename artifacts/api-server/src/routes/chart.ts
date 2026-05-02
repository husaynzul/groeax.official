import { Router, type Request, type Response } from "express";
import {
  generateHistory, getNextCandle,
  PAIRS, TIMEFRAMES, getPairsByCategory,
} from "../services/candleGenerator.js";
import { STRATEGIES } from "../services/backtestEngine.js";
import {
  BINANCE_SUPPORTED,
  fetchBinanceHistory,
  fetchLatestBinanceCandle,
} from "../services/binanceService.js";
import {
  YAHOO_SUPPORTED,
  fetchYahooHistory,
  fetchLatestYahooBar,
} from "../services/yahooFinanceService.js";

const router = Router();

router.get("/chart/pairs", (_req, res) => {
  res.json({ pairs: PAIRS, timeframes: TIMEFRAMES, byCategory: getPairsByCategory() });
});

router.get("/chart/candles", async (req, res) => {
  const pair  = String(req.query["pair"]  ?? "EURUSD");
  const tf    = String(req.query["tf"]    ?? "H1");
  const limit = Math.min(Number(req.query["limit"] ?? 500), 2000);

  if (!PAIRS.includes(pair)) { res.status(400).json({ error: `Unknown pair: ${pair}` }); return; }
  if (!TIMEFRAMES.includes(tf)) { res.status(400).json({ error: `Unknown timeframe: ${tf}` }); return; }

  if (BINANCE_SUPPORTED.has(pair)) {
    try {
      const bars = await fetchBinanceHistory(pair, tf, limit);
      res.json({ pair, tf, count: bars.length, bars, source: "binance" });
    } catch {
      res.json({ pair, tf, count: 0, bars: generateHistory(pair, tf, limit), source: "simulated" });
    }
    return;
  }

  if (YAHOO_SUPPORTED.has(pair)) {
    try {
      const bars = await fetchYahooHistory(pair, tf, limit);
      res.json({ pair, tf, count: bars.length, bars, source: "yahoo" });
    } catch {
      res.json({ pair, tf, count: 0, bars: generateHistory(pair, tf, limit), source: "simulated" });
    }
    return;
  }

  const bars = generateHistory(pair, tf, limit);
  res.json({ pair, tf, count: bars.length, bars, source: "simulated" });
});

// ── Server-Sent Events live feed ──────────────────────────────────────
const TF_INTERVAL_MS: Record<string, number> = {
  M1: 2500, M5: 3500, M15: 5000, M30: 6000,
  H1: 7000, H4: 9000, D1: 12000,
};
const YAHOO_POLL_MS = 15_000; // Yahoo Finance is rate-limited; poll every 15s

function startGBMStream(
  req: Request, res: Response,
  pair: string, tf: string,
  push: (d: unknown) => void,
) {
  const history = generateHistory(pair, tf, 300);
  let latestBar = history[history.length - 1];
  push({ type: "history", pair, tf, bars: history, source: "simulated" });

  const ms = TF_INTERVAL_MS[tf] ?? 7000;
  const timer = setInterval(() => {
    try {
      const next = getNextCandle(latestBar, pair, tf);
      latestBar = next;
      push({ type: "candle", pair, tf, bar: next, source: "simulated" });
    } catch { /* ignore */ }
  }, ms);

  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 20_000);

  req.on("close", () => { clearInterval(timer); clearInterval(heartbeat); });
}

router.get("/chart/live", async (req, res) => {
  const pair = String(req.query["pair"] ?? "EURUSD");
  const tf   = String(req.query["tf"]   ?? "H1");

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache, no-transform");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const push = (data: unknown) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* ignore */ }
  };

  // ── Binance crypto ──
  if (BINANCE_SUPPORTED.has(pair)) {
    try {
      const history = await fetchBinanceHistory(pair, tf, 300);
      push({ type: "history", pair, tf, bars: history, source: "binance" });

      const timer = setInterval(async () => {
        try {
          const bar = await fetchLatestBinanceCandle(pair, tf);
          if (bar) push({ type: "candle", pair, tf, bar, source: "binance" });
        } catch { /* ignore */ }
      }, 2000);

      const heartbeat = setInterval(() => {
        try { res.write(": ping\n\n"); } catch { /* ignore */ }
      }, 20_000);

      req.on("close", () => { clearInterval(timer); clearInterval(heartbeat); });
    } catch {
      startGBMStream(req, res, pair, tf, push);
    }
    return;
  }

  // ── Yahoo Finance forex / stocks / metals / indices ──
  if (YAHOO_SUPPORTED.has(pair)) {
    try {
      const history = await fetchYahooHistory(pair, tf, 300);
      push({ type: "history", pair, tf, bars: history, source: "yahoo" });

      let lastBarTime = history.length ? history[history.length - 1].time : 0;

      const timer = setInterval(async () => {
        try {
          const bar = await fetchLatestYahooBar(pair, tf);
          if (bar && bar.time >= lastBarTime) {
            lastBarTime = bar.time;
            push({ type: "candle", pair, tf, bar, source: "yahoo" });
          }
        } catch { /* ignore */ }
      }, YAHOO_POLL_MS);

      const heartbeat = setInterval(() => {
        try { res.write(": ping\n\n"); } catch { /* ignore */ }
      }, 20_000);

      req.on("close", () => { clearInterval(timer); clearInterval(heartbeat); });
    } catch {
      startGBMStream(req, res, pair, tf, push);
    }
    return;
  }

  // ── Simulated fallback ──
  startGBMStream(req, res, pair, tf, push);
});

// ── Backtest ──────────────────────────────────────────────────────────
router.post("/chart/backtest", (req, res) => {
  const { pair = "EURUSD", tf = "H1", strategy = "ema_9_21", limit = 500 } = req.body ?? {};

  if (!STRATEGIES[strategy as string]) {
    res.status(400).json({ error: `Unknown strategy: ${strategy}`, available: Object.keys(STRATEGIES) });
    return;
  }

  const bars   = generateHistory(pair as string, tf as string, Number(limit));
  const result = STRATEGIES[strategy as string](bars);

  res.json({
    pair, tf, strategy,
    candleCount: bars.length,
    signalCount: result.signals.length,
    bars,
    signals: result.signals,
    trades:  result.trades.slice(-100),
    metrics: result.metrics,
    strategyName: result.strategy,
  });
});

// ── Strategies meta ───────────────────────────────────────────────────
router.get("/chart/strategies", (_req, res) => {
  res.json({
    strategies: [
      { id: "ema_9_21",    name: "EMA 9/21 Crossover",          description: "Fast EMA(9) crosses Slow EMA(21)" },
      { id: "ema_5_20",    name: "EMA 5/20 Crossover",          description: "Fast EMA(5) crosses Slow EMA(20)" },
      { id: "sma_20_50",   name: "SMA 20/50 Crossover",         description: "SMA(20) crosses SMA(50)" },
      { id: "rsi_14",      name: "RSI(14) Oversold/Overbought", description: "Buy < 30, Sell > 70" },
      { id: "bb_breakout", name: "Bollinger Breakout",           description: "Price breaks Bollinger Bands (20, 2σ)" },
    ],
  });
});

export default router;
