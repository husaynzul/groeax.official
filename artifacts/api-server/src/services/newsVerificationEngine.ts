export type SourceTier = 1 | 2 | 3;

export interface VerificationResult {
  verified: boolean;
  trustScore: number;
  sourceTier: SourceTier;
  reason: string;
  label: string;
}

const TIER1_SIGNALS = [
  "reuters", "bloomberg", "fed", "fomc", "federal reserve", "ecb", "boj",
  "bank of england", "central bank", "treasury", "official statement",
  "press release", "imf", "world bank", "sec", "cftc",
];

const TIER2_SIGNALS = [
  "economic calendar", "coingecko", "coindesk", "investing.com",
  "tradingeconomics", "marketwatch", "financial times", "wsj",
  "nfp", "cpi", "gdp", "pmi", "employment data", "price action",
];

const TIER3_SIGNALS = [
  "social feed", "twitter", "reddit", "telegram", "x.com",
  "rumor", "speculation", "community", "influencer",
];

export function verifyNewsAuthenticity(
  text: string,
  sources: string[],
  impactScore: number
): VerificationResult {
  const combined = (text + " " + sources.join(" ")).toLowerCase();

  let tier: SourceTier = 3;
  if (TIER1_SIGNALS.some((kw) => combined.includes(kw))) {
    tier = 1;
  } else if (
    TIER2_SIGNALS.some((kw) => combined.includes(kw)) ||
    sources.some((s) => ["Economic Calendar", "Price Action"].includes(s))
  ) {
    tier = 2;
  } else if (sources.length >= 2) {
    tier = 2; // multi-source minimum
  }

  let trustScore = tier === 1 ? 82 : tier === 2 ? 62 : 38;

  // Multi-source boost
  if (sources.length >= 3) trustScore = Math.min(100, trustScore + 15);
  else if (sources.length >= 2) trustScore = Math.min(100, trustScore + 8);

  // High impact data boost
  if (impactScore > 75) trustScore = Math.min(100, trustScore + 6);
  if (impactScore > 85) trustScore = Math.min(100, trustScore + 5);

  // Social-only penalty
  if (TIER3_SIGNALS.some((kw) => combined.includes(kw)) && tier === 3) {
    trustScore = Math.max(10, trustScore - 12);
  }

  const verified = trustScore >= 50;

  const reason =
    tier === 1
      ? "Institutional / official source verified"
      : tier === 2
      ? "Verified market data or multi-source confirmed"
      : "Unverified social / single-source signal";

  const label = tier === 1 ? "TIER 1" : tier === 2 ? "TIER 2" : "TIER 3";

  return { verified, trustScore, sourceTier: tier, reason, label };
}
