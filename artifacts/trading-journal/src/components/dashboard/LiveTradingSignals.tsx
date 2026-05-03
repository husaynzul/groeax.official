import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Shield, Radar, BadgeAlert } from "lucide-react";

interface TradingSignal {
  signalType: "LONG" | "SHORT" | "NO_TRADE";
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  takeProfits: number[];
  confidenceScore: number;
  riskReward: number | null;
  aiExplanation: string;
  source: "SMC_SIGNAL_ENGINE";
}

function fmt(n: number) {
  return n.toFixed(n > 100 ? 2 : 4);
}

export default function LiveTradingSignals() {
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const load = async () => {
      try {
        const res = await fetch(`${base}/api/trading-signal`);
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
  }, []);

  return (
    <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] backdrop-blur-xl p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Live Trading Signals</h3>
        </div>
        {signal && signal.signalType !== "NO_TRADE" ? (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${signal.signalType === "LONG" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"}`}>
            {signal.signalType}
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-white/[0.03] text-white/35 border-white/8">NO_TRADE</span>
        )}
      </div>

      {loading && !signal ? (
        <div className="h-28 rounded-xl bg-white/[0.02] animate-pulse" />
      ) : signal?.signalType === "NO_TRADE" ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/45 flex items-start gap-2">
          <BadgeAlert className="w-4 h-4 mt-0.5 text-amber-400" />
          <div>
            <p className="font-medium text-white/80">No valid setup</p>
            <p className="text-xs mt-1">{signal.aiExplanation}</p>
          </div>
        </div>
      ) : signal ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Entry Zone</p>
              <p className="text-sm font-semibold text-white/90">{signal.entryZone ? `${fmt(signal.entryZone.low)} - ${fmt(signal.entryZone.high)}` : "—"}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Stop Loss</p>
              <p className="text-sm font-semibold text-red-400">{signal.stopLoss ? fmt(signal.stopLoss) : "—"}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">RR</p>
              <p className="text-sm font-semibold text-white/90">{signal.riskReward ?? "—"}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">Confidence</span>
              <span className="text-[10px] font-bold text-white/60">{signal.confidenceScore}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${signal.signalType === "LONG" ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${signal.confidenceScore}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {signal.takeProfits.slice(0, 3).map((tp, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">TP{i + 1}</p>
                <p className="text-sm font-semibold text-emerald-400">{fmt(tp)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">{signal.aiExplanation}</p>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
