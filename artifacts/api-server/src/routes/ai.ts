import { Router } from "express";

const router = Router();

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

router.post("/ai/analyze", async (req, res) => {
  try {
    const { messages, tradingContext } = req.body;

    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!baseUrl || !apiKey) {
      res.status(503).json({ error: "AI service not configured" });
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

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      res.write(`data: ${JSON.stringify({ error: `AI error: ${upstream.status}` })}\n\n`);
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

export default router;
