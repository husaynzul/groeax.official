import { parseBrokerPrice } from "./priceParser";
import type { OCRResult } from "@/components/trades/OCRImportModal";

// ─── Known forex / commodity / index / crypto symbols ───────────────────────
const KNOWN_SYMBOLS = [
  "XAUUSD","XAGUSD","XPTUSD","XPDUSD",
  "EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD",
  "EURGBP","EURJPY","GBPJPY","AUDJPY","CADJPY","CHFJPY","NZDJPY",
  "EURAUD","EURNZD","EURCAD","EURCHF","GBPAUD","GBPNZD","GBPCAD","GBPCHF",
  "AUDNZD","AUDCAD","AUDCHF","NZDCAD","NZDCHF","CADCHF",
  "BTCUSD","ETHUSD","BNBUSD","XRPUSD","SOLUSD","DOGEUSD","LTCUSD",
  "US30","US500","NAS100","UK100","GER40","JPN225","AUS200",
  "USOIL","UKOIL","NATGAS",
];

// ─── Helper: find first regex match group ────────────────────────────────────
function match(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]).trim() : null;
}

function matchPrice(text: string, re: RegExp): number | null {
  const raw = match(text, re);
  if (!raw) return null;
  const n = parseBrokerPrice(raw);
  return n > 0 ? n : null;
}

// ─── Symbol detection ────────────────────────────────────────────────────────
function detectSymbol(text: string): string | null {
  const upper = text.toUpperCase();

  // Try known symbols first (most reliable)
  for (const sym of KNOWN_SYMBOLS) {
    // accept with or without slash: XAUUSD or XAU/USD
    const withSlash = sym.slice(0, 3) + "/" + sym.slice(3);
    if (upper.includes(sym) || upper.includes(withSlash)) return sym;
  }

  // Fallback: look for 6-letter all-caps word that looks like a forex pair
  const m = upper.match(/\b([A-Z]{6})\b/);
  if (m) return m[1];

  // Try slash-separated pairs: XAU/USD
  const slash = upper.match(/\b([A-Z]{3})\/([A-Z]{3})\b/);
  if (slash) return slash[1] + slash[2];

  return null;
}

// ─── Direction detection ─────────────────────────────────────────────────────
function detectDirection(text: string): "BUY" | "SELL" | null {
  const upper = text.toUpperCase();
  // Buy variants — check longer tokens first to avoid "BUY" inside "BUY STOP"
  if (/\b(BUY\s*STOP|BUY\s*LIMIT|BUY\s*ORDER|BUY)\b/.test(upper)) return "BUY";
  if (/\b(SELL\s*STOP|SELL\s*LIMIT|SELL\s*ORDER|SELL)\b/.test(upper)) return "SELL";
  // MT5 compact format: "b" for buy, "s" for sell on a standalone line
  if (/^\s*b\s*$/im.test(text)) return "BUY";
  if (/^\s*s\s*$/im.test(text)) return "SELL";
  return null;
}

// ─── Numeric field patterns ──────────────────────────────────────────────────
const PRICE_NUM = /[\d,]+\.[\d]+/;

function buildPriceRe(...labels: string[]): RegExp {
  const joined = labels.map(l => l.replace(/[/\\^$.*+?()[\]{}|]/g, "\\$&")).join("|");
  return new RegExp(`(?:${joined})[:\\s]+([\\d,\\.]+)`, "i");
}

function detectEntry(text: string): number | null {
  return matchPrice(text, buildPriceRe(
    "open price","open","entry price","entry","price open","at price","open at","opened at"
  ));
}

function detectExit(text: string): number | null {
  return matchPrice(text, buildPriceRe(
    "close price","close","exit price","exit","price close","close at","closed at"
  ));
}

function detectSL(text: string): number | null {
  return matchPrice(text, buildPriceRe(
    "stop loss","s/l","sl","stoploss","stop"
  ));
}

function detectTP(text: string): number | null {
  return matchPrice(text, buildPriceRe(
    "take profit","t/p","tp","takeprofit"
  ));
}

function detectLotSize(text: string): number | null {
  // Explicit label
  const labelled = matchPrice(text, buildPriceRe("lot size","lot","volume","size","quantity","qty"));
  if (labelled) return labelled;

  // Standalone: a small decimal like 0.01, 0.1, 0.5, 1.0 on its own line
  // after direction keyword (common MT4/MT5 format: "Buy 0.01")
  const inline = text.match(/\b(?:buy|sell)\s+([\d]+\.[\d]{1,2})\b/i);
  if (inline) {
    const n = parseFloat(inline[1]);
    if (n > 0 && n <= 1000) return n;
  }
  return null;
}

function detectProfit(text: string): number | null {
  // Try labelled first
  const labelled = match(text, /(?:profit|p&l|pnl|net|result|gain|loss result)[:\s]+([+-]?[\d,]+\.[\d]+)\s*(?:usd)?/i);
  if (labelled) {
    const n = parseBrokerPrice(labelled);
    return isFinite(n) ? n : null;
  }
  // Trailing "26.90 USD" or "-35.40 USD" or "+26.90"
  const trailing = text.match(/([+-]?[\d,]+\.[\d]+)\s*(?:USD|EUR|GBP|JPY)?\s*$/im);
  if (trailing) {
    const n = parseBrokerPrice(trailing[1]);
    return isFinite(n) && n !== 0 ? n : null;
  }
  return null;
}

// ─── Date detection ──────────────────────────────────────────────────────────
function detectDate(text: string): string | null {
  // ISO: 2024-01-15  or  2024.01.15
  const iso = text.match(/\b(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // US: 01/15/2024 or 01-15-2024
  const us = text.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
  if (us) {
    const [, mm, dd, yyyy] = us;
    return `${yyyy}-${mm}-${dd}`;
  }

  // MT4/MT5 datetime: "2024.01.15 14:23:56"
  const mt = text.match(/(\d{4})\.(\d{2})\.(\d{2})\s+\d{2}:\d{2}/);
  if (mt) return `${mt[1]}-${mt[2]}-${mt[3]}`;

  return null;
}

// ─── Outcome detection ───────────────────────────────────────────────────────
function detectOutcome(profit: number | null, text: string): "WIN" | "LOSS" | "BE" | null {
  if (profit !== null) {
    if (profit > 0) return "WIN";
    if (profit < 0) return "LOSS";
    return "BE";
  }
  const upper = text.toUpperCase();
  if (/\bWIN\b|\bPROFIT\b|\bGAIN\b/.test(upper)) return "WIN";
  if (/\bLOSS\b|\bLOSE\b/.test(upper)) return "LOSS";
  return null;
}

// ─── Session detection (from date/time in text) ──────────────────────────────
function detectSession(text: string): "ASIA" | "TOKYO" | "LONDON" | "NEW_YORK" | null {
  const timeMatch = text.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/);
  if (!timeMatch) return null;
  const hour = parseInt(timeMatch[1], 10);
  // UTC approximate session hours
  if (hour >= 0 && hour < 9) return "ASIA";
  if (hour >= 2 && hour < 9) return "TOKYO";
  if (hour >= 8 && hour < 16) return "LONDON";
  if (hour >= 13 && hour < 22) return "NEW_YORK";
  return null;
}

// ─── Main entry point ────────────────────────────────────────────────────────
export function parseOcrText(rawText: string): OCRResult {
  const text = rawText;

  const pair = detectSymbol(text);
  const direction = detectDirection(text);
  const entryPrice = detectEntry(text);
  const exitPrice = detectExit(text);
  const stopLoss = detectSL(text);
  const takeProfit = detectTP(text);
  const lotSize = detectLotSize(text);
  const profit = detectProfit(text);
  const date = detectDate(text);
  const outcome = detectOutcome(profit, text);
  const session = detectSession(text);

  return {
    pair,
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    lotSize,
    profit,
    date,
    outcome,
    session,
    strategy: null,
    patterns: [],
    notes: null,
  };
}
