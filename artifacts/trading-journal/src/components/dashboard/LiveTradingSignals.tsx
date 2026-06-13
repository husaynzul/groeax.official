import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Shield, Radar, BadgeAlert, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

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

const PAIRS = ["BTCUSDT", "ETHUSDT", "EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "AAPL"];

function fmt(n: number) {
  return n.toFixed(n > 100 ? 2 : 4);
}

const ASSET_CLASS_STYLE: Record<string, string> = {
  forex: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  crypto: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  stocks: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  commodities: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export default function LiveTradingSignals() {
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [pair, setPair] = useState("BTCUSDT");

  useEffect(() => {
    let mounted = true;
    const base = getApiBase();
    const load = async () => {
      try {
        const res = await fetch(`${base}/api/trading-signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pair }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as TradingSignal;
        if (mounted) setSignal(data);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pair]);

  const isLong = signal?.signalType === "LONG";
  const isShort = signal?.signalType === "SHORT";
  const isActive = isLong || isShort;

  return (
    <div className={`rounded-[24px] border backdrop-blur-xl overflow-hidden shadow-[0_24px_120px_rgba(0,0,0,0.42)] ${
      isLong ? "border-emerald-500/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),rgba(255,255,255,0.02)_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]" :
      isShort ? "border-red-500/20 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.10),rgba(255,255,255,0.02)_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]" :
      "border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_26%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))]"
    }`}>
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.14)]">
              <Radar className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">Live Trading Signal</p>
              <p className="text-[11px] text-white/22 mt-0.5">Session-aware pair selection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-white/30">Pair</label>
            <div className="relative">
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="appearance-none rounded-full border border-white/10 bg-[#12151d] pl-3 pr-8 py-1.5 text-[10px] font-semibold text-white/90 outline-none focus:border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                {PAIRS.map((p) => <option key={p} value={p} className="bg-[#12151d] text-white">{p}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <AnimatePresence mode="wait">
            {signal ? (
              <motion.div
                key={signal.pair}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="flex items-end gap-3 flex-wrap"
              >
                <h2 className={`text-[34px] font-extrabold tracking-tight leading-none ${
                  isLong ? "text-emerald-300" : isShort ? "text-red-300" : "text-white/80"
                }`}>
                  {signal.pair}
                </h2>
                <span className={`mb-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${ASSET_CLASS_STYLE[signal.assetClass] ?? ASSET_CLASS_STYLE.forex}`}>
                  {signal.assetClass}
                </span>
              </motion.div>
            ) : loading ? (
              <div className="h-9 w-36 rounded-lg bg-white/[0.05] animate-pulse" />
            ) : null}
          </AnimatePresence>
          <span className="mb-1.5 ml-auto flex items-center gap-1.5 text-[9px] text-white/25">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Live · 20s
          </span>
        </div>
      </div>

      <div className="p-4">
        {loading && !signal ? (
          <div className="h-28 rounded-2xl bg-white/[0.02] animate-pulse" />
        ) : !isActive ? (
          <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-3.5 text-sm text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <BadgeAlert className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold leading-tight text-white/90">No valid setup{signal?.pair ? ` for ${signal.pair}` : ""}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/40 uppercase tracking-wider">Watchlist</span>
                </div>
                <p className="text-[11px] mt-1 leading-snug text-white/50">
                  {signal?.setupReason
                    ? `No valid setup because ${signal.setupReason}.`
                    : signal?.aiExplanation || "Structure, liquidity, and sentiment are not aligned yet. We’ll surface a stronger setup as soon as the market confirms."}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
                <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Bias</p>
                <p className="text-xs font-medium text-white/80">Neutral</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
                <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Structure</p>
                <p className="text-xs font-medium text-white/80">Not aligned</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
                <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Sentiment</p>
                <p className="text-xs font-medium text-white/80">Mixed</p>
              </div>
            </div>
          </div>
        ) : signal ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Entry Zone</p>
                <p className="text-sm font-semibold text-white/90">{signal.entryZone ? `${fmt(signal.entryZone.low)} – ${fmt(signal.entryZone.high)}` : "—"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Stop Loss</p>
                <p className="text-sm font-semibold text-red-400">{signal.stopLoss ? fmt(signal.stopLoss) : "—"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">R : R</p>
                <p className="text-sm font-semibold text-white/90">{signal.riskReward ?? "—"}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-white/30 uppercase tracking-wider">Confidence</span>
                <span className={`text-[10px] font-bold ${signal.confidenceScore >= 80 ? "text-emerald-400" : signal.confidenceScore >= 60 ? "text-amber-400" : "text-white/50"}`}>
                  {signal.confidenceScore}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isLong ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-red-600 to-red-400"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${signal.confidenceScore}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {signal.takeProfits.slice(0, 3).map((tp, i) => (
                <div key={i} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">TP {i + 1}</p>
                  <p className="text-sm font-semibold text-emerald-400">{fmt(tp)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 flex items-start gap-2.5">
              {isLong
                ? <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                : <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-white/50 leading-relaxed">{signal.aiExplanation}</p>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
