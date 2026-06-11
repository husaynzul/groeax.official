import { Router } from "express";
import { authMiddleware, platinumMiddleware } from "../middleware/auth.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Provider definitions
// All expose OpenAI-compatible /chat/completions endpoints.
// ─────────────────────────────────────────────────────────────────────────────

interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  visionModel: string | null;
  maxTokensParam: "max_tokens" | "max_completion_tokens";
}

function resolveProviders(): Provider[] {
  const providers: Provider[] = [];
  const geminiBase = "https://generativelanguage.googleapis.com/v1beta/openai";

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    // Try lite model first (30 RPM free) — less likely to hit rate limits
    providers.push({
      name: "gemini-lite",
      baseUrl: geminiBase,
      apiKey: geminiKey,
      chatModel: "gemini-2.0-flash-lite",
      visionModel: "gemini-2.0-flash-lite",
      maxTokensParam: "max_tokens",
    });
    // Full flash as second attempt
    providers.push({
      name: "gemini",
      baseUrl: geminiBase,
      apiKey: geminiKey,
      chatModel: "gemini-2.0-flash",
      visionModel: "gemini-2.0-flash",
      maxTokensParam: "max_tokens",
    });
    // 1.5 flash-8b as third attempt (15 RPM but smaller quota bucket)
    providers.push({
      name: "gemini-1.5",
      baseUrl: geminiBase,
      apiKey: geminiKey,
      chatModel: "gemini-1.5-flash-8b",
      visionModel: "gemini-1.5-flash-8b",
      maxTokensParam: "max_tokens",
    });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      chatModel: "llama-3.3-70b-versatile",
      visionModel: null, // Groq has no vision support
      maxTokensParam: "max_tokens",
    });
  }

  const openaiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (openaiKey) {
    providers.push({
      name: "openai",
      baseUrl:
        process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: openaiKey,
      chatModel: "gpt-4o-mini",
      visionModel: "gpt-4o",
      maxTokensParam: "max_completion_tokens",
    });
  }

  return providers;
}

/** Returns true for transient/rate-limit errors worth retrying on another provider */
function shouldFallback(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status >= 500;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert trading coach and performance analyst. Your role is to analyze a trader's data objectively and give honest, actionable advice.

CRITICAL RULES:
- Be completely emotionally neutral. If a strategy is performing poorly, say so clearly.
- Never validate bad habits to make the trader feel good.
- Give specific, data-driven answers based on the stats provided.
- Be concise — traders need clarity, not essays.
- If the trader asks "is my strategy good?", analyze the actual stats and give a direct answer.
- Identify the single most impactful thing they should fix.
- For losing traders, focus on risk management first.
- Use trading terminology appropriately.

When given trading stats, analyze: win rate, profit factor, average R:R, drawdown, strategy performance, consistency, and emotional patterns visible in the data.

Format responses with clear sections when appropriate. Use bullet points for multiple insights.`;

const OCR_SYSTEM_PROMPT = `You are a trading screenshot parser. Your job is to extract trade details from a trading platform screenshot.

Look for: pair/symbol, direction (buy/long or sell/short), entry price, stop loss, take profit, lot size/volume, date/time, and outcome.

Respond ONLY with a valid JSON object — no markdown, no code blocks, no extra text. Just raw JSON.`;

const OCR_USER_PROMPT = `Analyze this trading screenshot and extract all trade details you can find.

Return ONLY a JSON object with these exact fields (use null for fields you cannot determine):
{
  "pair": "string — e.g. EUR/USD, GBP/USD, XAU/USD, US30, NAS100 — use standard notation",
  "direction": "BUY" or "SELL" (null if unknown),
  "entryPrice": string or number or null — preserve EXACTLY as shown, e.g. "27,267.9" or "1.08456",
  "stopLoss": string or number or null — preserve EXACTLY as shown on screen,
  "takeProfit": string or number or null — preserve EXACTLY as shown on screen,
  "lotSize": number or null,
  "profit": number or null — the actual broker P&L value shown (e.g. 12.50, -8.00). Use the exact dollar/monetary value shown, positive for profit, negative for loss. null if not visible,
  "date": "YYYY-MM-DD" or null,
  "outcome": "WIN" or "LOSS" or "BE" or null,
  "notes": "brief description of what you see in the screenshot (max 100 chars)" or null
}

Important: For price fields (entryPrice, stopLoss, takeProfit) copy the value EXACTLY as it appears in the screenshot, including any commas. Return ONLY the JSON object. No explanation, no markdown.`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/analyze — streaming AI trading coach (with provider fallback)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ai/analyze", authMiddleware, platinumMiddleware, async (req, res) => {
  try {
    const { messages, tradingContext } = req.body;

    const providers = resolveProviders();
    if (providers.length === 0) {
      res.status(503).json({ error: "AI service not configured. Add GEMINI_API_KEY or GROQ_API_KEY." });
      return;
    }

    const contextMessage = tradingContext
      ? `\n\nTRADER'S CURRENT STATS:\n${tradingContext}`
      : "";

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...(messages ?? []),
    ];

    // Try each provider; fall back on rate-limit / server errors
    let lastError = "";
    for (const provider of providers) {
      let upstream: Response;
      try {
        upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.chatModel,
            [provider.maxTokensParam]: 4096,
            messages: chatMessages,
            stream: true,
          }),
        });
      } catch (fetchErr) {
        lastError = `${provider.name} unreachable`;
        continue;
      }

      if (!upstream.ok) {
        const errText = await upstream.text();
        lastError = `${provider.name} ${upstream.status}: ${errText.slice(0, 120)}`;
        if (shouldFallback(upstream.status)) continue;
        // Non-retryable error — stop immediately
        if (!res.headersSent) {
          res.status(upstream.status).json({ error: lastError });
        }
        return;
      }

      // Success — stream the response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.flushHeaders();

      const reader = upstream.body?.getReader();
      if (!reader) { res.end(); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
          } catch {}
        }
      }

      res.end();
      return;
    }

    // All providers failed
    const msg = `All AI providers unavailable. Last error: ${lastError}`;
    if (!res.headersSent) {
      res.status(503).json({ error: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/ocr-trade — extract trade details from screenshot (in-memory)
// Images are processed entirely in RAM — never written to disk.
// Available to all authenticated users (silver+)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ai/ocr-trade", authMiddleware, async (req, res) => {
  try {
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const isDataUri = imageBase64.startsWith("data:");
    if (!isDataUri && !imageBase64.match(/^[A-Za-z0-9+/=]+$/)) {
      res.status(400).json({ error: "Invalid image data" });
      return;
    }

    if (imageBase64.length > 6 * 1024 * 1024) {
      res.status(400).json({ error: "Image too large (max 4MB)" });
      return;
    }

    // Only vision-capable providers can handle OCR
    const providers = resolveProviders().filter((p) => p.visionModel !== null);
    if (providers.length === 0) {
      res.status(503).json({
        error: "Screenshot import requires a vision-capable AI. Add GEMINI_API_KEY or OPENAI_API_KEY.",
      });
      return;
    }

    const imageUrl = isDataUri ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    req.log.info({ userId: req.userId }, "OCR trade analysis requested (in-memory)");

    let lastError = "";
    for (const provider of providers) {
      let response: Response;
      try {
        response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.visionModel,
            [provider.maxTokensParam]: 512,
            messages: [
              { role: "system", content: OCR_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: OCR_USER_PROMPT },
                  { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
                ],
              },
            ],
          }),
        });
      } catch (fetchErr) {
        lastError = `${provider.name} unreachable`;
        req.log.warn({ provider: provider.name }, "OCR provider unreachable, trying next");
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        lastError = `${provider.name} ${response.status}`;
        req.log.warn({ provider: provider.name, status: response.status }, "OCR provider error, trying next");
        if (shouldFallback(response.status)) continue;
        res.status(502).json({ error: `AI service error (${provider.name}): ${response.status}` });
        return;
      }

      // Parse response
      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      // Image buffer is done — discard reference immediately
      const rawContent = data.choices?.[0]?.message?.content ?? "";
      const cleaned = rawContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        req.log.warn({ rawContent: rawContent.slice(0, 200) }, "OCR response was not valid JSON");
        res.status(422).json({
          error: "Could not parse trade details from screenshot. Try a clearer image.",
          raw: rawContent,
        });
        return;
      }

      function parseOcrPrice(val: unknown): number | null {
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return isFinite(val) && val > 0 ? val : null;
        if (typeof val === "string") {
          const s = val.replace(/[$€£¥\s]/g, "");
          if (!/^[\d,.]+$/.test(s) || !s) return null;
          const hasDot = s.includes(".");
          const commaCount = (s.match(/,/g) ?? []).length;
          let normalized = s;
          if (hasDot) {
            normalized = s.replace(/,/g, "");
          } else if (commaCount === 1) {
            const afterComma = s.split(",")[1] ?? "";
            normalized = afterComma.length > 2 ? s.replace(",", ".") : s.replace(/,/g, "");
          } else {
            normalized = s.replace(/,/g, "");
          }
          const n = parseFloat(normalized);
          return isFinite(n) && n > 0 ? n : null;
        }
        return null;
      }

      const result = {
        pair:       typeof parsed.pair === "string"      ? parsed.pair       : null,
        direction:  parsed.direction === "BUY" || parsed.direction === "SELL"
                      ? parsed.direction as "BUY" | "SELL"
                      : null,
        entryPrice: parseOcrPrice(parsed.entryPrice),
        stopLoss:   parseOcrPrice(parsed.stopLoss),
        takeProfit: parseOcrPrice(parsed.takeProfit),
        lotSize:    typeof parsed.lotSize === "number"   ? parsed.lotSize    : null,
        profit:     typeof parsed.profit === "number" && isFinite(parsed.profit)
                      ? parsed.profit
                      : null,
        date:       typeof parsed.date === "string"      ? parsed.date       : null,
        outcome:    parsed.outcome === "WIN" || parsed.outcome === "LOSS" || parsed.outcome === "BE"
                      ? parsed.outcome as "WIN" | "LOSS" | "BE"
                      : null,
        notes:      typeof parsed.notes === "string"     ? parsed.notes      : null,
      };

      req.log.info({ userId: req.userId, pair: result.pair, provider: provider.name }, "OCR complete");
      res.json({ trade: result });
      return;
    }

    // All vision providers exhausted
    res.status(503).json({
      error: `Screenshot analysis unavailable (rate limited). Try again in a moment. Last: ${lastError}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "OCR trade analysis error");
    res.status(500).json({ error: msg });
  }
});

export default router;
