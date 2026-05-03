import { Router } from "express";

const router = Router();

interface SMCInput {
  pair?: string;
  assetClass?: "forex" | "crypto" | "stocks" | "commodities";
  structure?: {
    choch?: "bullish" | "bearish" | null;
    bos?: "bullish" | "bearish" | null;
    orderBlocks?: Array<{ side: "bullish" | "bearish"; low: number; high: number }>;
    fvgs?: Array<{ side: "bullish" | "bearish"; low: number; high: number }>;
  };
  liquidity?: {
    sweep?: "below_lows" | "above_highs" | null;
    clusters?: number[];
    zoneLow?: number;
    zoneHigh?: number;
  };
  whale?: {
    confirmed?: boolean;
    activityScore?: number;
  };
  sentiment?: {
    bias?: "bullish" | "bearish" | "neutral" | "volatile";
  };
  price?: number;
}

interface TradingSignal {
  pair: string;
  assetClass: "forex" | "crypto" | "stocks" | "commodities";
  signalType: "LONG" | "SHORT" | "NO_TRADE";
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  takeProfits: number[];
  confidenceScore: number;
  riskReward: number | null;
  aiExplanation: string;
  setupReason?: string;
  source: "SMC_SIGNAL_ENGINE";
}

function midpoint(low: number, high: number): number {
  return (low + high) / 2;
}

function nearestClusters(clusters: number[] = [], price = 0, side: "LONG" | "SHORT") {
  const sorted = [...clusters].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return [price * 1.01, price * 1.02, price * 1.03].filter(Number.isFinite);
  const above = sorted.filter((n) => n > price);
  const below = sorted.filter((n) => n < price);
  if (side === "LONG") return [...above.slice(0, 3), ...sorted.slice(-1)].slice(0, 3);
  return [...below.slice(-3).reverse(), ...sorted.slice(0, 1)].slice(0, 3);
}

function chooseZone(input: SMCInput, side: "bullish" | "bearish") {
  const blocks = input.structure?.orderBlocks ?? [];
  const fvgs = input.structure?.fvgs ?? [];
  const ob = blocks.find((b) => b.side === side);
  if (ob) return { low: ob.low, high: ob.high, type: "order_block" as const };
  const fvg = fvgs.find((f) => f.side === side);
  if (fvg) return { low: fvg.low, high: fvg.high, type: "fvg" as const };
  return null;
}

function normalizePair(inputData: SMCInput): { pair: string; assetClass: TradingSignal["assetClass"] } {
  const pair = (inputData.pair ?? "BTCUSDT").toUpperCase();
  if (pair.includes("BTC") || pair.includes("ETH") || pair.includes("SOL")) return { pair, assetClass: "crypto" };
  if (pair.includes("XAU") || pair.includes("OIL") || pair.includes("WTI") || pair.includes("BRENT")) return { pair, assetClass: "commodities" };
  if (pair.includes("AAPL") || pair.includes("TSLA") || pair.includes("MSFT") || pair.includes("NAS") || pair.includes("SPX")) return { pair, assetClass: "stocks" };
  return { pair, assetClass: "forex" };
}

function generateTradingSignal(inputData: SMCInput): TradingSignal {
  const structureBias = inputData.structure?.choch ?? inputData.structure?.bos ?? null;
  const sentiment = inputData.sentiment?.bias ?? "neutral";
  const price = inputData.price ?? 0;
  const sweep = inputData.liquidity?.sweep ?? null;
  const whaleConfirmed = !!inputData.whale?.confirmed;
  const { pair, assetClass } = normalizePair(inputData);

  const longConditions =
    (structureBias === "bullish") &&
    sweep === "below_lows" &&
    sentiment !== "bearish";

  const shortConditions =
    (structureBias === "bearish") &&
    sweep === "above_highs" &&
    sentiment !== "bullish";

  const side = longConditions ? "LONG" : shortConditions ? "SHORT" : "NO_TRADE";

  if (side === "NO_TRADE") {
    const setupReason = !structureBias
      ? "structure is missing"
      : !sweep
        ? "liquidity sweep is missing"
        : sentiment === "bearish" && longConditions
          ? "sentiment is bearish"
          : sentiment === "bullish" && shortConditions
            ? "sentiment is bullish"
            : "conditions are not aligned";
    return {
      pair,
      assetClass,
      signalType: "NO_TRADE",
      entryZone: null,
      stopLoss: null,
      takeProfits: [],
      confidenceScore: 0,
      riskReward: null,
      aiExplanation: `No valid setup for ${pair}: ${setupReason}.`,
      setupReason,
      source: "SMC_SIGNAL_ENGINE",
    };
  }

  const zone = chooseZone(inputData, side === "LONG" ? "bullish" : "bearish");
  const entryZone = zone ? { low: zone.low, high: zone.high } : null;
  const entry = zone ? midpoint(zone.low, zone.high) : price;
  const sweepZone = inputData.liquidity?.sweep === "below_lows" ? inputData.liquidity?.zoneLow : inputData.liquidity?.zoneHigh;
  const buffer = Math.max(price * 0.001, 0.0001);
  const stopLoss = side === "LONG"
    ? (sweepZone ?? (entryZone ? entryZone.low : entry)) - buffer
    : (sweepZone ?? (entryZone ? entryZone.high : entry)) + buffer;

  const targets = nearestClusters(inputData.liquidity?.clusters ?? [], price || entry, side);
  const takeProfits = targets.slice(0, 3);

  let confidenceScore = 40;
  if (structureBias) confidenceScore += 20;
  if (sweep) confidenceScore += 15;
  if (whaleConfirmed) confidenceScore += 15;
  if (sentiment === "neutral") confidenceScore += 5;
  if (sentiment === "volatile") confidenceScore += 3;
  confidenceScore = Math.min(100, confidenceScore);

  const risk = Math.abs((entryZone ? midpoint(entryZone.low, entryZone.high) : entry) - stopLoss);
  const reward = takeProfits[0] ? Math.abs(takeProfits[0] - (entryZone ? midpoint(entryZone.low, entryZone.high) : entry)) : 0;
  const riskReward = risk > 0 && reward > 0 ? Number((reward / risk).toFixed(2)) : null;

  if (confidenceScore < 70) {
    return {
      pair,
      assetClass,
      signalType: "NO_TRADE",
      entryZone: null,
      stopLoss: null,
      takeProfits: [],
      confidenceScore,
      riskReward: null,
      aiExplanation: `Potential setup found for ${pair}, but confidence is below the execution threshold.`,
      setupReason: "confidence is below the execution threshold",
      source: "SMC_SIGNAL_ENGINE",
    };
  }

  return {
    pair,
    assetClass,
    signalType: side,
    entryZone,
    stopLoss,
    takeProfits,
    confidenceScore,
    riskReward,
    aiExplanation:
      side === "LONG"
        ? `Bullish structure, liquidity sweep below lows, and a valid demand zone align for a long setup on ${pair}.`
        : `Bearish structure, liquidity sweep above highs, and a valid supply zone align for a short setup on ${pair}.`,
    source: "SMC_SIGNAL_ENGINE",
  };
}

function buildMockInput(pair = "BTCUSDT"): SMCInput {
  const isStocks = pair.includes("AAPL") || pair.includes("TSLA") || pair.includes("MSFT") || pair.includes("NAS") || pair.includes("SPX");
  const isCommodities = pair.includes("XAU") || pair.includes("OIL") || pair.includes("WTI") || pair.includes("BRENT");
  const isCrypto = pair.includes("BTC") || pair.includes("ETH") || pair.includes("SOL");
  const price = isStocks ? 412.6 : isCommodities ? 2312.4 : isCrypto ? 102.4 : 1.0871;
  return {
    pair,
    assetClass: isCrypto ? "crypto" : isCommodities ? "commodities" : isStocks ? "stocks" : "forex",
    structure: {
      choch: "bullish",
      bos: "bullish",
      orderBlocks: [{ side: "bullish", low: price * 0.992, high: price * 1.002 }],
      fvgs: [{ side: "bullish", low: price * 0.994, high: price * 1.000 }],
    },
    liquidity: {
      sweep: "below_lows",
      clusters: [price * 1.012, price * 1.022, price * 1.034],
      zoneLow: price * 0.989,
      zoneHigh: price * 1.003,
    },
    whale: {
      confirmed: true,
      activityScore: 82,
    },
    sentiment: {
      bias: "neutral",
    },
    price,
  };
}

router.get("/trading-signal", (_req, res) => {
  const signal = generateTradingSignal(buildMockInput());
  res.json(signal);
});

router.post("/trading-signal", (req, res) => {
  const signal = generateTradingSignal(req.body as SMCInput);
  res.json(signal);
});

export { generateTradingSignal };
export default router;
