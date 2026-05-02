/**
 * FIFO Round-Trip P&L Engine
 *
 * Matches BUY fills against SELL fills (FIFO) per symbol and returns
 * a list of Trade field updates. Works for both long (buy→sell) and
 * short (sell→buy) positions.
 *
 * Pure function — no side effects, no store imports.
 */

import { Trade } from "../types";

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

  // Group trades by pair
  const byPair = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  for (const [, pairTrades] of byPair) {
    const sorted = [...pairTrades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Two queues: open longs and open shorts
    const longQueue: QueueEntry[] = [];  // unmatched BUY fills
    const shortQueue: QueueEntry[] = []; // unmatched SELL fills (shorts)

    for (const t of sorted) {
      const qty = t.lotSize;
      const price = t.entryPrice;

      if (t.direction === "BUY") {
        // Try to close open short positions first
        let remaining = qty;
        while (remaining > 0 && shortQueue.length > 0) {
          const oldest = shortQueue[0];
          const matched = Math.min(remaining, oldest.qty);
          const pnl = (oldest.price - price) * matched; // short: entry > exit = profit

          const update = buildUpdate(t.id, oldest.price, price, matched, pnl, oldest, t);
          updates.push(update);

          oldest.qty -= matched;
          remaining -= matched;
          if (oldest.qty <= 1e-9) shortQueue.shift();
        }

        // Remaining qty goes into long queue
        if (remaining > 1e-9) {
          longQueue.push({ id: t.id, price, qty: remaining, date: t.date, stopLoss: t.stopLoss, takeProfit: t.takeProfit, notes: t.notes ?? "" });
        }
      } else {
        // SELL — try to close open long positions first
        let remaining = qty;
        while (remaining > 0 && longQueue.length > 0) {
          const oldest = longQueue[0];
          const matched = Math.min(remaining, oldest.qty);
          const pnl = (price - oldest.price) * matched; // long: exit > entry = profit

          const update = buildUpdate(t.id, oldest.price, price, matched, pnl, oldest, t);
          updates.push(update);

          oldest.qty -= matched;
          remaining -= matched;
          if (oldest.qty <= 1e-9) longQueue.shift();
        }

        // Remaining qty goes into short queue
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
  const pnl = parseFloat(rawPnl.toFixed(8));
  const outcome: "WIN" | "LOSS" | "BE" =
    pnl > 0.000001 ? "WIN" : pnl < -0.000001 ? "LOSS" : "BE";

  // R:R calculation — only if the opening leg had a valid stop loss
  let rr = 0;
  if (openLeg.stopLoss > 0 && entryPrice > 0) {
    const risk = Math.abs(entryPrice - openLeg.stopLoss);
    if (risk > 0) rr = parseFloat((Math.abs(rawPnl / matchedQty) / risk).toFixed(2));
  }

  const note =
    `Entry ${entryPrice.toPrecision(6)} → Exit ${exitPrice.toPrecision(6)}` +
    ` | Qty ${matchedQty.toPrecision(4)} | PnL ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}`;

  // Merge the original notes (keep broker info) with position detail
  const originalNotes = closeLeg.notes ?? "";
  const mergedNotes = originalNotes
    ? `${originalNotes}\n${note}`
    : note;

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

/** Convenience: takes a list of trades, runs the engine, returns a new array
 *  with the matched trades updated in-place. Unmatched trades are untouched. */
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

/** Summary returned after recalculation */
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
    totalPnL: parseFloat(totalPnL.toFixed(4)),
    wins, losses, breakeven,
  };
}
