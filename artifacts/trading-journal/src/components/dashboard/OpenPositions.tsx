import { useMemo } from "react";
import { Link } from "wouter";
import { useTradeStore } from "@/store/tradeStore";
import { TrendingUp, TrendingDown, Activity, ArrowRight } from "lucide-react";

export default function OpenPositions() {
  const { trades } = useTradeStore();

  const openTrades = useMemo(() => trades.filter((t) => !t.outcome).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6), [trades]);

  if (openTrades.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] backdrop-blur-xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-white/90">Open Positions</h3>
          <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{openTrades.length}</span>
        </div>
        <Link href="/trades" className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/70 transition-colors">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-white/6">
        {openTrades.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
            <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${t.direction === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {t.direction === "BUY" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm font-mono text-white/90">{t.pair}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${t.direction === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{t.direction}</span>
                <span className="text-[10px] text-white/35">× {t.lotSize}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/35 font-mono">Entry {t.entryPrice.toFixed(t.entryPrice > 100 ? 2 : 5)}</span>
                {t.stopLoss > 0 && <span className="text-[10px] text-red-400/70 font-mono">SL {t.stopLoss.toFixed(t.stopLoss > 100 ? 2 : 5)}</span>}
                {t.takeProfit > 0 && <span className="text-[10px] text-emerald-400/70 font-mono">TP {t.takeProfit.toFixed(t.takeProfit > 100 ? 2 : 5)}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-white/35">{new Date(t.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" /></span>
                <span className="text-[9px] text-primary font-medium">Open</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
