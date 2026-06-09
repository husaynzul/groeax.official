/**
 * Broker-agnostic price parser.
 *
 * Handles all common broker-specific number formats:
 *   27267.9      → 27267.9   (plain decimal)
 *   27,267.9     → 27267.9   (US thousands separator)
 *   2,7267.9     → 27267.9   (non-standard thousands separator)
 *   3,378.52     → 3378.52   (standard thousands separator)
 *   1.08456      → 1.08456   (forex 5-decimal)
 *   1 08456      → 108456    (space separator, some brokers)
 *
 * Strategy: when a dot is present it is always the decimal separator,
 * so every comma (and space) is a thousands separator and can be removed.
 * When there is NO dot and ONE comma, that comma may be a European decimal
 * separator — we convert it to a dot in that case.
 */
export function parseBrokerPrice(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;

  let s = raw.toString().trim();

  // Strip currency symbols and whitespace
  s = s.replace(/[$€£¥\s]/g, "");

  if (!s) return 0;

  const hasDot = s.includes(".");
  const commaCount = (s.match(/,/g) ?? []).length;

  if (hasDot) {
    // Dot is the decimal separator — all commas are thousands separators
    s = s.replace(/,/g, "");
  } else if (commaCount === 1) {
    // No dot: single comma could be European decimal (e.g. "1,08456")
    // Check: if the part after the comma looks like a decimal fraction
    // (i.e. there are more than 2 digits after it, typical of price decimals)
    // treat it as the decimal separator; otherwise treat as thousands separator.
    const afterComma = s.split(",")[1] ?? "";
    if (afterComma.length > 2) {
      // European decimal — replace comma with dot
      s = s.replace(",", ".");
    } else {
      // Standard thousands separator (e.g. "3,378" → 3378)
      s = s.replace(/,/g, "");
    }
  } else {
    // Multiple commas — all are thousands separators
    s = s.replace(/,/g, "");
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Returns true if the string contains a broker-formatted price
 * (digits, optional commas/dots, no other chars).
 */
export function isBrokerPriceString(s: string): boolean {
  return /^[\d,.\s]+$/.test(s.trim());
}

/**
 * Parses a price that may be either a number or a string from OCR output.
 * Returns null if the value is clearly not a valid price.
 */
export function parseOcrPrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    return isFinite(raw) && raw > 0 ? raw : null;
  }

  if (typeof raw === "string") {
    if (!isBrokerPriceString(raw)) return null;
    const n = parseBrokerPrice(raw);
    return n > 0 ? n : null;
  }

  return null;
}
