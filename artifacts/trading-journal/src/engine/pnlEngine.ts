/**
 * FIFO Round-Trip P&L Engine
 *
 * Matches BUY fills against SELL fills (FIFO) per symbol and returns
 * a list of Trade field updates. Works for both long (buy→sell) and
 * short (sell→buy) positions.
 *
 * Uses pair-aware pip values so XAUUSD / indices calculate correctly.
 *
 * Pure function — no side effects, no store imports.
 */

import { Trade } from "../types";
import { getPipConfig } from "./riskEngine";

export interface PnLUpdate {
  id: string;
  outcome: "WIN" | "LOSS" | "BE";
  netProfit: number;
  netLoss: number;
  rr: number;
  entryPrice: number;
  notes: string;
  _matched: true;
}

interface QueueEntry {
  id: string;
  price: number;
  qty: number;
  date: string;
  stopLoss: number;
  takeProfit: number;
  notes: string;
}

/** Run FIFO matching on a flat array of Trade records. Returns only the trades
 *  that were updated (closing legs of matched round-trips). */
export function matchRoundTrips(trades: Trade[]): PnLUpdate[] {
  const updates: PnLUpdate[] = [];

  const byPair = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  for (const [pair, pairTrades] of byPair) {
    const cfg = getPipConfig(pair);
    const sorted = [...pairTrades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const longQueue: QueueEntry[] = [];
    const shortQueue: QueueEntry[] = [];

    for (const t of sorted) {
      const qty = t.lotSize;
      const price = t.entryPrice;

      if (t.direction === "BUY") {
        let remaining = qty;
        while (remaining > 0 && shortQueue.length > 0) {
          const oldest = shortQueue[0];
          const matched = Math.min(remaining, oldest.qty);
          // short closed by buy: profit if entry (short open) > exit (buy price)
          const rawPriceDiff = oldest.price - price;
          const pnl = (rawPriceDiff / cfg.pipSize) * cfg.pipValue * matched;
          const update = buildUpdate(t.id, oldest.price, price, matched, pnl, oldest, t);
          updates.push(update);
          oldest.qty -= matched;
          remaining -= matched;
          if (oldest.qty <= 1e-9) shortQueue.shift();
        }
        if (remaining > 1e-9) {
          longQueue.push({ id: t.id, price, qty: remaining, date: t.date, stopLoss: t.stopLoss, takeProfit: t.takeProfit, notes: t.notes ?? "" });
        }
      } else {
        let remaining = qty;
        while (remaining > 0 && longQueue.length > 0) {
          const oldest = longQueue[0];
          const matched = Math.min(remaining, oldest.qty);
          // long closed by sell: profit if exit (sell price) > entry (buy price)
          const rawPriceDiff = price - oldest.price;
          const pnl = (rawPriceDiff / cfg.pipSize) * cfg.pipValue * matched;
          const update = buildUpdate(t.id, oldest.price, price, matched, pnl, oldest, t);
          updates.push(update);
          oldest.qty -= matched;
          remaining -= matched;
          if (oldest.qty <= 1e-9) longQueue.shift();
        }
        if (remaining > 1e-9) {
          shortQueue.push({ id: t.id, price, qty: remaining, date: t.date, stopLoss: t.stopLoss, takeProfit: t.takeProfit, notes: t.notes ?? "" });
        }
      }
    }
  }

  return updates;
}

function buildUpdate(
  closeId: string,
  entryPrice: number,
  exitPrice: number,
  matchedQty: number,
  rawPnl: number,
  openLeg: QueueEntry,
  closeLeg: Trade,
): PnLUpdate {
  const pnl = parseFloat(rawPnl.toFixed(2));
  const outcome: "WIN" | "LOSS" | "BE" =
    pnl > 0.01 ? "WIN" : pnl < -0.01 ? "LOSS" : "BE";

  let rr = 0;
  if (openLeg.stopLoss > 0 && entryPrice > 0) {
    const risk = Math.abs(entryPrice - openLeg.stopLoss);
    if (risk > 0) rr = parseFloat((Math.abs(rawPnl / matchedQty) / risk).toFixed(2));
  }

  const note =
    `Entry ${entryPrice.toPrecision(6)} → Exit ${exitPrice.toPrecision(6)}` +
    ` | Qty ${matchedQty.toPrecision(4)} | PnL ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`;

  const originalNotes = closeLeg.notes ?? "";
  const mergedNotes = originalNotes ? `${originalNotes}\n${note}` : note;

  return {
    id: closeId,
    outcome,
    netProfit: pnl > 0 ? pnl : 0,
    netLoss: pnl < 0 ? Math.abs(pnl) : 0,
    rr,
    entryPrice,
    notes: mergedNotes,
    _matched: true,
  };
}

// ── Open positions ────────────────────────────────────────────────────

export interface OpenPosition {
  pair: string;
  direction: "LONG" | "SHORT";
  totalQty: number;
  avgEntryPrice: number;
  openDate: string;
  tradeIds: string[];
}

export function extractOpenPositions(trades: Trade[]): OpenPosition[] {
  const result: OpenPosition[] = [];

  const byPair = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  for (const [pair, pairTrades] of byPair) {
    const sorted = [...pairTrades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const longQueue: QueueEntry[] = [];
    const shortQueue: QueueEntry[] = [];

    for (const t of sorted) {
      const qty = t.lotSize;
      const price = t.entryPrice;

      if (t.direction === "BUY") {
        let remaining = qty;
        while (remaining > 0 && shortQueue.length > 0) {
          const oldest = shortQueue[0];
          const matched = Math.min(remaining, oldest.qty);
          oldest.qty -= matched;
          remaining -= matched;
          if (oldest.qty <= 1e-9) shortQueue.shift();
        }
        if (remaining > 1e-9) {
          longQueue.push({ id: t.id, price, qty: remaining, date: t.date, stopLoss: t.stopLoss, takeProfit: t.takeProfit, notes: t.notes ?? "" });
        }
      } else {
        let remaining = qty;
        while (remaining > 0 && longQueue.length > 0) {
          const oldest = longQueue[0];
          const matched = Math.min(remaining, oldest.qty);
          oldest.qty -= matched;
          remaining -= matched;
          if (oldest.qty <= 1e-9) longQueue.shift();
        }
        if (remaining > 1e-9) {
          shortQueue.push({ id: t.id, price, qty: remaining, date: t.date, stopLoss: t.stopLoss, takeProfit: t.takeProfit, notes: t.notes ?? "" });
        }
      }
    }

    for (const dir of ["LONG", "SHORT"] as const) {
      const queue = dir === "LONG" ? longQueue : shortQueue;
      if (queue.length === 0) continue;
      const totalQty = queue.reduce((s, e) => s + e.qty, 0);
      const avgEntry = queue.reduce((s, e) => s + e.price * e.qty, 0) / totalQty;
      result.push({
        pair,
        direction: dir,
        totalQty: parseFloat(totalQty.toFixed(8)),
        avgEntryPrice: parseFloat(avgEntry.toFixed(8)),
        openDate: queue[0].date,
        tradeIds: queue.map(e => e.id),
      });
    }
  }

  return result;
}

export function applyPnLToTrades(trades: Trade[]): Trade[] {
  const updates = matchRoundTrips(trades);
  const updateMap = new Map(updates.map(u => [u.id, u]));

  return trades.map(t => {
    const u = updateMap.get(t.id);
    if (!u) return t;
    return {
      ...t,
      outcome: u.outcome,
      netProfit: u.netProfit,
      netLoss: u.netLoss,
      rr: u.rr,
      entryPrice: u.entryPrice,
      notes: u.notes,
    };
  });
}

export interface PnLSummary {
  matchedPositions: number;
  totalPnL: number;
  wins: number;
  losses: number;
  breakeven: number;
}

export function buildSummary(updates: PnLUpdate[]): PnLSummary {
  let totalPnL = 0, wins = 0, losses = 0, breakeven = 0;
  for (const u of updates) {
    totalPnL += u.netProfit - u.netLoss;
    if (u.outcome === "WIN") wins++;
    else if (u.outcome === "LOSS") losses++;
    else breakeven++;
  }
  return {
    matchedPositions: updates.length,
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    wins, losses, breakeven,
  };
}
