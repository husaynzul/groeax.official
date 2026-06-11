import { Router, Request, Response } from "express";
import { MongoTrade } from "../models/Trade.js";
import { mongoAuthMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

// All trade routes require authentication
router.use(mongoAuthMiddleware);

// POST /api/mongo/trades/add
router.post("/add", async (req: Request, res: Response) => {
  try {
    const { symbol, entryPrice, exitPrice, profit, loss, strategy } = req.body;

    if (!symbol || entryPrice === undefined) {
      return res.status(400).json({ error: "symbol and entryPrice are required." });
    }

    const trade = await MongoTrade.create({
      userId: req.mongoUserId,
      symbol,
      entryPrice,
      exitPrice,
      profit,
      loss,
      strategy,
    });

    return res.status(201).json(trade);
  } catch (err) {
    console.error("POST /mongo/trades/add error:", err);
    return res.status(500).json({ error: "Failed to create trade." });
  }
});

// GET /api/mongo/trades — only this user's trades
router.get("/", async (req: Request, res: Response) => {
  try {
    const trades = await MongoTrade.find({ userId: req.mongoUserId }).sort({ createdAt: -1 });
    return res.json(trades);
  } catch (err) {
    console.error("GET /mongo/trades error:", err);
    return res.status(500).json({ error: "Failed to fetch trades." });
  }
});

// PUT /api/mongo/trades/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const trade = await MongoTrade.findOneAndUpdate(
      { _id: req.params.id, userId: req.mongoUserId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!trade) {
      return res.status(404).json({ error: "Trade not found or access denied." });
    }
    return res.json(trade);
  } catch (err) {
    console.error("PUT /mongo/trades/:id error:", err);
    return res.status(500).json({ error: "Failed to update trade." });
  }
});

// DELETE /api/mongo/trades/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const trade = await MongoTrade.findOneAndDelete({
      _id: req.params.id,
      userId: req.mongoUserId,
    });
    if (!trade) {
      return res.status(404).json({ error: "Trade not found or access denied." });
    }
    return res.status(200).json({ message: "Trade deleted successfully." });
  } catch (err) {
    console.error("DELETE /mongo/trades/:id error:", err);
    return res.status(500).json({ error: "Failed to delete trade." });
  }
});

export default router;
