import { Router } from "express";
import { getSessionInfo, type SessionInfo } from "../services/timeSyncEngine.js";
import { analyzePairImpact, buildPairMatrix, type PairIntelligenceResult, type PairMatrix } from "../services/pairIntelligenceEngine.js";
import { verifyNewsAuthenticity, type VerificationResult } from "../services/newsVerificationEngine.js";

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────

interface RawIntelligenceEvent {
  id: string;
  eventTitle: string;
  category: string;
  sources: string[];
  sentiment: "bullish" | "bearish" | "neutral" | "volatile";
  impactScore: number;
  confidenceScore: number;
  timestamp: number;
  aiSummary: string;
  isBreaking: boolean;
  isMarketShift: boolean;
  tags: string[];
}

export interface EnhancedIntelligenceEvent extends RawIntelligenceEvent {
  verification: VerificationResult;
  pairAnalysis: PairIntelligenceResult;
  asset: string;
}

export interface MarketIntelligenceResponse {
  session: SessionInfo;
  events: EnhancedIntelligenceEvent[];
  pairMatrix: PairMatrix;
  generatedAt: number;
}

// ── Cache ──────────────────────────────────────────────────────────────────

let cache: { data: MarketIntelligenceResponse; ts: number } | null = null;
const CACHE_TTL = 20_000; // 20 seconds

// ── Asset detection (mirrors intelligence.ts logic) ────────────────────────

const ASSET_KEYWORDS: Record<string, string[]> = {
  BTC:   ["bitcoin", "btc", "crypto", "digital asset", "cryptocurrency"],
  ETH:   ["ethereum", "eth", "ether", "defi"],
  USD:   ["dollar", "usd", "federal reserve", "fed", "fomc", "nonfarm", "payroll", "cpi", "inflation"],
  EUR:   ["euro", "eur", "ecb", "european central bank", "eurozone"],
  GBP:   ["pound", "gbp", "bank of england", "boe", "uk"],
  JPY:   ["yen", "jpy", "boj", "bank of japan"],
  GOLD:  ["gold", "xau", "precious metal", "bullion"],
  OIL:   ["oil", "crude", "opec", "wti", "brent", "energy"],
  SPX:   ["s&p", "stocks", "equities", "wall street", "nasdaq", "dow"],
};

function detectAsset(text: string): string {
  const lower = text.toLowerCase();
  for (const [asset, kws] of Object.entries(ASSET_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw))) return asset;
  }
  return "MACRO";
}

// ── Enhance events ─────────────────────────────────────────────────────────

function enhanceEvent(raw: RawIntelligenceEvent): EnhancedIntelligenceEvent {
  const asset = detectAsset(raw.eventTitle + " " + raw.tags.join(" "));
  const verification = verifyNewsAuthenticity(raw.eventTitle, raw.sources, raw.impactScore);
  const multiSource = raw.sources.length >= 2;
  const pairAnalysis = analyzePairImpact(
    asset,
    raw.sentiment,
    raw.impactScore,
    { multiSourceConfirmed: multiSource }
  );
  return { ...raw, asset, verification, pairAnalysis };
}

// ── Pipeline ───────────────────────────────────────────────────────────────

async function runPipeline(): Promise<MarketIntelligenceResponse> {
  // Pull the raw intelligence feed from the same in-process logic
  // We proxy to our own endpoint (avoid circular import, just call internal fetch)
  const internalBase = `http://localhost:${process.env.PORT ?? 8080}`;
  let rawEvents: RawIntelligenceEvent[] = [];
  try {
    const res = await fetch(`${internalBase}/api/intelligence/feed`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const all = await res.json() as unknown[];
      // Filter only intelligence events (not trading signals)
      rawEvents = (all as RawIntelligenceEvent[]).filter((e) => "eventTitle" in e);
    }
  } catch {
    // Return session-only data on failure
  }

  const session = getSessionInfo();
  const enhanced = rawEvents.map(enhanceEvent);

  // Sort: verified + high-impact first
  enhanced.sort((a, b) => {
    const va = a.verification.verified ? 1 : 0;
    const vb = b.verification.verified ? 1 : 0;
    if (va !== vb) return vb - va;
    if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
    return b.impactScore - a.impactScore;
  });

  const matrixInput = enhanced.map((e) => ({
    asset: e.asset,
    sentiment: e.sentiment,
    impactScore: e.impactScore,
  }));
  const pairMatrix = buildPairMatrix(matrixInput);

  return {
    session,
    events: enhanced,
    pairMatrix,
    generatedAt: Date.now(),
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

router.get("/market-intelligence", async (_req, res) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      res.json(cache.data);
      return;
    }
    const data = await runPipeline();
    cache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Market intelligence pipeline failed: ${msg}` });
  }
});

// Session-only lightweight endpoint
router.get("/market-intelligence/session", (_req, res) => {
  res.json(getSessionInfo());
});

export default router;
