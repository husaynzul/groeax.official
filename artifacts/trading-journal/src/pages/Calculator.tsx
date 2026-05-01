import { useState } from "react";
import { calcNetProfit, calcNetLoss, calcRR, calcProfitPips, calcLossPips, calcPipValue, PIP_SIZE, PIP_VALUE_PER_LOT } from "@/engine/riskEngine";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";

export default function Calculator() {
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [lot, setLot] = useState("0.1");

  const e = parseFloat(entry);
  const s = parseFloat(sl);
  const t = parseFloat(tp);
  const l = parseFloat(lot);
  const valid = !isNaN(e) && !isNaN(s) && !isNaN(t) && !isNaN(l) && e > 0 && s > 0 && t > 0 && l > 0;

  const netProfit = valid ? calcNetProfit(e, t, l) : 0;
  const netLoss = valid ? calcNetLoss(e, s, l) : 0;
  const rr = valid ? calcRR(netProfit, netLoss) : 0;
  const profitPips = valid ? calcProfitPips(e, t) : 0;
  const lossPips = valid ? calcLossPips(e, s) : 0;
  const pipVal = valid ? calcPipValue(l) : 0;

  const rrPct = Math.min((rr / 5) * 100, 100);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  const inputClass =
    "w-full bg-card border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Risk Calculator</h1>
        <p className="text-sm text-muted-foreground mt-1">Live position sizing and risk analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Inputs</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Entry Price</label>
              <input
                type="number"
                step="0.00001"
                placeholder="1.08500"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                className={inputClass}
                data-testid="input-calc-entry"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Stop Loss</label>
              <input
                type="number"
                step="0.00001"
                placeholder="1.08200"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                className={inputClass}
                data-testid="input-calc-sl"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Take Profit</label>
              <input
                type="number"
                step="0.00001"
                placeholder="1.09100"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                className={inputClass}
                data-testid="input-calc-tp"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Lot Size</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.10"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                className={inputClass}
                data-testid="input-calc-lot"
              />
            </div>
          </div>

          <div className="pt-2 text-xs text-muted-foreground space-y-1 border-t border-border">
            <p>Pip size: {PIP_SIZE} &nbsp;|&nbsp; Pip value/lot: ${PIP_VALUE_PER_LOT}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground">Net Profit</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400" data-testid="text-calc-profit">
                {valid ? fmtMoney(netProfit) : "—"}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground">Net Loss</span>
              </div>
              <p className="text-2xl font-bold text-red-400" data-testid="text-calc-loss">
                {valid ? fmtMoney(netLoss) : "—"}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Pip Distance (TP)</span>
              </div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-calc-profit-pips">
                {valid ? profitPips.toFixed(1) : "—"}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-muted-foreground">Pip Distance (SL)</span>
              </div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-calc-loss-pips">
                {valid ? lossPips.toFixed(1) : "—"}
              </p>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Risk / Reward Ratio</span>
              <span className="text-2xl font-bold text-foreground" data-testid="text-calc-rr">
                {valid ? `${rr.toFixed(2)}R` : "—"}
              </span>
            </div>

            <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${rrPct}%`,
                  background: rr >= 2 ? "#10b981" : rr >= 1 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">0R</span>
              <span className="text-xs text-muted-foreground">2R</span>
              <span className="text-xs text-muted-foreground">5R+</span>
            </div>

            <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Pip Value</span>
                <p className="font-semibold text-foreground mt-0.5">{valid ? `$${pipVal.toFixed(2)}/pip` : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assessment</span>
                <p className={`font-semibold mt-0.5 ${rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                  {!valid ? "—" : rr >= 2 ? "Strong Setup" : rr >= 1 ? "Acceptable" : "Poor R:R"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
