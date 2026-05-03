export interface PairImpact {
  pair: string;
  impactDirection: "bullish" | "bearish" | "volatile" | "neutral";
  impactStrength: number;
  expectedMove: "low" | "medium" | "high";
}

export interface PairIntelligenceResult {
  affectedPairs: PairImpact[];
  expectedVolatility: "LOW" | "MEDIUM" | "HIGH";
  estimatedMovePercent: "0-1%" | "1-3%" | "3-8%" | "8%+";
}

const ASSET_PAIRS: Record<string, string[]> = {
  USD:  ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD"],
  EUR:  ["EURUSD", "EURGBP", "EURJPY", "EURCHF"],
  GBP:  ["GBPUSD", "EURGBP", "GBPJPY", "GBPCHF"],
  JPY:  ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"],
  BTC:  ["BTCUSDT", "BTCUSD", "BTCEUR"],
  ETH:  ["ETHUSDT", "ETHUSD", "ETHBTC"],
  GOLD: ["XAUUSD", "XAUEUR"],
  OIL:  ["USOIL", "UKOIL", "XTIUSD"],
  SPX:  ["SPX500", "US30", "NAS100"],
  MACRO: ["XAUUSD", "BTCUSDT", "EURUSD", "SPX500", "USDJPY"],
};

// When the base asset is bullish, these are the resulting pair directions
const PAIR_DIRECTION_MAP: Record<string, Record<string, "bullish" | "bearish">> = {
  USD: { EURUSD: "bearish", GBPUSD: "bearish", USDJPY: "bullish", USDCHF: "bullish", USDCAD: "bullish", AUDUSD: "bearish" },
  EUR: { EURUSD: "bullish", EURGBP: "bullish", EURJPY: "bullish", EURCHF: "bullish" },
  GBP: { GBPUSD: "bullish", EURGBP: "bearish", GBPJPY: "bullish", GBPCHF: "bullish" },
  JPY: { USDJPY: "bearish", EURJPY: "bearish", GBPJPY: "bearish", AUDJPY: "bearish" },
  BTC: { BTCUSDT: "bullish", BTCUSD: "bullish", BTCEUR: "bullish" },
  ETH: { ETHUSDT: "bullish", ETHUSD: "bullish", ETHBTC: "bullish" },
  GOLD: { XAUUSD: "bullish", XAUEUR: "bullish" },
  OIL: { USOIL: "bullish", UKOIL: "bullish", XTIUSD: "bullish" },
  SPX: { SPX500: "bullish", US30: "bullish", NAS100: "bullish" },
};

export function analyzePairImpact(
  asset: string,
  sentiment: "bullish" | "bearish" | "neutral" | "volatile",
  impactScore: number,
  options: { whaleAligned?: boolean; multiSourceConfirmed?: boolean } = {}
): PairIntelligenceResult {
  const pairs = ASSET_PAIRS[asset] ?? ASSET_PAIRS.MACRO;
  const dirMap = PAIR_DIRECTION_MAP[asset] ?? {};
  let strength = Math.round(impactScore);
  if (options.whaleAligned) strength = Math.min(100, strength + 10);
  if (options.multiSourceConfirmed) strength = Math.min(100, strength + 8);

  const affectedPairs: PairImpact[] = pairs.map((pair) => {
    let dir: PairImpact["impactDirection"] = "neutral";
    if (sentiment === "volatile") {
      dir = "volatile";
    } else if (sentiment === "bullish" || sentiment === "bearish") {
      const baseDir = dirMap[pair];
      if (baseDir) {
        // Flip if sentiment is bearish
        dir = sentiment === "bullish" ? baseDir : (baseDir === "bullish" ? "bearish" : "bullish");
      } else {
        dir = sentiment;
      }
    }
    const expectedMove: PairImpact["expectedMove"] = strength > 75 ? "high" : strength > 45 ? "medium" : "low";
    return { pair, impactDirection: dir, impactStrength: strength, expectedMove };
  });

  const expectedVolatility: "LOW" | "MEDIUM" | "HIGH" = strength > 75 ? "HIGH" : strength > 45 ? "MEDIUM" : "LOW";
  const estimatedMovePercent: "0-1%" | "1-3%" | "3-8%" | "8%+" =
    strength > 85 ? "8%+" : strength > 70 ? "3-8%" : strength > 45 ? "1-3%" : "0-1%";

  return { affectedPairs, expectedVolatility, estimatedMovePercent };
}

// Returns a matrix: for a list of assets + events, which pairs are affected and how
export interface MatrixCell {
  pair: string;
  direction: "bullish" | "bearish" | "volatile" | "neutral";
  strength: number;
}

export interface PairMatrix {
  pairs: string[];
  assets: string[];
  cells: Record<string, Record<string, MatrixCell>>; // cells[asset][pair]
}

export function buildPairMatrix(
  events: Array<{ asset: string; sentiment: "bullish" | "bearish" | "neutral" | "volatile"; impactScore: number }>
): PairMatrix {
  const MATRIX_ASSETS = ["USD", "EUR", "GBP", "BTC", "ETH", "GOLD", "OIL", "SPX"];
  const MATRIX_PAIRS  = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSDT", "ETHUSDT", "XAUUSD", "USOIL", "NAS100"];

  const cells: PairMatrix["cells"] = {};

  for (const asset of MATRIX_ASSETS) {
    cells[asset] = {};
    const event = events.find((e) => e.asset === asset);
    if (!event) {
      for (const pair of MATRIX_PAIRS) {
        cells[asset][pair] = { pair, direction: "neutral", strength: 0 };
      }
      continue;
    }
    const result = analyzePairImpact(asset, event.sentiment, event.impactScore);
    for (const pair of MATRIX_PAIRS) {
      const found = result.affectedPairs.find((p) => p.pair === pair);
      cells[asset][pair] = found
        ? { pair, direction: found.impactDirection, strength: found.impactStrength }
        : { pair, direction: "neutral", strength: 0 };
    }
  }

  return { pairs: MATRIX_PAIRS, assets: MATRIX_ASSETS, cells };
}
