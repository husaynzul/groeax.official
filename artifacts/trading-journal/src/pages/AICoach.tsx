import { useState, useRef, useEffect, useMemo } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import type { Trade } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { format } from "date-fns";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const STARTER_QUESTIONS = [
  "What's my biggest weakness as a trader?",
  "Which strategy should I focus on?",
  "Am I overtrading or undertrading?",
  "How can I improve my win rate?",
  "Is my risk management good enough?",
  "What time of day do I perform best?",
];

function buildTradingContext(analytics: ReturnType<typeof computeAnalytics>, trades: Trade[]): string {
  const pf = analytics.totalLoss > 0
    ? (analytics.totalProfit / analytics.totalLoss).toFixed(2)
    : analytics.totalProfit > 0 ? "∞" : "0";

  const avgRR = trades.length > 0
    ? (trades.reduce((s, t) => s + t.rr, 0) / trades.length).toFixed(2)
    : "0";

  const wins = trades.filter((t) => t.outcome === "WIN").length;
  const losses = trades.filter((t) => t.outcome === "LOSS").length;
  const be = trades.filter((t) => t.outcome === "BE").length;

  const stratLines = analytics.strategyStats.map((s) =>
    `  - ${s.name}: ${s.count} trades, ${s.winRate}% WR, net ${fmtMoney(s.netPnL)}, avg ${s.avgRR.toFixed(2)}R`
  ).join("\n") || "  None";

  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map((t) => {
      const pnl = t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "$0";
      return `  - ${t.date} | ${t.pair} ${t.direction} | ${t.outcome ?? "?"} | ${pnl} | ${t.rr.toFixed(2)}R${t.strategy ? ` | ${t.strategy}` : ""}`;
    }).join("\n") || "  None";

  const maxDD = analytics.drawdownCurve.length > 0
    ? Math.max(...analytics.drawdownCurve.map((d) => d.drawdown))
    : 0;

  return `
Total Trades: ${analytics.totalTrades}
Win/Loss/BE: ${wins}W / ${losses}L / ${be}BE
Win Rate: ${analytics.winRate.toFixed(1)}%
Net P&L: ${fmtMoney(analytics.netBalance)}
Total Profit: ${fmtMoney(analytics.totalProfit)}
Total Loss: ${fmtMoney(analytics.totalLoss)}
Profit Factor: ${pf}
Average R:R: ${avgRR}
Best Trade: ${analytics.bestTrade ? `${analytics.bestTrade.pair} +${fmtMoney(analytics.bestTrade.netProfit)}` : "N/A"}
Worst Trade: ${analytics.worstTrade ? `${analytics.worstTrade.pair} -${fmtMoney(analytics.worstTrade.netLoss)}` : "N/A"}
Max Drawdown: ${fmtMoney(maxDD)}
Average Win: ${fmtMoney(analytics.avgWin)}
Average Loss: ${fmtMoney(analytics.avgLoss)}

Strategy Performance:
${stratLines}

Recent 10 Trades:
${recentTrades}
`.trim();
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-primary/20" : "bg-violet-500/20"
      }`}>
        {isUser ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-violet-400" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-secondary/60 border border-border text-foreground rounded-tl-sm"
      }`}>
        {msg.content}
        <p className={`text-[9px] mt-1.5 ${isUser ? "text-primary-foreground/50 text-right" : "text-muted-foreground"}`}>
          {format(msg.timestamp, "h:mm a")}
        </p>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-violet-400" />
      </div>
      <div className="bg-secondary/60 border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        {[0, 0.2, 0.4].map((d, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: d }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AICoach() {
  const trades = useTradeStore((s) => s.trades);
  const startingBalance = useTradeStore((s) => s.startingBalance);
  const analytics = useMemo(() => computeAnalytics(trades, startingBalance), [trades, startingBalance]);
  const tradingContext = useMemo(() => buildTradingContext(analytics, trades), [analytics, trades]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: content.trim(), timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "", timestamp: new Date() };
    setMessages([...updatedMessages, assistantMsg]);

    try {
      const basePath = (await import("@/lib/apiBase")).getApiBase();
      const res = await fetch(`${basePath}/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          tradingContext: trades.length > 0 ? tradingContext : null,
        }),
      });

      if (!res.ok || !res.body) throw new Error("AI service unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.done) continue;
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              accumulated += parsed.content;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...assistantMsg, content: accumulated };
                return next;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...assistantMsg, content: `⚠️ ${errMsg}` };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasTrades = trades.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold flex items-center gap-2">
              AI Trading Coach
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wider">GPT</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {hasTrades ? `Analyzing ${trades.length} trades · Objective feedback only` : "Add trades first for personalized analysis"}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-accent"
          >
            <RefreshCw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Stats bar */}
      {hasTrades && (
        <div className="flex items-center gap-4 px-6 py-2.5 border-b border-border bg-secondary/20 overflow-x-auto">
          {[
            { label: "Net P&L", value: fmtMoney(analytics.netBalance), color: analytics.netBalance >= 0 ? "text-emerald-400" : "text-red-400", icon: analytics.netBalance >= 0 ? TrendingUp : TrendingDown },
            { label: "Win Rate", value: `${analytics.winRate.toFixed(1)}%`, color: analytics.winRate >= 50 ? "text-emerald-400" : "text-red-400", icon: Zap },
            { label: "Trades", value: String(analytics.totalTrades), color: "text-foreground", icon: null },
            { label: "Profit Factor", value: analytics.totalLoss > 0 ? (analytics.totalProfit / analytics.totalLoss).toFixed(2) : "—", color: "text-foreground", icon: null },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5 shrink-0">
              {Icon && <Icon className={`w-3 h-3 ${color}`} />}
              <span className="text-[10px] text-muted-foreground">{label}:</span>
              <span className={`text-[10px] font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <p className="text-base font-semibold mb-1">Your AI Trading Coach</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {hasTrades
                  ? "Ask anything about your trading. I'll give you honest, data-driven answers — no sugarcoating."
                  : "Add some trades first, then come back for a full analysis of your performance."}
              </p>
            </div>

            {hasTrades && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs px-4 py-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {!hasTrades && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                No trades yet — add some trades to get personalized coaching
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              msg.content || msg.role === "user"
                ? <MessageBubble key={i} msg={msg} />
                : null
            ))}
            {isLoading && messages[messages.length - 1]?.content === "" && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        {messages.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {["Improve my win rate", "Best strategy?", "Risk management check", "Biggest mistake?"].map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-border bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={hasTrades ? "Ask about your trading performance…" : "Add trades first to get personalized coaching…"}
            disabled={isLoading || !hasTrades}
            rows={1}
            className="flex-1 bg-secondary/40 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-colors disabled:opacity-50"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim() || !hasTrades}
            className="w-11 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Powered by OpenAI · All advice is educational, not financial advice
        </p>
      </div>
    </div>
  );
}
