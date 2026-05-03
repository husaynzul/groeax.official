import { Router } from "express";
import { authMiddleware, premiumMiddleware } from "../middleware/auth.js";
import { broadcastToApp, appClientCount } from "../ws/appBroadcast.js";

const router = Router();

interface MT5TradePayload {
  type: "trade_open" | "trade_close";
  ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  price: number;
  sl: number;
  tp: number;
  profit: number;
  time: string;
  comment?: string;
  token?: string;
}

router.get("/mt5/status", (_req, res) => {
  res.json({
    ok: true,
    service: "TradeLog MT5 Bridge",
    version: "1.0",
    connectedClients: appClientCount(),
  });
});

router.post("/mt5/trade", authMiddleware, premiumMiddleware, (req, res) => {
  const body = req.body as Partial<MT5TradePayload>;

  if (!body.symbol || !body.direction || !body.type) {
    res.status(400).json({ ok: false, error: "Missing required fields: symbol, direction, type" });
    return;
  }

  if (!["BUY", "SELL"].includes(body.direction)) {
    res.status(400).json({ ok: false, error: "direction must be BUY or SELL" });
    return;
  }

  const event: MT5TradePayload = {
    type: body.type,
    ticket: body.ticket ?? 0,
    symbol: body.symbol,
    direction: body.direction,
    lots: body.lots ?? 0,
    price: body.price ?? 0,
    sl: body.sl ?? 0,
    tp: body.tp ?? 0,
    profit: body.profit ?? 0,
    time: body.time ?? new Date().toISOString(),
    comment: body.comment ?? "",
  };

  broadcastToApp({ type: "mt5_trade", data: event });

  req.log.info(
    { symbol: event.symbol, tradeType: event.type, ticket: event.ticket, clients: appClientCount() },
    "MT5 trade event received and broadcast"
  );

  res.json({ ok: true, broadcast: appClientCount() });
});

export default router;
