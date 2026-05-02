import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, ToggleLeft, ToggleRight, Zap, AlertCircle } from "lucide-react";

export interface PlacedOrder {
  direction: "BUY" | "SELL";
  orderType: "Market" | "Limit" | "Stop";
  lotSize: number;
  entryPrice: number;
  sl: number | null;
  tp: number | null;
}

interface Props {
  currentPrice: number;
  pair: string;
  decimals: number;
  onOrder: (order: PlacedOrder) => void;
}

/* ── Spread simulation ─────────────────────────────────────────────── */
function spread(price: number): number {
  if (price > 10000) return price * 0.0002;
  if (price > 100)   return price * 0.0004;
  return price * 0.001;
}

/* ── Pip helpers ───────────────────────────────────────────────────── */
function getPipSize(pair: string, price: number): number {
  if (pair.includes("JPY")) return 0.01;
  if (price > 1000) return 1;
  if (price > 10)   return 0.01;
  return 0.0001;
}

function getPipValueUSD(pair: string, price: number, lotSize: number): number {
  const pip = getPipSize(pair, price);
  if (price > 1000) return pip * lotSize;          // Crypto: 1 unit per coin per pip
  if (pair.endsWith("USD")) return 10 * lotSize;   // Standard forex
  return 10 * lotSize;                             // Approx for crosses
}

/* ── Input helpers ─────────────────────────────────────────────────── */
function NumInput({
  label, value, onChange, decimals, className = "",
}: {
  label: string; value: string; onChange: (v: string) => void; decimals: number; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        step={1 / Math.pow(10, decimals)}
        className="w-full bg-secondary/60 border border-border rounded-lg px-2.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 focus:bg-secondary text-right"
      />
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
      {on
        ? <ToggleRight className="w-4 h-4 text-primary" />
        : <ToggleLeft  className="w-4 h-4" />}
    </button>
  );
}

export default function OrderPanel({ currentPrice, pair, decimals, onOrder }: Props) {
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"Market" | "Limit" | "Stop">("Market");
  const [lotStr,    setLotStr]    = useState("0.10");
  const [entryStr,  setEntryStr]  = useState("");
  const [slStr,     setSlStr]     = useState("");
  const [tpStr,     setTpStr]     = useState("");
  const [slOn, setSlOn]           = useState(true);
  const [tpOn, setTpOn]           = useState(true);

  /* auto-fill entry when price updates & market order selected */
  useEffect(() => {
    if (orderType !== "Market" || !currentPrice) return;
    const sp   = spread(currentPrice);
    const fill = direction === "BUY" ? currentPrice + sp : currentPrice - sp;
    setEntryStr(fill.toFixed(decimals));
  }, [currentPrice, direction, orderType, decimals]);

  /* auto-suggest SL/TP when entry changes */
  useEffect(() => {
    const entry = parseFloat(entryStr);
    if (!entry || !currentPrice) return;
    const pip = getPipSize(pair, entry);
    const dist = pip * 50;
    if (!slStr) setSlStr((entry - (direction === "BUY" ? dist : -dist)).toFixed(decimals));
    if (!tpStr) setTpStr((entry + (direction === "BUY" ? dist * 2 : -dist * 2)).toFixed(decimals));
  }, [entryStr]); // eslint-disable-line

  const entry   = parseFloat(entryStr)   || 0;
  const sl      = slOn ? (parseFloat(slStr)   || null) : null;
  const tp      = tpOn ? (parseFloat(tpStr)   || null) : null;
  const lotSize = parseFloat(lotStr)     || 0.01;

  const pip = getPipSize(pair, entry || currentPrice);
  const pipValUSD = getPipValueUSD(pair, entry || currentPrice, lotSize);

  const slPips    = sl && entry ? Math.abs(entry - sl) / pip : 0;
  const tpPips    = tp && entry ? Math.abs(tp - entry) / pip : 0;
  const riskUSD   = slPips > 0 ? (slPips * pipValUSD) / 10 : 0;
  const rewardUSD = tpPips > 0 ? (tpPips * pipValUSD) / 10 : 0;
  const rr        = slPips > 0 && tpPips > 0 ? tpPips / slPips : 0;

  const ask = currentPrice > 0 ? (currentPrice + spread(currentPrice)).toFixed(decimals) : "—";
  const bid = currentPrice > 0 ? (currentPrice - spread(currentPrice)).toFixed(decimals) : "—";

  const handlePlace = useCallback(() => {
    if (!entry || lotSize <= 0) return;
    onOrder({ direction, orderType, lotSize, entryPrice: entry, sl, tp });
    // reset SL/TP strings so they get recalculated next time
    setSlStr("");
    setTpStr("");
  }, [direction, orderType, lotSize, entry, sl, tp, onOrder]);

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {/* Price ticker */}
      <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border px-3 py-2">
        <span className="text-[10px] font-mono text-muted-foreground">{pair}</span>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-red-400 font-mono">BID {bid}</span>
          <span className="text-[10px] text-emerald-400 font-mono">ASK {ask}</span>
        </div>
      </div>

      {/* Direction tabs */}
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary/60 border border-border rounded-xl">
        <button onClick={() => setDirection("BUY")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            direction === "BUY"
              ? "bg-emerald-500 text-white shadow-md"
              : "text-muted-foreground hover:text-emerald-400"
          }`}>
          <TrendingUp className="w-3.5 h-3.5" />
          BUY
        </button>
        <button onClick={() => setDirection("SELL")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            direction === "SELL"
              ? "bg-red-500 text-white shadow-md"
              : "text-muted-foreground hover:text-red-400"
          }`}>
          <TrendingDown className="w-3.5 h-3.5" />
          SELL
        </button>
      </div>

      {/* Order type */}
      <div className="flex gap-0.5 p-0.5 bg-secondary/40 border border-border rounded-lg">
        {(["Market", "Limit", "Stop"] as const).map(t => (
          <button key={t} onClick={() => setOrderType(t)}
            className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all ${
              orderType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Lot size + Entry */}
      <NumInput label="Volume (lots / units)" value={lotStr} onChange={setLotStr} decimals={2} />
      {orderType !== "Market" && (
        <NumInput label="Entry Price" value={entryStr} onChange={setEntryStr} decimals={decimals} />
      )}

      {/* Stop Loss */}
      <div className="rounded-xl border border-border bg-red-500/5 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Stop Loss</span>
          <Toggle on={slOn} onToggle={() => setSlOn(!slOn)} />
        </div>
        {slOn && (
          <>
            <input type="number" value={slStr} onChange={e => setSlStr(e.target.value)}
              step={1 / Math.pow(10, decimals)}
              className="w-full bg-secondary/60 border border-border rounded-lg px-2.5 py-2 text-xs font-mono text-red-400 focus:outline-none focus:border-red-500/50 text-right" />
            {slPips > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{slPips.toFixed(1)} pips</span>
                <span className="text-red-400/80">Risk ~${riskUSD.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Take Profit */}
      <div className="rounded-xl border border-border bg-emerald-500/5 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Take Profit</span>
          <Toggle on={tpOn} onToggle={() => setTpOn(!tpOn)} />
        </div>
        {tpOn && (
          <>
            <input type="number" value={tpStr} onChange={e => setTpStr(e.target.value)}
              step={1 / Math.pow(10, decimals)}
              className="w-full bg-secondary/60 border border-border rounded-lg px-2.5 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50 text-right" />
            {tpPips > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{tpPips.toFixed(1)} pips</span>
                <span className="text-emerald-400/80">Reward ~${rewardUSD.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* R:R summary */}
      {rr > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 border border-border px-3 py-2">
          <span className="text-[10px] text-muted-foreground">Risk : Reward</span>
          <span className={`text-xs font-bold ${rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-yellow-400" : "text-red-400"}`}>
            1 : {rr.toFixed(2)}
          </span>
        </div>
      )}

      {/* Validation */}
      {!entry && (
        <div className="flex items-center gap-1.5 text-[10px] text-yellow-500">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Waiting for price…
        </div>
      )}

      {/* Place order */}
      <button
        onClick={handlePlace}
        disabled={!entry || lotSize <= 0}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all disabled:opacity-40 ${
          direction === "BUY"
            ? "bg-emerald-500 hover:bg-emerald-400 active:scale-95"
            : "bg-red-500 hover:bg-red-400 active:scale-95"
        }`}>
        <Zap className="w-4 h-4" />
        {direction === "BUY" ? "Place BUY" : "Place SELL"} @ {entryStr || "—"}
      </button>

      <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
        Orders are recorded in your journal. No real execution.
      </p>
    </div>
  );
}
