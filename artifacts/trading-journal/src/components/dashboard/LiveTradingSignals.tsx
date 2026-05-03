import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Shield, Radar, BadgeAlert, TrendingUp, TrendingDown, ChevronDown, Tag } from "lucide-react";

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

  const pairLabel = useMemo(() => pair, [pair]);

  useEffect(() => {
    let mounted = true;
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
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
    <div className={`rounded-2xl border backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)] overflow-hidden ${
      isLong ? "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0.015))]" :
      isShort ? "border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.06),rgba(255,255,255,0.015))]" :
      "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))]"
    }`}>
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Live Trading Signal</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-white/30">Pair</label>
            <div className="relative">
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="appearance-none rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-8 py-1.5 text-[10px] font-semibold text-white/80 outline-none focus:border-primary/40"
              >
                {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
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
                <h2 className={`text-3xl font-extrabold tracking-tight leading-none ${
                  isLong ? "text-emerald-300" : isShort ? "text-red-300" : "text-white/70"
                }`}>
                  {signal.pair}
                </h2>
                <span className={`mb-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${ASSET_CLASS_STYLE[signal.assetClass] ?? ASSET_CLASS_STYLE.forex}`}>
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
          <div className="h-28 rounded-xl bg-white/[0.02] animate-pulse" />
        ) : !isActive ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/45 flex items-start gap-2">
            <BadgeAlert className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
            <div>
              <p className="font-medium text-white/80">No valid setup{signal?.pair ? ` for ${signal.pair}` : ""}</p>
              <p className="text-xs mt-1">{signal?.aiExplanation}</p>
            </div>
          </div>
        ) : signal ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Entry Zone</p>
                <p className="text-sm font-semibold text-white/90">{signal.entryZone ? `${fmt(signal.entryZone.low)} – ${fmt(signal.entryZone.high)}` : "—"}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Stop Loss</p>
                <p className="text-sm font-semibold text-red-400">{signal.stopLoss ? fmt(signal.stopLoss) : "—"}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">R : R</p>
                <p className="text-sm font-semibold text-white/90">{signal.riskReward ?? "—"}</p>
              </div>
            </div>

            <div>
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

            <div className="grid grid-cols-3 gap-2">
              {signal.takeProfits.slice(0, 3).map((tp, i) => (
                <div key={i} className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">TP {i + 1}</p>
                  <p className="text-sm font-semibold text-emerald-400">{fmt(tp)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex items-start gap-2">
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
