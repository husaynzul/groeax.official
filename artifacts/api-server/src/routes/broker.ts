import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Alpaca paper-trading proxy ────────────────────────────────────────
router.post("/broker/alpaca/test", async (req, res) => {
  const { apiKey, apiSecret, paper = true } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }

  const base = paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  try {
    const r = await fetch(`${base}/v2/account`, {
      headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret },
    });
    if (!r.ok) { res.json({ ok: false, error: `Alpaca returned ${r.status}` }); return; }
    const account = await r.json() as Record<string, unknown>;
    res.json({ ok: true, accountId: account["id"], equity: account["equity"], currency: account["currency"] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ msg }, "Alpaca test failed");
    res.json({ ok: false, error: msg });
  }
});

router.post("/broker/alpaca/sync", async (req, res) => {
  const { apiKey, apiSecret, paper = true, limit = 100 } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }

  const base = paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  try {
    const r = await fetch(`${base}/v2/orders?status=closed&limit=${limit}&direction=desc`, {
      headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret },
    });
    if (!r.ok) { res.json({ ok: false, error: `Alpaca returned ${r.status}` }); return; }
    const orders = await r.json() as AlpacaOrder[];

    const trades = orders
      .filter(o => o.filled_avg_price && o.filled_at && o.status === "filled")
      .map(o => ({
        id: `alpaca_${o.id}`,
        pair: o.symbol,
        direction: o.side === "buy" ? "BUY" : "SELL",
        entryPrice: parseFloat(o.filled_avg_price ?? "0"),
        stopLoss: 0,
        takeProfit: 0,
        lotSize: parseFloat(o.filled_qty ?? o.qty),
        date: o.filled_at ?? o.created_at,
        notes: `Synced from Alpaca — ${o.order_type ?? o.type ?? "market"} order`,
        outcome: undefined,
        netProfit: 0,
        netLoss: 0,
        rr: 0,
        strategy: "Alpaca Sync",
      }));

    res.json({ ok: true, count: trades.length, trades });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ msg }, "Alpaca sync failed");
    res.json({ ok: false, error: msg });
  }
});

// ── OANDA proxy ───────────────────────────────────────────────────────
router.post("/broker/oanda/test", async (req, res) => {
  const { apiKey, accountId, practice = true } = req.body ?? {};
  if (!apiKey || !accountId) { res.status(400).json({ ok: false, error: "apiKey and accountId required" }); return; }

  const base = practice
    ? "https://api-fxpractice.oanda.com"
    : "https://api-fxtrade.oanda.com";
  try {
    const r = await fetch(`${base}/v3/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) { res.json({ ok: false, error: `OANDA returned ${r.status}` }); return; }
    const data = await r.json() as { account?: Record<string, unknown> };
    res.json({ ok: true, currency: data.account?.["currency"], balance: data.account?.["balance"] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.json({ ok: false, error: msg });
  }
});

router.post("/broker/oanda/sync", async (req, res) => {
  const { apiKey, accountId, practice = true } = req.body ?? {};
  if (!apiKey || !accountId) { res.status(400).json({ ok: false, error: "apiKey and accountId required" }); return; }

  const base = practice
    ? "https://api-fxpractice.oanda.com"
    : "https://api-fxtrade.oanda.com";
  try {
    const r = await fetch(`${base}/v3/accounts/${accountId}/trades?state=CLOSED&count=100`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) { res.json({ ok: false, error: `OANDA returned ${r.status}` }); return; }
    const data = await r.json() as { trades?: OandaTrade[] };
    const trades = (data.trades ?? []).map(t => ({
      id: `oanda_${t.id}`,
      pair: t.instrument?.replace("_", "") ?? "UNKNOWN",
      direction: parseFloat(t.initialUnits ?? "1") > 0 ? "BUY" : "SELL",
      entryPrice: parseFloat(t.price ?? "0"),
      stopLoss: parseFloat(t.stopLossOrder?.price ?? "0"),
      takeProfit: parseFloat(t.takeProfitOrder?.price ?? "0"),
      lotSize: Math.abs(parseFloat(t.initialUnits ?? "1")) / 100000,
      date: t.openTime ?? new Date().toISOString(),
      notes: `Synced from OANDA`,
      outcome: parseFloat(t.realizedPL ?? "0") >= 0 ? "WIN" : "LOSS",
      netProfit: Math.max(0, parseFloat(t.realizedPL ?? "0")),
      netLoss: Math.abs(Math.min(0, parseFloat(t.realizedPL ?? "0"))),
      rr: 0,
      strategy: "OANDA Sync",
    }));
    res.json({ ok: true, count: trades.length, trades });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.json({ ok: false, error: msg });
  }
});

// ── MT5 bridge info ───────────────────────────────────────────────────
router.get("/broker/mt5/info", (req, res) => {
  const host = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "wss";
  res.json({
    wsUrl: `${proto === "https" ? "wss" : "ws"}://${host}/api/ws/mt5`,
    pythonScript: getPythonBridgeScript(String(proto === "https" ? "wss" : "ws"), String(host)),
  });
});

function getPythonBridgeScript(wsProto: string, host: string): string {
  return `#!/usr/bin/env python3
"""TradeLog MT5 Bridge — connects MetaTrader 5 to your TradeLog dashboard.
Install: pip install MetaTrader5 websockets
"""
import asyncio, json, MetaTrader5 as mt5
import websockets

WS_URL = "${wsProto}://${host}/api/ws/mt5"

async def stream():
    async with websockets.connect(WS_URL) as ws:
        print(f"Connected to TradeLog bridge: {WS_URL}")
        while True:
            # Stream open positions
            positions = mt5.positions_get()
            if positions:
                for p in positions:
                    tick = mt5.symbol_info_tick(p.symbol)
                    if tick:
                        await ws.send(json.dumps({
                            "type": "tick",
                            "symbol": p.symbol,
                            "bid": tick.bid,
                            "ask": tick.ask,
                            "time": tick.time,
                        }))
            await asyncio.sleep(1)

if __name__ == "__main__":
    if not mt5.initialize(): raise RuntimeError("MT5 init failed")
    asyncio.run(stream())
`;
}

// ── Type helpers ──────────────────────────────────────────────────────
interface AlpacaOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  filled_qty?: string;
  filled_avg_price?: string;
  filled_at?: string;
  created_at: string;
  status: string;
  order_type?: string;
  type?: string;
}

interface OandaTrade {
  id: string;
  instrument?: string;
  price?: string;
  initialUnits?: string;
  openTime?: string;
  realizedPL?: string;
  stopLossOrder?: { price?: string };
  takeProfitOrder?: { price?: string };
}

export default router;
