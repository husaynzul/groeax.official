import { Router, type Request, type Response } from "express";
import {
  generateHistory, getNextCandle,
  PAIRS, TIMEFRAMES, getPairsByCategory,
  type OHLCBar,
} from "../services/candleGenerator.js";
import { STRATEGIES } from "../services/backtestEngine.js";
import {
  BINANCE_SUPPORTED,
  fetchBinanceHistory,
  startBinanceWSStream,
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
const YAHOO_POLL_MS  = 15_000;
const TICK_MS        = 500;   // intra-candle tick interval for Yahoo & simulated

/** Volatility per tick as a fraction of price (tuned per asset class) */
function tickVolatility(pair: string): number {
  if (["BTCUSD","ETHUSD"].includes(pair)) return 0.00025;
  if (pair.endsWith("USD") && pair.length <= 7) return 0.00012; // crypto alts
  if (["XAUUSD","XAGUSD","XPTUSD","XPDUSD","WTIUSD","BRENTUSD"].includes(pair)) return 0.00018;
  if (["BTCUSD","ETHUSD","BNBUSD","SOLUSD","XRPUSD","ADAUSD","DOGEUSD","AVAXUSD","LINKUSD","DOTUSD","LTCUSD","MATICUSD","UNIUSD","ATOMUSD","NEARUSD"].includes(pair)) return 0.00022;
  if (["USDJPY","EURJPY","GBPJPY","CADJPY","CHFJPY"].includes(pair)) return 0.00008;
  if (pair.startsWith("EUR") || pair.startsWith("GBP") || pair.startsWith("USD") || pair.startsWith("AUD") || pair.startsWith("NZD")) return 0.00006;
  return 0.00010;
}

/** Advance a simulated bar by one random-walk tick */
function tickBar(bar: OHLCBar, pair: string): OHLCBar {
  const vol  = tickVolatility(pair);
  const drift = (Math.random() - 0.499) * bar.close * vol * 2;
  const close = Math.max(bar.close + drift, bar.close * 0.90);
  return {
    ...bar,
    close,
    high:   Math.max(bar.high, close),
    low:    Math.min(bar.low,  close),
  };
}

/** GBM-simulated stream: 500ms ticks, new candle every TF interval */
const TF_CANDLE_MS: Record<string, number> = {
  M1: 60_000, M5: 300_000, M15: 900_000, M30: 1_800_000,
  H1: 3_600_000, H4: 14_400_000, D1: 86_400_000,
};

function startGBMStream(
  req: Request, res: Response,
  pair: string, tf: string,
  push: (d: unknown) => void,
) {
  const history = generateHistory(pair, tf, 300);
  let simBar = { ...history[history.length - 1] };
  push({ type: "history", pair, tf, bars: history, source: "simulated" });

  const candleMs = TF_CANDLE_MS[tf] ?? 3_600_000;
  let nextCandleAt = Date.now() + candleMs;

  const tickTimer = setInterval(() => {
    try {
      if (Date.now() >= nextCandleAt) {
        // Open a new candle
        const next = getNextCandle(simBar, pair, tf);
        simBar = next;
        nextCandleAt = Date.now() + candleMs;
        push({ type: "candle", pair, tf, bar: simBar, source: "simulated" });
      } else {
        simBar = tickBar(simBar, pair);
        push({ type: "tick", pair, tf, bar: simBar, source: "simulated" });
      }
    } catch { /* ignore */ }
  }, TICK_MS);

  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 20_000);

  req.on("close", () => { clearInterval(tickTimer); clearInterval(heartbeat); });
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

  // ── Binance crypto — WebSocket stream, with REST-poll fallback ──
  if (BINANCE_SUPPORTED.has(pair)) {
    let history: OHLCBar[] = [];
    try {
      history = await fetchBinanceHistory(pair, tf, 300);
    } catch {
      startGBMStream(req, res, pair, tf, push);
      return;
    }

    push({ type: "history", pair, tf, bars: history, source: "binance" });

    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { /* ignore */ }
    }, 20_000);

    // Try WebSocket for real-time ticks (may be blocked on cloud IPs)
    let wsActive = false;
    const closeWs = startBinanceWSStream(pair, tf,
      (bar) => {
        wsActive = true;
        push({ type: "tick", pair, tf, bar, source: "binance" });
      },
      () => { wsActive = false; }, // WS failed — REST poll loop will take over
    );

    // REST poll every 1s — primary path when WS is blocked, backup otherwise
    let simBar = history[history.length - 1];
    const restTimer = setInterval(async () => {
      if (wsActive) return; // WS is working, skip REST poll
      try {
        const bar = await fetchLatestBinanceCandle(pair, tf);
        if (bar) {
          // Anchor to real price, add synthetic ticks between polls
          simBar = bar;
          push({ type: "tick", pair, tf, bar, source: "binance" });
        } else {
          simBar = tickBar(simBar, pair);
          push({ type: "tick", pair, tf, bar: simBar, source: "binance" });
        }
      } catch {
        simBar = tickBar(simBar, pair);
        push({ type: "tick", pair, tf, bar: simBar, source: "binance" });
      }
    }, 1_000);

    req.on("close", () => { closeWs(); clearInterval(restTimer); clearInterval(heartbeat); });
    return;
  }

  // ── Yahoo Finance — 15s real poll + 500ms synthetic ticks ──
  if (YAHOO_SUPPORTED.has(pair)) {
    try {
      const history = await fetchYahooHistory(pair, tf, 300);
      push({ type: "history", pair, tf, bars: history, source: "yahoo" });

      let simBar = { ...history[history.length - 1] };

      // 500ms synthetic ticks for smooth intra-candle movement
      const tickTimer = setInterval(() => {
        try {
          simBar = tickBar(simBar, pair);
          push({ type: "tick", pair, tf, bar: simBar, source: "yahoo" });
        } catch { /* ignore */ }
      }, TICK_MS);

      // Every 15s, refresh from Yahoo to anchor to real price
      const pollTimer = setInterval(async () => {
        try {
          const bar = await fetchLatestYahooBar(pair, tf);
          if (bar && bar.time >= simBar.time) {
            simBar = bar;
            push({ type: "candle", pair, tf, bar, source: "yahoo" });
          }
        } catch { /* ignore */ }
      }, YAHOO_POLL_MS);

      const heartbeat = setInterval(() => {
        try { res.write(": ping\n\n"); } catch { /* ignore */ }
      }, 20_000);

      req.on("close", () => {
        clearInterval(tickTimer);
        clearInterval(pollTimer);
        clearInterval(heartbeat);
      });
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
