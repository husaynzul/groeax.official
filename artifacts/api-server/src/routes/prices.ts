import { Router } from "express";
import { YAHOO_SYMBOL_MAP } from "../services/yahooFinanceService.js";
import { logger } from "../lib/logger.js";

const router = Router();

const BINANCE_SUFFIXES = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB"];

async function fetchBinancePrice(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { price: string };
    return parseFloat(d.price);
  } catch {
    return null;
  }
}

async function fetchYahooPrice(yahooSymbol: string): Promise<number | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&includePrePost=false`;
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      chart: {
        result?: Array<{
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const closes =
      data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const last = closes.filter((v): v is number => v != null).at(-1);
    return last ?? null;
  } catch {
    return null;
  }
}

async function fetchCurrentPrice(pair: string): Promise<number | null> {
  const upper = pair.toUpperCase();

  if (BINANCE_SUFFIXES.some((s) => upper.endsWith(s))) {
    const price = await fetchBinancePrice(upper);
    if (price !== null) return price;
  }

  const yahooSym = YAHOO_SYMBOL_MAP[upper];
  if (yahooSym) return fetchYahooPrice(yahooSym);

  return null;
}

router.get("/prices", async (req, res) => {
  const raw =
    typeof req.query["symbols"] === "string" ? req.query["symbols"] : "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (symbols.length === 0) {
    res.json({ prices: {} });
    return;
  }

  req.log.info({ symbols }, "price fetch requested");

  const entries = await Promise.all(
    symbols.map(async (sym) => {
      const price = await fetchCurrentPrice(sym).catch((e) => {
        logger.warn({ sym, err: String(e) }, "price fetch error");
        return null;
      });
      return [sym, price] as [string, number | null];
    })
  );

  res.json({ prices: Object.fromEntries(entries) });
});

export default router;
