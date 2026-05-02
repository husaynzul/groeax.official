import { Router } from "express";

const router = Router();

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { data: unknown; ts: number } | null = null;

router.get("/news/calendar", async (req, res) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      res.json(cache.data);
      return;
    }

    const upstream = await fetch(FF_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; TradeLog/1.0)",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    cache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Failed to fetch calendar: ${msg}` });
  }
});

export default router;
