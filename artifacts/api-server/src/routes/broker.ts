import { Router } from "express";
import { authMiddleware, platinumMiddleware } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import crypto from "crypto";

const router = Router();

// ── Shared crypto helpers ─────────────────────────────────────────────
function hmacHex(secret: string, msg: string, algo = "sha256"): string {
  return crypto.createHmac(algo, secret).update(msg).digest("hex");
}
function hmacB64(secret: string, msg: string): string {
  return crypto.createHmac("sha256", secret).update(msg).digest("base64");
}
function nowSec(): number { return Math.floor(Date.now() / 1000); }

// ── Alpaca ────────────────────────────────────────────────────────────
router.post("/broker/alpaca/test", authMiddleware, platinumMiddleware, async (req, res) => {
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
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/alpaca/sync", authMiddleware, platinumMiddleware, async (req, res) => {
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
        stopLoss: 0, takeProfit: 0,
        lotSize: parseFloat(o.filled_qty ?? o.qty),
        date: o.filled_at ?? o.created_at,
        notes: `Synced from Alpaca — ${o.order_type ?? o.type ?? "market"} order`,
        outcome: undefined, netProfit: 0, netLoss: 0, rr: 0,
        strategy: "Alpaca Sync",
      }));
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── OANDA ─────────────────────────────────────────────────────────────
router.post("/broker/oanda/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, accountId, practice = true } = req.body ?? {};
  if (!apiKey || !accountId) { res.status(400).json({ ok: false, error: "apiKey and accountId required" }); return; }
  const base = practice ? "https://api-fxpractice.oanda.com" : "https://api-fxtrade.oanda.com";
  try {
    const r = await fetch(`${base}/v3/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) { res.json({ ok: false, error: `OANDA returned ${r.status}` }); return; }
    const data = await r.json() as { account?: Record<string, unknown> };
    res.json({ ok: true, currency: data.account?.["currency"], balance: data.account?.["balance"] });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/oanda/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, accountId, practice = true } = req.body ?? {};
  if (!apiKey || !accountId) { res.status(400).json({ ok: false, error: "apiKey and accountId required" }); return; }
  const base = practice ? "https://api-fxpractice.oanda.com" : "https://api-fxtrade.oanda.com";
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
      notes: "Synced from OANDA",
      outcome: parseFloat(t.realizedPL ?? "0") >= 0 ? "WIN" : "LOSS",
      netProfit: Math.max(0, parseFloat(t.realizedPL ?? "0")),
      netLoss: Math.abs(Math.min(0, parseFloat(t.realizedPL ?? "0"))),
      rr: 0, strategy: "OANDA Sync",
    }));
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── Binance ───────────────────────────────────────────────────────────
async function binanceSigned(
  apiKey: string, apiSecret: string, path: string,
  params: Record<string, string | number> = {}
): Promise<Response> {
  const p = new URLSearchParams(
    Object.fromEntries(Object.entries({ ...params, timestamp: Date.now() }).map(([k, v]) => [k, String(v)]))
  );
  const qs = p.toString();
  const sig = hmacHex(apiSecret, qs);
  return fetch(`https://api.binance.com${path}?${qs}&signature=${sig}`, {
    headers: { "X-MBX-APIKEY": apiKey },
  });
}

router.post("/broker/binance/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const r = await binanceSigned(apiKey, apiSecret, "/api/v3/account");
    if (!r.ok) { res.json({ ok: false, error: `Binance: ${r.status}` }); return; }
    const d = await r.json() as { canTrade?: boolean; balances?: { asset: string; free: string }[] };
    const active = (d.balances ?? []).filter(b => parseFloat(b.free) > 0).length;
    res.json({ ok: true, canTrade: d.canTrade, activeAssets: active });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/binance/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    // Step 1: get account balances to discover traded assets
    const acctR = await binanceSigned(apiKey, apiSecret, "/api/v3/account");
    if (!acctR.ok) { res.json({ ok: false, error: `Binance account: ${acctR.status}` }); return; }
    const acct = await acctR.json() as { balances?: { asset: string; free: string; locked: string }[] };
    const stables = new Set(["USDT","BUSD","USDC","TUSD","DAI","FDUSD"]);
    const bases = ["USDT","BTC","ETH","BNB"];
    const assets = (acct.balances ?? [])
      .filter(b => !stables.has(b.asset) && (parseFloat(b.free) > 0 || parseFloat(b.locked) > 0))
      .map(b => b.asset);

    // Step 2: fetch trades for each symbol combination
    const allTrades: BinanceTrade[] = [];
    const tried = new Set<string>();
    for (const asset of assets) {
      for (const base of bases) {
        const symbol = `${asset}${base}`;
        if (tried.has(symbol)) continue;
        tried.add(symbol);
        try {
          const r = await binanceSigned(apiKey, apiSecret, "/api/v3/myTrades", { symbol, limit: 500 });
          if (r.ok) {
            const trades = await r.json() as BinanceTrade[];
            if (Array.isArray(trades)) allTrades.push(...trades.map(t => ({ ...t, _symbol: symbol })));
          }
        } catch { /* skip failed symbol */ }
      }
    }

    const seen = new Set<string>();
    const trades = allTrades
      .filter(t => { if (seen.has(String(t.id))) return false; seen.add(String(t.id)); return true; })
      .map(t => {
        const qty = parseFloat(t.qty ?? "0");
        const price = parseFloat(t.price ?? "0");
        const commission = parseFloat(t.commission ?? "0");
        const quoteQty = parseFloat(t.quoteQty ?? String(qty * price));
        const pnl = t.isBuyer ? -(quoteQty + commission) : (quoteQty - commission);
        return {
          id: `binance_${t.id}`,
          pair: t._symbol ?? String(t.symbol ?? ""),
          direction: t.isBuyer ? "BUY" : "SELL",
          entryPrice: price,
          stopLoss: 0, takeProfit: 0,
          lotSize: qty,
          date: new Date(t.time).toISOString(),
          notes: `Synced from Binance — order ${t.orderId}`,
          outcome: pnl >= 0 ? "WIN" : "LOSS",
          netProfit: Math.max(0, pnl),
          netLoss: Math.abs(Math.min(0, pnl)),
          rr: 0, strategy: "Binance Sync",
        };
      });

    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── Kraken ────────────────────────────────────────────────────────────
function krakenSign(apiSecret: string, path: string, nonce: string, body: string): string {
  const sha256 = crypto.createHash("sha256").update(nonce + body).digest();
  const secretBuf = Buffer.from(apiSecret, "base64");
  return crypto.createHmac("sha512", secretBuf)
    .update(Buffer.concat([Buffer.from(path, "utf8"), sha256]))
    .digest("base64");
}

async function krakenPrivate(apiKey: string, apiSecret: string, path: string, params: Record<string, string> = {}): Promise<Response> {
  const nonce = String(Date.now() * 1000);
  const body = new URLSearchParams({ nonce, ...params }).toString();
  const sig = krakenSign(apiSecret, path, nonce, body);
  return fetch(`https://api.kraken.com${path}`, {
    method: "POST",
    headers: { "API-Key": apiKey, "API-Sign": sig, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

router.post("/broker/kraken/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const r = await krakenPrivate(apiKey, apiSecret, "/0/private/Balance");
    const d = await r.json() as { error?: string[]; result?: Record<string, string> };
    if (d.error?.length) { res.json({ ok: false, error: d.error.join(", ") }); return; }
    const assets = Object.keys(d.result ?? {}).filter(k => parseFloat(d.result![k]) > 0);
    res.json({ ok: true, activeAssets: assets.length });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/kraken/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const start = String(Math.floor(Date.now() / 1000) - 90 * 24 * 3600);
    const r = await krakenPrivate(apiKey, apiSecret, "/0/private/TradesHistory", { start });
    const d = await r.json() as { error?: string[]; result?: { trades?: Record<string, KrakenTrade> } };
    if (d.error?.length) { res.json({ ok: false, error: d.error.join(", ") }); return; }

    const raw = d.result?.trades ?? {};
    const trades = Object.entries(raw).map(([txid, t]) => {
      const cost = parseFloat(t.cost ?? "0");
      const fee  = parseFloat(t.fee  ?? "0");
      const pnl  = t.type === "sell" ? cost - fee : -(cost + fee);
      return {
        id: `kraken_${txid}`,
        pair: (t.pair ?? "").replace(/^X|Z/g, ""),
        direction: t.type === "buy" ? "BUY" : "SELL",
        entryPrice: parseFloat(t.price ?? "0"),
        stopLoss: 0, takeProfit: 0,
        lotSize: parseFloat(t.vol ?? "0"),
        date: new Date(parseFloat(t.time ?? "0") * 1000).toISOString(),
        notes: `Synced from Kraken — order ${t.ordertxid}`,
        outcome: pnl >= 0 ? "WIN" : "LOSS",
        netProfit: Math.max(0, pnl),
        netLoss: Math.abs(Math.min(0, pnl)),
        rr: 0, strategy: "Kraken Sync",
      };
    });
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── Bybit ─────────────────────────────────────────────────────────────
const BYBIT_RECV_WINDOW = "5000";

function bybitSign(apiKey: string, apiSecret: string, timestamp: string, qs: string): string {
  return hmacHex(apiSecret, `${timestamp}${apiKey}${BYBIT_RECV_WINDOW}${qs}`);
}

async function bybitGet(apiKey: string, apiSecret: string, path: string, params: Record<string, string>): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  const ts = String(Date.now());
  const sig = bybitSign(apiKey, apiSecret, ts, qs);
  return fetch(`https://api.bybit.com${path}?${qs}`, {
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-SIGN": sig,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": BYBIT_RECV_WINDOW,
      "X-BAPI-SIGN-TYPE": "2",
    },
  });
}

router.post("/broker/bybit/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const r = await bybitGet(apiKey, apiSecret, "/v5/account/wallet-balance", { accountType: "UNIFIED" });
    const d = await r.json() as { retCode?: number; retMsg?: string; result?: { list?: { totalEquity?: string }[] } };
    if (d.retCode !== 0) { res.json({ ok: false, error: d.retMsg ?? "Bybit error" }); return; }
    const equity = d.result?.list?.[0]?.totalEquity ?? "0";
    res.json({ ok: true, equity });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/bybit/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const allTrades: BybitExec[] = [];
    for (const category of ["spot", "linear", "inverse"]) {
      try {
        const r = await bybitGet(apiKey, apiSecret, "/v5/execution/list", { category, limit: "100" });
        const d = await r.json() as { retCode?: number; result?: { list?: BybitExec[] } };
        if (d.retCode === 0) allTrades.push(...(d.result?.list ?? []).map(x => ({ ...x, _category: category })));
      } catch { /* skip category */ }
    }

    const seen = new Set<string>();
    const trades = allTrades
      .filter(t => { if (seen.has(t.execId)) return false; seen.add(t.execId); return true; })
      .map(t => {
        const execFee = parseFloat(t.execFee ?? "0");
        const execValue = parseFloat(t.execValue ?? "0");
        const pnl = t.side === "Sell" ? execValue - execFee : -(execValue + execFee);
        return {
          id: `bybit_${t.execId}`,
          pair: t.symbol ?? "",
          direction: t.side === "Buy" ? "BUY" : "SELL",
          entryPrice: parseFloat(t.execPrice ?? "0"),
          stopLoss: 0, takeProfit: 0,
          lotSize: parseFloat(t.execQty ?? "0"),
          date: new Date(parseInt(t.execTime ?? "0")).toISOString(),
          notes: `Synced from Bybit (${t._category}) — order ${t.orderId}`,
          outcome: pnl >= 0 ? "WIN" : "LOSS",
          netProfit: Math.max(0, pnl),
          netLoss: Math.abs(Math.min(0, pnl)),
          rr: 0, strategy: "Bybit Sync",
        };
      });
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── OKX ───────────────────────────────────────────────────────────────
function okxHeaders(apiKey: string, apiSecret: string, passphrase: string, method: string, path: string, body = "") {
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const sig = hmacB64(apiSecret, `${ts}${method}${path}${body}`);
  return {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sig,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  };
}

router.post("/broker/okx/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret, passphrase } = req.body ?? {};
  if (!apiKey || !apiSecret || !passphrase) { res.status(400).json({ ok: false, error: "apiKey, apiSecret and passphrase required" }); return; }
  try {
    const path = "/api/v5/account/balance";
    const r = await fetch(`https://www.okx.com${path}`, {
      headers: okxHeaders(apiKey, apiSecret, passphrase, "GET", path),
    });
    const d = await r.json() as { code?: string; msg?: string; data?: { totalEq?: string }[] };
    if (d.code !== "0") { res.json({ ok: false, error: d.msg ?? "OKX error" }); return; }
    res.json({ ok: true, equity: d.data?.[0]?.totalEq ?? "0" });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/okx/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret, passphrase } = req.body ?? {};
  if (!apiKey || !apiSecret || !passphrase) { res.status(400).json({ ok: false, error: "apiKey, apiSecret and passphrase required" }); return; }
  try {
    const allTrades: OkxFill[] = [];
    for (const instType of ["SPOT", "SWAP", "FUTURES", "MARGIN"]) {
      try {
        const path = `/api/v5/trade/fills-history?instType=${instType}&limit=100`;
        const r = await fetch(`https://www.okx.com${path}`, {
          headers: okxHeaders(apiKey, apiSecret, passphrase, "GET", path),
        });
        const d = await r.json() as { code?: string; data?: OkxFill[] };
        if (d.code === "0") allTrades.push(...(d.data ?? []).map(x => ({ ...x, _instType: instType })));
      } catch { /* skip */ }
    }

    const seen = new Set<string>();
    const trades = allTrades
      .filter(t => { const key = `${t.tradeId}_${t.instId}`; if (seen.has(key)) return false; seen.add(key); return true; })
      .map(t => {
        const fee  = parseFloat(t.fee ?? "0");
        const fillSz = parseFloat(t.fillSz ?? "0");
        const fillPx = parseFloat(t.fillPx ?? "0");
        const value = fillSz * fillPx;
        const pnl = t.side === "sell" ? value + fee : -(value - fee);
        return {
          id: `okx_${t.tradeId}`,
          pair: (t.instId ?? "").replace("-", ""),
          direction: t.side === "buy" ? "BUY" : "SELL",
          entryPrice: fillPx,
          stopLoss: 0, takeProfit: 0,
          lotSize: fillSz,
          date: new Date(parseInt(t.ts ?? "0")).toISOString(),
          notes: `Synced from OKX (${t._instType}) — order ${t.ordId}`,
          outcome: pnl >= 0 ? "WIN" : "LOSS",
          netProfit: Math.max(0, pnl),
          netLoss: Math.abs(Math.min(0, pnl)),
          rr: 0, strategy: "OKX Sync",
        };
      });
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── KuCoin ────────────────────────────────────────────────────────────
function kucoinHeaders(apiKey: string, apiSecret: string, passphrase: string, method: string, endpoint: string, body = "") {
  const ts = String(Date.now());
  const prehash = `${ts}${method}${endpoint}${body}`;
  const sig = hmacB64(apiSecret, prehash);
  const pp  = hmacB64(apiSecret, passphrase);
  return {
    "KC-API-KEY": apiKey,
    "KC-API-SIGN": sig,
    "KC-API-TIMESTAMP": ts,
    "KC-API-PASSPHRASE": pp,
    "KC-API-KEY-VERSION": "2",
    "Content-Type": "application/json",
  };
}

router.post("/broker/kucoin/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret, passphrase } = req.body ?? {};
  if (!apiKey || !apiSecret || !passphrase) { res.status(400).json({ ok: false, error: "apiKey, apiSecret and passphrase required" }); return; }
  try {
    const endpoint = "/api/v1/accounts";
    const r = await fetch(`https://api.kucoin.com${endpoint}`, {
      headers: kucoinHeaders(apiKey, apiSecret, passphrase, "GET", endpoint),
    });
    const d = await r.json() as { code?: string; msg?: string; data?: { balance: string; currency: string }[] };
    if (d.code !== "200000") { res.json({ ok: false, error: d.msg ?? "KuCoin error" }); return; }
    const active = (d.data ?? []).filter(a => parseFloat(a.balance) > 0).length;
    res.json({ ok: true, activeAssets: active });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/kucoin/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret, passphrase } = req.body ?? {};
  if (!apiKey || !apiSecret || !passphrase) { res.status(400).json({ ok: false, error: "apiKey, apiSecret and passphrase required" }); return; }
  try {
    const allFills: KuCoinFill[] = [];
    for (const tradeType of ["TRADE", "MARGIN_TRADE"]) {
      try {
        const endpoint = `/api/v1/fills?tradeType=${tradeType}&pageSize=100`;
        const r = await fetch(`https://api.kucoin.com${endpoint}`, {
          headers: kucoinHeaders(apiKey, apiSecret, passphrase, "GET", endpoint),
        });
        const d = await r.json() as { code?: string; data?: { items?: KuCoinFill[] } };
        if (d.code === "200000") allFills.push(...(d.data?.items ?? []).map(x => ({ ...x, _tradeType: tradeType })));
      } catch { /* skip */ }
    }

    const seen = new Set<string>();
    const trades = allFills
      .filter(t => { if (seen.has(t.tradeId)) return false; seen.add(t.tradeId); return true; })
      .map(t => {
        const size = parseFloat(t.size ?? "0");
        const price = parseFloat(t.price ?? "0");
        const fee = parseFloat(t.fee ?? "0");
        const value = size * price;
        const pnl = t.side === "sell" ? value - fee : -(value + fee);
        return {
          id: `kucoin_${t.tradeId}`,
          pair: (t.symbol ?? "").replace("-", ""),
          direction: t.side === "buy" ? "BUY" : "SELL",
          entryPrice: price,
          stopLoss: 0, takeProfit: 0,
          lotSize: size,
          date: new Date(parseInt(t.createdAt ?? "0")).toISOString(),
          notes: `Synced from KuCoin (${t._tradeType}) — order ${t.orderId}`,
          outcome: pnl >= 0 ? "WIN" : "LOSS",
          netProfit: Math.max(0, pnl),
          netLoss: Math.abs(Math.min(0, pnl)),
          rr: 0, strategy: "KuCoin Sync",
        };
      });
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── Coinbase Advanced Trade ───────────────────────────────────────────
function coinbaseJWT(apiKey: string, privateKeyPem: string, method: string, path: string): string {
  const now = nowSec();
  const header  = Buffer.from(JSON.stringify({ alg: "ES256", kid: apiKey, nonce: crypto.randomBytes(16).toString("hex") })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: apiKey, iss: "cdp", nbf: now, exp: now + 120,
    uri: `${method} api.coinbase.com${path}`,
  })).toString("base64url");
  const sigInput = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(sigInput);
  const der = sign.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" });
  return `${sigInput}.${der.toString("base64url")}`;
}

router.post("/broker/coinbase/test", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const path = "/api/v3/brokerage/accounts";
    const jwt = coinbaseJWT(apiKey, apiSecret, "GET", path);
    const r = await fetch(`https://api.coinbase.com${path}`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    });
    const d = await r.json() as { accounts?: { currency: string; available_balance: { value: string } }[]; error?: string };
    if (!r.ok || d.error) { res.json({ ok: false, error: d.error ?? `Coinbase: ${r.status}` }); return; }
    const active = (d.accounts ?? []).filter(a => parseFloat(a.available_balance?.value ?? "0") > 0).length;
    res.json({ ok: true, activeAssets: active });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

router.post("/broker/coinbase/sync", authMiddleware, platinumMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) { res.status(400).json({ ok: false, error: "apiKey and apiSecret required" }); return; }
  try {
    const path = "/api/v3/brokerage/orders/historical/fills?limit=250";
    const jwt = coinbaseJWT(apiKey, apiSecret, "GET", path);
    const r = await fetch(`https://api.coinbase.com${path}`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    });
    const d = await r.json() as { fills?: CoinbaseFill[]; error?: string };
    if (!r.ok || d.error) { res.json({ ok: false, error: d.error ?? `Coinbase: ${r.status}` }); return; }

    const seen = new Set<string>();
    const trades = (d.fills ?? [])
      .filter(f => { if (seen.has(f.trade_id)) return false; seen.add(f.trade_id); return true; })
      .map(f => {
        const size = parseFloat(f.size ?? "0");
        const price = parseFloat(f.price ?? "0");
        const commission = parseFloat(f.commission ?? "0");
        const value = size * price;
        const pnl = f.side === "SELL" ? value - commission : -(value + commission);
        return {
          id: `coinbase_${f.trade_id}`,
          pair: (f.product_id ?? "").replace("-", ""),
          direction: f.side === "BUY" ? "BUY" : "SELL",
          entryPrice: price,
          stopLoss: 0, takeProfit: 0,
          lotSize: size,
          date: f.trade_time ?? new Date().toISOString(),
          notes: `Synced from Coinbase — order ${f.order_id}`,
          outcome: pnl >= 0 ? "WIN" : "LOSS",
          netProfit: Math.max(0, pnl),
          netLoss: Math.abs(Math.min(0, pnl)),
          rr: 0, strategy: "Coinbase Sync",
        };
      });
    res.json({ ok: true, count: trades.length, trades });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── MT5 bridge info ───────────────────────────────────────────────────
router.get("/broker/mt5/info", authMiddleware, platinumMiddleware, (req, res) => {
  const host  = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
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
  id: string; symbol: string; side: "buy" | "sell"; qty: string;
  filled_qty?: string; filled_avg_price?: string; filled_at?: string;
  created_at: string; status: string; order_type?: string; type?: string;
}
interface OandaTrade {
  id: string; instrument?: string; price?: string; initialUnits?: string;
  openTime?: string; realizedPL?: string;
  stopLossOrder?: { price?: string }; takeProfitOrder?: { price?: string };
}
interface BinanceTrade {
  id: number; orderId: number; symbol?: string; _symbol?: string;
  price: string; qty: string; quoteQty: string; commission: string;
  isBuyer: boolean; time: number;
}
interface KrakenTrade {
  ordertxid?: string; pair?: string; time?: string; type?: string;
  ordertype?: string; price?: string; vol?: string; cost?: string; fee?: string;
}
interface BybitExec {
  execId: string; orderId?: string; symbol?: string; side?: string;
  execPrice?: string; execQty?: string; execValue?: string; execFee?: string;
  execTime?: string; _category?: string;
}
interface OkxFill {
  tradeId: string; ordId?: string; instId?: string; instType?: string;
  side?: string; fillSz?: string; fillPx?: string; fee?: string;
  ts?: string; _instType?: string;
}
interface KuCoinFill {
  tradeId: string; orderId?: string; symbol?: string; side?: string;
  price?: string; size?: string; fee?: string; createdAt?: string;
  _tradeType?: string;
}
interface CoinbaseFill {
  trade_id: string; order_id?: string; product_id?: string; side?: string;
  price?: string; size?: string; commission?: string; trade_time?: string;
}

export default router;
