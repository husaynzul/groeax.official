/**
 * Trade Sync Routes — cross-device sync via server-side PostgreSQL.
 * Frontend sends its full Trade objects; server stores them keyed by clientId.
 * On any device login, GET /api/trades/sync returns all the user's trades.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, tradesTable } from "@workspace/db";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

type ClientTrade = {
  id: string;
  pair?: string;
  entryPrice?: number;
  exitPrice?: number;
  netProfit?: number;
  netLoss?: number;
  strategy?: string;
  [key: string]: unknown;
};

function tradeToRow(userId: number, trade: ClientTrade) {
  return {
    userId,
    clientId: trade.id,
    tradeData: trade as Record<string, unknown>,
    symbol: trade.pair ?? null,
    entryPrice: trade.entryPrice != null ? String(trade.entryPrice) : null,
    exitPrice: trade.exitPrice != null ? String(trade.exitPrice) : null,
    profit: trade.netProfit != null && trade.netProfit > 0 ? String(trade.netProfit) : null,
    loss: trade.netLoss != null && trade.netLoss > 0 ? String(trade.netLoss) : null,
    strategy: trade.strategy ?? null,
  };
}

// GET /api/trades/sync — fetch all trades for the logged-in user
router.get("/trades/sync", authMiddleware, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(tradesTable)
      .where(eq(tradesTable.userId, req.userId!))
      .orderBy(tradesTable.createdAt);

    return res.json(rows.map((r) => r.tradeData));
  } catch (err) {
    console.error("GET /api/trades/sync error:", err);
    return res.status(500).json({ error: "Failed to fetch synced trades." });
  }
});

// POST /api/trades/sync — upsert a single trade
router.post("/trades/sync", authMiddleware, async (req, res) => {
  try {
    const trade = req.body as ClientTrade;
    if (!trade?.id) {
      return res.status(400).json({ error: "trade.id (clientId) is required." });
    }

    const values = tradeToRow(req.userId!, trade);

    const [row] = await db
      .insert(tradesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [tradesTable.userId, tradesTable.clientId],
        set: {
          tradeData: values.tradeData,
          symbol: values.symbol,
          entryPrice: values.entryPrice,
          exitPrice: values.exitPrice,
          profit: values.profit,
          loss: values.loss,
          strategy: values.strategy,
        },
      })
      .returning();

    return res.status(200).json(row.tradeData);
  } catch (err) {
    console.error("POST /api/trades/sync error:", err);
    return res.status(500).json({ error: "Failed to sync trade." });
  }
});

// DELETE /api/trades/sync/:clientId — remove a trade by clientId
router.delete("/trades/sync/:clientId", authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const [deleted] = await db
      .delete(tradesTable)
      .where(and(eq(tradesTable.userId, req.userId!), eq(tradesTable.clientId, clientId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Trade not found or access denied." });
    }
    return res.status(200).json({ message: "Trade deleted." });
  } catch (err) {
    console.error("DELETE /api/trades/sync/:clientId error:", err);
    return res.status(500).json({ error: "Failed to delete trade." });
  }
});

// POST /api/trades/sync/bulk — bulk upsert all local trades (used on first login)
router.post("/trades/sync/bulk", authMiddleware, async (req, res) => {
  try {
    const trades = req.body as ClientTrade[];
    if (!Array.isArray(trades)) {
      return res.status(400).json({ error: "Body must be an array of trades." });
    }
    if (trades.length === 0) return res.json({ synced: 0 });

    for (const trade of trades) {
      if (!trade?.id) continue;
      const values = tradeToRow(req.userId!, trade);
      await db
        .insert(tradesTable)
        .values(values)
        .onConflictDoUpdate({
          target: [tradesTable.userId, tradesTable.clientId],
          set: {
            tradeData: values.tradeData,
            symbol: values.symbol,
            entryPrice: values.entryPrice,
            exitPrice: values.exitPrice,
            profit: values.profit,
            loss: values.loss,
            strategy: values.strategy,
          },
        });
    }

    return res.status(200).json({ synced: trades.length });
  } catch (err) {
    console.error("POST /api/trades/sync/bulk error:", err);
    return res.status(500).json({ error: "Failed to bulk sync trades." });
  }
});

export default router;
