import { Trade, PRIMARY_STRATEGIES } from "../types";
import { parseBrokerPrice } from "./priceParser";

export interface ParsedCSVResult {
  trades: Trade[];
  skipped: number;
  errors: string[];
  columnMap: Record<string, string>;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  date:        ["date","time","opentime","open time","closetime","close time","entry date","entrydate","trade date","tradedate"],
  pair:        ["pair","symbol","instrument","currency","market","ticker","asset","security"],
  direction:   ["direction","type","side","action","buysell","order type","ordertype","trade type","tradetype"],
  entryPrice:  ["entry","entryprice","entry price","open","openprice","open price","price in","pricein"],
  stopLoss:    ["sl","stoploss","stop loss","stop","risk"],
  takeProfit:  ["tp","takeprofit","take profit","target","profit target"],
  lotSize:     ["lots","lot","volume","size","lotsize","lot size","quantity","qty"],
  outcome:     ["outcome","result","status","win/loss","win loss"],
  netProfit:   ["profit","pl","pnl","p&l","net","netprofit","net profit","net p&l","netpnl","gain"],
  netLoss:     ["loss","netloss","net loss"],
  rr:          ["rr","r:r","riskreward","risk reward","risk:reward","riskratio"],
  strategy:    ["strategy","setup","pattern","signal"],
  notes:       ["notes","comment","remarks","description","memo","reason","note"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detectColumn(header: string): string | null {
  const norm = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => normalizeHeader(a) === norm)) return field;
    if (norm === field.toLowerCase()) return field;
  }
  return null;
}

function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/,          // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/,          // MM/DD/YYYY or DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/,            // MM-DD-YYYY
    /^(\d{4})\.(\d{2})\.(\d{2})/,          // YYYY.MM.DD
  ];
  for (const re of formats) {
    const m = raw.match(re);
    if (m) {
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split("T")[0];
        }
      } catch {}
    }
  }
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return null;
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  return parseBrokerPrice(raw);
}

function parseDirection(raw: string | undefined): "BUY" | "SELL" {
  if (!raw) return "BUY";
  const v = raw.toUpperCase().trim();
  if (["BUY","LONG","B","L","BOT","BT"].includes(v)) return "BUY";
  return "SELL";
}

function parseOutcome(raw: string | undefined, pnl?: number): "WIN" | "LOSS" | "BE" | undefined {
  if (!raw) {
    if (pnl !== undefined) {
      return pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BE";
    }
    return undefined;
  }
  const v = raw.toUpperCase().trim();
  if (["WIN","W","WON","PROFIT","P","WINNER","YES"].includes(v)) return "WIN";
  if (["LOSS","L","LOSE","LOST","LOSER","NO"].includes(v)) return "LOSS";
  return "BE";
}

function detectStrategy(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = PRIMARY_STRATEGIES.find((s) =>
    s.toLowerCase().includes(raw.toLowerCase()) || raw.toLowerCase().includes(s.toLowerCase().split(" ")[0])
  );
  return match ?? (raw.trim() || undefined);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCSV(csvText: string): ParsedCSVResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { trades: [], skipped: 0, errors: ["CSV file appears empty or has no data rows."], columnMap: {} };
  }

  const headers = parseCSVLine(lines[0]);
  const columnMap: Record<string, string> = {};
  const fieldIndex: Record<string, number> = {};

  headers.forEach((h, i) => {
    const field = detectColumn(h);
    if (field && !(field in fieldIndex)) {
      fieldIndex[field] = i;
      columnMap[h] = field;
    }
  });

  const trades: Trade[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const row = parseCSVLine(lines[rowIdx]);
    if (row.length < 2 || row.every((c) => !c.trim())) continue;

    const get = (field: string) => fieldIndex[field] !== undefined ? row[fieldIndex[field]] : undefined;

    const dateRaw = get("date");
    const parsedDate = parseDate(dateRaw ?? "");
    if (!parsedDate) {
      skipped++;
      errors.push(`Row ${rowIdx + 1}: Could not parse date "${dateRaw}"`);
      continue;
    }

    const pairRaw = get("pair")?.trim();
    if (!pairRaw) {
      skipped++;
      errors.push(`Row ${rowIdx + 1}: Missing pair/symbol`);
      continue;
    }

    const entryPrice = parseNumber(get("entryPrice"));
    const stopLoss = parseNumber(get("stopLoss"));
    const takeProfit = parseNumber(get("takeProfit"));
    const lotSize = parseNumber(get("lotSize")) || 0.01;

    let netProfit = parseNumber(get("netProfit"));
    let netLoss = parseNumber(get("netLoss"));

    if (netProfit < 0) { netLoss = Math.abs(netProfit); netProfit = 0; }
    if (netLoss < 0) { netLoss = 0; }

    const pnl = netProfit > 0 ? netProfit : -netLoss;
    const outcome = parseOutcome(get("outcome"), pnl);

    const rrRaw = parseNumber(get("rr"));
    const rr = rrRaw || (stopLoss > 0 && entryPrice > 0 && takeProfit > 0
      ? Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss)
      : 1);

    trades.push({
      id: crypto.randomUUID(),
      pair: pairRaw.toUpperCase(),
      direction: parseDirection(get("direction")),
      entryPrice: entryPrice || 0,
      stopLoss: stopLoss || 0,
      takeProfit: takeProfit || 0,
      lotSize,
      date: parsedDate,
      outcome,
      netProfit: netProfit || (outcome === "WIN" ? Math.abs(pnl) : 0),
      netLoss: netLoss || (outcome === "LOSS" ? Math.abs(pnl) : 0),
      rr: parseFloat(rr.toFixed(2)),
      strategy: detectStrategy(get("strategy")),
      notes: get("notes")?.trim() || undefined,
    });
  }

  return { trades, skipped, errors, columnMap };
}
