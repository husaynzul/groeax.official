import { format } from "date-fns";

/**
 * Normalises any date string to a safe YYYY-MM-DD key.
 * Handles strings that already have a time component (e.g. "2024-01-15T08:30:00")
 * by stripping everything after the first "T".
 */
export function toDateKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const datePart = raw.split("T")[0];
  const d = new Date(datePart + "T12:00:00");
  return isNaN(d.getTime()) ? null : datePart;
}

/**
 * Safely converts a raw date string to a Date object at noon UTC.
 * Returns null if the value cannot be parsed.
 */
export function toDate(raw: string | null | undefined): Date | null {
  const key = toDateKey(raw);
  if (!key) return null;
  return new Date(key + "T12:00:00");
}

/**
 * Format a raw trade date string using date-fns format.
 * Returns fallback (default "—") if unparseable.
 */
export function fmtTradeDate(
  raw: string | null | undefined,
  fmt: string,
  fallback = "—",
): string {
  const d = toDate(raw);
  if (!d) return fallback;
  try {
    return format(d, fmt);
  } catch {
    return fallback;
  }
}
