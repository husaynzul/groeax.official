import { Router } from "express";
import { authMiddleware, platinumMiddleware } from "../middleware/auth.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Provider resolution
// Priority: Gemini → Groq → OpenAI
// Each provider exposes an OpenAI-compatible /chat/completions endpoint.
// ─────────────────────────────────────────────────────────────────────────────

interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  visionModel: string | null; // null = no vision support
  maxTokensParam: "max_tokens" | "max_completion_tokens";
}

function resolveProvider(): Provider | null {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: geminiKey,
      chatModel: "gemini-2.0-flash",
      visionModel: "gemini-2.0-flash",
      maxTokensParam: "max_tokens",
    };
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      chatModel: "llama-3.3-70b-versatile",
      visionModel: null, // Groq does not support vision
      maxTokensParam: "max_tokens",
    };
  }

  const openaiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const openaiBase =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  if (openaiKey) {
    return {
      name: "openai",
      baseUrl: openaiBase,
      apiKey: openaiKey,
      chatModel: "gpt-4o-mini",
      visionModel: "gpt-4o",
      maxTokensParam: "max_completion_tokens",
    };
  }

  return null;
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

Important: For price fields (entryPrice, stopLoss, takeProfit) copy the value EXACTLY as it appears in the screenshot, including any commas (e.g. "27,267.9", "2,7267.9", "3,378.52"). Return ONLY the JSON object. No explanation, no markdown.`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/analyze — streaming AI trading coach
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ai/analyze", authMiddleware, platinumMiddleware, async (req, res) => {
  try {
    const { messages, tradingContext } = req.body;

    const provider = resolveProvider();
    if (!provider) {
      res.status(503).json({ error: "AI service not configured. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY." });
      return;
    }

    const contextMessage = tradingContext
      ? `\n\nTRADER'S CURRENT STATS:\n${tradingContext}`
      : "";

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...(messages ?? []),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
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

    if (!upstream.ok) {
      const err = await upstream.text();
      res.write(`data: ${JSON.stringify({ error: `AI error (${provider.name}): ${upstream.status} — ${err.slice(0, 200)}` })}\n\n`);
      res.end();
      return;
    }

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
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {}
      }
    }

    res.end();
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
// POST /api/ai/ocr-trade — extract trade details from screenshot
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

    const provider = resolveProvider();
    if (!provider) {
      res.status(503).json({ error: "AI service not configured. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY." });
      return;
    }

    // OCR requires vision support — skip Groq if it's the only option
    if (!provider.visionModel) {
      res.status(503).json({
        error: "Screenshot import requires a vision-capable AI model. Add GEMINI_API_KEY or OPENAI_API_KEY to enable this feature.",
      });
      return;
    }

    const imageUrl = isDataUri
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    req.log.info({ userId: req.userId, provider: provider.name }, "OCR trade analysis requested");

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
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
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, errText }, "OCR AI call failed");
      res.status(502).json({ error: `AI service error (${provider.name}): ${response.status}` });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const rawContent = data.choices?.[0]?.message?.content ?? "";

    const cleaned = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.warn({ rawContent }, "OCR response was not valid JSON");
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
      pair:        typeof parsed.pair === "string"       ? parsed.pair       : null,
      direction:   parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction as "BUY" | "SELL" : null,
      entryPrice:  parseOcrPrice(parsed.entryPrice),
      stopLoss:    parseOcrPrice(parsed.stopLoss),
      takeProfit:  parseOcrPrice(parsed.takeProfit),
      lotSize:     typeof parsed.lotSize === "number"    ? parsed.lotSize     : null,
      profit:      typeof parsed.profit === "number" && isFinite(parsed.profit) ? parsed.profit : null,
      date:        typeof parsed.date === "string"       ? parsed.date        : null,
      outcome:     parsed.outcome === "WIN" || parsed.outcome === "LOSS" || parsed.outcome === "BE"
                     ? parsed.outcome as "WIN" | "LOSS" | "BE"
                     : null,
      notes:       typeof parsed.notes === "string"      ? parsed.notes       : null,
    };

    req.log.info({ userId: req.userId, pair: result.pair, provider: provider.name }, "OCR trade analysis complete");
    res.json({ trade: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "OCR trade analysis error");
    res.status(500).json({ error: msg });
  }
});

export default router;
