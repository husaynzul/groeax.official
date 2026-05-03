import { Router } from "express";
import { generateTradingSignal, type TradingSignalOutput } from "./tradingSignal.js";

const router = Router();

type Impact = "High" | "Medium" | "Low" | "Holiday";
interface CalEvent {
  title: string;
  country: string;
  date: string;
  impact: Impact;
  forecast?: string;
  previous?: string;
  actual?: string;
}

interface RawSignal {
  id: string;
  source: "news" | "economic" | "social" | "price" | "sentiment";
  text: string;
  asset: string;
  sentiment: "bullish" | "bearish" | "neutral" | "volatile";
  timestamp: number;
  weight: number;
}

export interface IntelligenceEvent {
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

export type IntelligenceFeedItem = IntelligenceEvent | TradingSignalOutput;

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
let calendarCache: { data: CalEvent[]; ts: number } | null = null;
let fusionCache: { data: IntelligenceFeedItem[]; ts: number } | null = null;
let prevFusionCache: { data: IntelligenceEvent[]; ts: number } | null = null;
const processedIds = new Set<string>();

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

function keywordSimilarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tokB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...tokA].filter((w) => tokB.has(w)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return union === 0 ? 0 : intersection / union;
}

const ASSET_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "crypto", "digital asset", "cryptocurrency"],
  ETH: ["ethereum", "eth", "ether", "defi"],
  USD: ["dollar", "usd", "federal reserve", "fed", "fomc", "nonfarm", "payroll", "cpi", "inflation"],
  EUR: ["euro", "eur", "ecb", "european central bank", "eurozone"],
  GBP: ["pound", "gbp", "bank of england", "boe", "uk"],
  JPY: ["yen", "jpy", "boj", "bank of japan"],
  GOLD: ["gold", "xau", "precious metal", "bullion"],
  OIL: ["oil", "crude", "opec", "wti", "brent", "energy"],
  SPX: ["s&p", "stocks", "equities", "wall street", "nasdaq", "dow"],
};

function detectAsset(text: string): string {
  const lower = text.toLowerCase();
  for (const [asset, kws] of Object.entries(ASSET_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw))) return asset;
  }
  return "MACRO";
}

function econSentiment(ev: CalEvent): "bullish" | "bearish" | "neutral" | "volatile" {
  if (ev.actual && ev.forecast) {
    const a = parseFloat(ev.actual);
    const f = parseFloat(ev.forecast);
    if (!isNaN(a) && !isNaN(f)) {
      if (a > f * 1.05) return "bullish";
      if (a < f * 0.95) return "bearish";
    }
  }
  if (ev.impact === "High") return "volatile";
  return "neutral";
}

function generateSyntheticSignals(events: CalEvent[]): RawSignal[] {
  const now = Date.now();
  const signals: RawSignal[] = [];
  const pool = [
    { text: "Markets on edge ahead of key Fed decision", asset: "USD", s: "volatile" as const, w: 0.7 },
    { text: "Bitcoin holds support as traders await macro data", asset: "BTC", s: "neutral" as const, w: 0.5 },
    { text: "Gold surges on inflation fears", asset: "GOLD", s: "bullish" as const, w: 0.8 },
    { text: "EUR/USD under pressure ahead of ECB", asset: "EUR", s: "bearish" as const, w: 0.6 },
    { text: "Crude oil drops on demand concerns", asset: "OIL", s: "bearish" as const, w: 0.65 },
    { text: "Stocks rally on strong earnings surprise", asset: "SPX", s: "bullish" as const, w: 0.75 },
    { text: "GBP weakness continues amid UK uncertainty", asset: "GBP", s: "bearish" as const, w: 0.55 },
    { text: "ETH on-chain activity spikes ahead of upgrade", asset: "ETH", s: "bullish" as const, w: 0.6 },
    { text: "JPY strengthens as BoJ signals tightening", asset: "JPY", s: "bullish" as const, w: 0.7 },
    { text: "Volatility index spikes on geopolitical tension", asset: "MACRO", s: "volatile" as const, w: 0.9 },
  ];
  const seed = Math.floor(now / 60_000);
  const selected = pool.filter((_, i) => ((seed + i * 7) % 3) !== 0);
  selected.forEach((p, i) => {
    signals.push({ id: `synthetic-${i}-${seed}`, source: i % 2 === 0 ? "social" : "price", text: p.text, asset: p.asset, sentiment: p.s, timestamp: now - i * 30_000, weight: p.w });
  });
  events.filter((e) => e.impact === "High" || e.impact === "Medium").slice(0, 8).forEach((e, i) => {
    const id = `econ-${simpleHash(e.title + e.date)}`;
    if (!processedIds.has(id)) {
      signals.push({ id, source: "economic", text: e.title, asset: detectAsset(e.title + " " + e.country), sentiment: econSentiment(e), timestamp: new Date(e.date).getTime() || now - i * 120_000, weight: e.impact === "High" ? 0.85 : 0.55 });
      processedIds.add(id);
    }
  });
  return signals;
}

interface Cluster { signals: RawSignal[]; asset: string; text: string; }
function clusterSignals(signals: RawSignal[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const sig of signals) {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.asset === sig.asset && keywordSimilarity(cluster.text, sig.text) > 0.2) {
        cluster.signals.push(sig);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ signals: [sig], asset: sig.asset, text: sig.text });
  }
  return clusters;
}

const SUMMARIES: Record<string, string[]> = {
  bullish: ["Multiple sources confirm upward momentum. Strong buying interest observed across multiple timeframes.", "Positive sentiment driven by better-than-expected data. Bulls are in control short-term.", "Market participants pricing in further upside. Watch for resistance levels ahead."],
  bearish: ["Negative signals across data and social feeds. Selling pressure likely to continue.", "Bearish confluence detected from economic data and price action. Caution advised.", "Downside pressure building. Multiple sources indicate risk-off environment."],
  volatile: ["High uncertainty across sources. Expect sharp moves in either direction — manage risk carefully.", "Mixed signals from news and price feeds. Market awaiting a catalyst for direction.", "Volatility spike detected. Wider spreads and slippage risk elevated."],
  neutral: ["Signals are balanced with no clear directional bias. Market consolidating ahead of next catalyst.", "Low conviction from multiple sources. Sideways price action likely to continue.", "No dominant trend signal. Wait for confirmation before entering positions."],
};

function pickSummary(sentiment: string): string {
  const pool = SUMMARIES[sentiment] ?? SUMMARIES.neutral;
  return pool[Math.floor(Date.now() / 120_000) % pool.length];
}

function categoryForAsset(asset: string): string {
  if (["BTC", "ETH"].includes(asset)) return "Crypto";
  if (["USD", "EUR", "GBP", "JPY"].includes(asset)) return "Forex";
  if (asset === "GOLD") return "Commodities";
  if (asset === "OIL") return "Energy";
  if (asset === "SPX") return "Equities";
  return "Macro";
}

function mergeSentiment(signals: RawSignal[]): "bullish" | "bearish" | "neutral" | "volatile" {
  const counts = { bullish: 0, bearish: 0, neutral: 0, volatile: 0 };
  let totalWeight = 0;
  for (const s of signals) {
    counts[s.sentiment] += s.weight;
    totalWeight += s.weight;
  }
  if (Math.abs(counts.bullish - counts.bearish) < totalWeight * 0.15) return "volatile";
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as "bullish" | "bearish" | "neutral" | "volatile");
}

function buildEvent(cluster: Cluster, prevEvents: IntelligenceEvent[]): IntelligenceEvent {
  const { signals, asset } = cluster;
  const id = simpleHash(asset + signals.map((s) => s.id).join(""));
  const sourceLabels = [...new Set(signals.map((s) => {
    if (s.source === "economic") return "Economic Calendar";
    if (s.source === "social") return "Social Feed";
    if (s.source === "price") return "Price Action";
    if (s.source === "news") return "News Wire";
    return "Market Data";
  }))];
  const sentiment = mergeSentiment(signals);
  const avgWeight = signals.reduce((sum, s) => sum + s.weight, 0) / signals.length;
  const impactScore = Math.round(avgWeight * 100);
  let confidenceScore = Math.round(Math.min(100, 30 + signals.length * 15 + avgWeight * 30));
  if (signals.length >= 3) confidenceScore = Math.min(100, confidenceScore + 20);
  const prev = prevEvents.find((e) => e.id === id);
  const isMarketShift = !!prev && prev.sentiment !== sentiment;
  const isBreaking = impactScore > 85;
  const highWeight = signals.reduce((best, s) => (s.weight > best.weight ? s : best), signals[0]);
  return {
    id,
    eventTitle: highWeight.text.length > 60 ? `${highWeight.text.slice(0, 57)}…` : highWeight.text,
    category: categoryForAsset(asset),
    sources: sourceLabels,
    sentiment,
    impactScore,
    confidenceScore,
    timestamp: Math.max(...signals.map((s) => s.timestamp)),
    aiSummary: pickSummary(sentiment),
    isBreaking,
    isMarketShift,
    tags: [asset, ...sourceLabels.map((l) => l.split(" ")[0])],
  };
}

async function runFusion(): Promise<IntelligenceFeedItem[]> {
  if (!calendarCache || Date.now() - calendarCache.ts > 5 * 60_000) {
    try {
      const res = await fetch(FF_URL, { headers: { Accept: "application/json", "User-Agent": "TradeLog/1.0" }, signal: AbortSignal.timeout(8_000) });
      if (res.ok) calendarCache = { data: (await res.json()) as CalEvent[], ts: Date.now() };
    } catch {}
  }
  const events = calendarCache?.data ?? [];
  const signals = generateSyntheticSignals(events);
  const clusters = clusterSignals(signals);
  const prevEvents = prevFusionCache?.data ?? [];
  const intelligence = clusters.map((c) => buildEvent(c, prevEvents));
  const smcSignal = generateTradingSignal({
    structure: {
      choch: "bullish",
      bos: "bullish",
      orderBlocks: [{ side: "bullish", low: 101.7, high: 102.6 }],
      fvgs: [{ side: "bullish", low: 101.9, high: 102.3 }],
    },
    liquidity: { sweep: "below_lows", clusters: [103.2, 104.1, 105.4], zoneLow: 101.5, zoneHigh: 102.7 },
    whale: { confirmed: true, activityScore: 82 },
    sentiment: { bias: "neutral" },
    price: 102.4,
  });
  const result = [...intelligence, smcSignal];
  result.sort((a, b) => {
    const ab = "isBreaking" in a && a.isBreaking ? 1 : 0;
    const bb = "isBreaking" in b && b.isBreaking ? 1 : 0;
    if (ab !== bb) return bb - ab;
    const ai = "impactScore" in a ? a.impactScore : a.confidenceScore;
    const bi = "impactScore" in b ? b.impactScore : b.confidenceScore;
    return bi - ai;
  });
  return result;
}

router.get("/intelligence/feed", async (_req, res) => {
  try {
    if (fusionCache && Date.now() - fusionCache.ts < 60_000) {
      res.json(fusionCache.data);
      return;
    }
    prevFusionCache = { data: (fusionCache?.data.filter((e): e is IntelligenceEvent => "eventTitle" in e) ?? []), ts: Date.now() };
    const items = await runFusion();
    fusionCache = { data: items, ts: Date.now() };
    res.json(items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Intelligence fusion failed: ${msg}` });
  }
});

export default router;
