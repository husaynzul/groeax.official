import { useState, useMemo } from "react";
import { calcNetProfit, calcNetLoss, calcRR, calcProfitPips, calcLossPips, calcPipValue, getPipConfig } from "@/engine/riskEngine";
import { parseBrokerPrice } from "@/utils/priceParser";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";

const PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "US30", "NAS100",
];

function sanitizePriceInput(value: string): string {
  return value.replace(/[^0-9.,\-]/g, "");
}

export default function Calculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [lot, setLot] = useState("0.1");

  const e = parseBrokerPrice(entry);
  const s = parseBrokerPrice(sl);
  const t = parseBrokerPrice(tp);
  const l = parseBrokerPrice(lot);
  const valid = e > 0 && s > 0 && t > 0 && l > 0;

  const cfg = useMemo(() => getPipConfig(pair), [pair]);

  const netProfit = valid ? calcNetProfit(e, t, l, pair) : 0;
  const netLoss   = valid ? calcNetLoss(e, s, l, pair)   : 0;
  const rr        = valid ? calcRR(netProfit, netLoss)    : 0;
  const profitPips = valid ? calcProfitPips(e, t, pair)  : 0;
  const lossPips   = valid ? calcLossPips(e, s, pair)    : 0;
  const pipVal     = valid ? calcPipValue(l, pair)       : 0;

  const rrPct = Math.min((rr / 5) * 100, 100);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  const inputClass =
    "w-full bg-card border border-input rounded-lg px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Risk Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">Live position sizing and risk analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Inputs ── */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inputs</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Pair</label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className={inputClass}
                data-testid="select-calc-pair"
              >
                {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {[
              { label: "Entry Price",  value: entry, set: setEntry, ph: pair.includes("JPY") ? "149.500" : pair === "XAU/USD" ? "2,345.50" : "1.08500" },
              { label: "Stop Loss",    value: sl,    set: setSl,    ph: pair.includes("JPY") ? "148.200" : pair === "XAU/USD" ? "2,320.00" : "1.08200" },
              { label: "Take Profit",  value: tp,    set: setTp,    ph: pair.includes("JPY") ? "152.000" : pair === "XAU/USD" ? "2,400.00" : "1.09100" },
              { label: "Lot Size",     value: lot,   set: setLot,   ph: "0.10" },
            ].map(({ label, value, set, ph }) => (
              <div key={label}>
                <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={ph}
                  value={value}
                  onChange={(e) => set(sanitizePriceInput(e.target.value))}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div className="pt-2 text-xs text-muted-foreground space-y-1 border-t border-border">
            <p>Pip size: {cfg.pipSize} &nbsp;|&nbsp; Pip value/lot: ${cfg.pipValue}</p>
          </div>
        </div>

        {/* ── Results ── */}
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
                <span className="text-xs text-muted-foreground">Pips to TP</span>
              </div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-calc-profit-pips">
                {valid ? profitPips.toFixed(1) : "—"}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-muted-foreground">Pips to SL</span>
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
                <span className="text-muted-foreground">Pip Value / lot</span>
                <p className="font-semibold text-foreground mt-0.5">{valid ? `$${pipVal.toFixed(2)}` : "—"}</p>
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
