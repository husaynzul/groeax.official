import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, tradesTable, insertTradeSchema, updateTradeSchema } from "@workspace/db";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// POST /api/trades/add — create a new trade (auth required)
router.post("/trades/add", authMiddleware, async (req, res) => {
  try {
    const parsed = insertTradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid trade data", details: parsed.error.issues });
    }

    const [trade] = await db
      .insert(tradesTable)
      .values({ ...parsed.data, userId: req.userId! })
      .returning();

    return res.status(201).json(trade);
  } catch (err) {
    console.error("POST /api/trades/add error:", err);
    return res.status(500).json({ error: "Failed to create trade." });
  }
});

// GET /api/trades — get only the logged-in user's trades
router.get("/trades", authMiddleware, async (req, res) => {
  try {
    const trades = await db
      .select()
      .from(tradesTable)
      .where(eq(tradesTable.userId, req.userId!))
      .orderBy(tradesTable.createdAt);

    return res.json(trades);
  } catch (err) {
    console.error("GET /api/trades error:", err);
    return res.status(500).json({ error: "Failed to fetch trades." });
  }
});

// PUT /api/trades/:id — update only if the trade belongs to this user
router.put("/trades/:id", authMiddleware, async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id, 10);
    if (isNaN(tradeId)) {
      return res.status(400).json({ error: "Invalid trade ID." });
    }

    const parsed = updateTradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid trade data", details: parsed.error.issues });
    }

    const [updated] = await db
      .update(tradesTable)
      .set(parsed.data)
      .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, req.userId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Trade not found or access denied." });
    }

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/trades/:id error:", err);
    return res.status(500).json({ error: "Failed to update trade." });
  }
});

// DELETE /api/trades/:id — delete only if the trade belongs to this user
router.delete("/trades/:id", authMiddleware, async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id, 10);
    if (isNaN(tradeId)) {
      return res.status(400).json({ error: "Invalid trade ID." });
    }

    const [deleted] = await db
      .delete(tradesTable)
      .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, req.userId!)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Trade not found or access denied." });
    }

    return res.status(200).json({ message: "Trade deleted successfully." });
  } catch (err) {
    console.error("DELETE /api/trades/:id error:", err);
    return res.status(500).json({ error: "Failed to delete trade." });
  }
});

export default router;
