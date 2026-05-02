import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { extractOpenPositions, type OpenPosition } from "@/engine/pnlEngine";
import { usePnLRecalculator } from "@/hooks/usePnLRecalculator";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtTradeDate } from "@/lib/dateUtils";
import type { Trade } from "@/types";

interface PositionRow extends OpenPosition {
  currentPrice: number | null;
  unrealisedPnL: number | null;
  unrealisedPct: number | null;
  notionalValue: number | null;
}

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPrice(n: number | null, pair: string): string {
  if (n === null) return "—";
  const isCrypto = ["USDT", "USDC", "BTC"].some((s) => pair.endsWith(s));
  const decimals = isCrypto && n > 100 ? 2 : isCrypto ? 6 : 5;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function PnLBadge({ value, pct }: { value: number | null; pct: number | null }) {
  if (value === null)
    return <span className="text-muted-foreground text-sm">Fetching…</span>;
  const pos = value >= 0;
  return (
    <div className={cn("flex flex-col items-end", pos ? "text-emerald-400" : "text-red-400")}>
      <span className="font-semibold text-sm">{pos ? "+" : ""}${fmt(value)}</span>
      <span className="text-xs opacity-80">{pos ? "+" : ""}{fmt(pct)}%</span>
    </div>
  );
}

function Stat({
  label, value, loading, highlight,
}: {
  label: string; value: string; loading?: boolean; highlight?: "green" | "red";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        "text-sm font-medium",
        loading && "animate-pulse text-muted-foreground",
        highlight === "green" && "text-emerald-400",
        highlight === "red" && "text-red-400",
      )}>
        {loading ? "…" : value}
      </span>
    </div>
  );
}

/* ── Close Position Modal ─────────────────────────────────────────── */
function ClosePositionModal({
  row,
  onClose,
  onConfirm,
}: {
  row: PositionRow;
  onClose: () => void;
  onConfirm: (closePrice: number, closeDate: string, notes: string) => void;
}) {
  const isLong = row.direction === "LONG";
  const nowDate = new Date().toISOString().slice(0, 10);
  const [closePrice, setClosePrice] = useState(
    row.currentPrice !== null ? String(row.currentPrice) : ""
  );
  const [closeDate, setCloseDate] = useState(nowDate);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsedPrice = parseFloat(closePrice);
  const validPrice = !isNaN(parsedPrice) && parsedPrice > 0;

  const estPnL = useMemo(() => {
    if (!validPrice) return null;
    const raw = isLong
      ? (parsedPrice - row.avgEntryPrice) * row.totalQty
      : (row.avgEntryPrice - parsedPrice) * row.totalQty;
    return raw;
  }, [parsedPrice, row, isLong, validPrice]);

  const handleSubmit = async () => {
    if (!validPrice) return;
    setSubmitting(true);
    try {
      await onConfirm(parsedPrice, closeDate, notes);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Close{" "}
            <span className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              isLong ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            )}>
              {row.direction}
            </span>{" "}
            <span className="font-bold">{row.pair}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="rounded-lg bg-muted/40 p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Quantity</p>
              <p className="font-medium">{row.totalQty}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Entry</p>
              <p className="font-medium">{fmtPrice(row.avgEntryPrice, row.pair)}</p>
            </div>
          </div>

          {/* Close Price */}
          <div className="space-y-1.5">
            <Label htmlFor="closePrice">Close Price</Label>
            <Input
              id="closePrice"
              type="number"
              step="any"
              placeholder="Enter close price…"
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value)}
              autoFocus
            />
            {row.currentPrice !== null && (
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setClosePrice(String(row.currentPrice))}
              >
                Use market price ({fmtPrice(row.currentPrice, row.pair)})
              </button>
            )}
          </div>

          {/* Close Date */}
          <div className="space-y-1.5">
            <Label htmlFor="closeDate">Close Date</Label>
            <Input
              id="closeDate"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="closeNotes">Notes (optional)</Label>
            <Textarea
              id="closeNotes"
              rows={2}
              placeholder="Exit reason, observations…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Estimated P&L */}
          {estPnL !== null && (
            <div className={cn(
              "rounded-lg p-3 flex items-center justify-between text-sm font-medium",
              estPnL >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              <span>Estimated realised P&amp;L</span>
              <span className="text-base font-bold">
                {estPnL >= 0 ? "+" : ""}${fmt(estPnL)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!validPrice || !closeDate || submitting}
            className={cn(isLong ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600")}
          >
            {submitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Close {isLong ? "SELL" : "BUY"} @ {validPrice ? fmtPrice(parsedPrice, row.pair) : "…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Position Card ────────────────────────────────────────────────── */
function PositionCard({
  row,
  onCloseClick,
}: {
  row: PositionRow;
  onCloseClick: (row: PositionRow) => void;
}) {
  const isLong = row.direction === "LONG";
  const pnlPositive = row.unrealisedPnL !== null && row.unrealisedPnL >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-border/70 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left: symbol + direction */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
            isLong ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {isLong
              ? <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              : <ArrowDownRight className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wide">{row.pair}</span>
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                isLong ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              )}>
                {row.direction}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Opened {fmtTradeDate(row.openDate)} · {row.tradeIds.length}{" "}
              {row.tradeIds.length === 1 ? "fill" : "fills"}
            </span>
          </div>
        </div>

        {/* Right: P&L + close button */}
        <div className="flex items-center gap-3 shrink-0">
          <PnLBadge value={row.unrealisedPnL} pct={row.unrealisedPct} />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/60"
            onClick={() => onCloseClick(row)}
          >
            <X className="w-3.5 h-3.5" />
            Close
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Qty" value={row.totalQty.toString()} />
        <Stat label="Avg Entry" value={fmtPrice(row.avgEntryPrice, row.pair)} />
        <Stat
          label="Current Price"
          value={fmtPrice(row.currentPrice, row.pair)}
          loading={row.currentPrice === null}
        />
        <Stat
          label="Notional Value"
          value={row.notionalValue !== null ? `$${fmt(row.notionalValue)}` : "—"}
          highlight={row.unrealisedPnL !== null ? (pnlPositive ? "green" : "red") : undefined}
        />
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function Positions() {
  const trades = useTradeStore((s) => s.trades);
  const { addTrade } = useTradeStore();
  const { recalculate: recalcPnL } = usePnLRecalculator();

  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [closingRow, setClosingRow] = useState<PositionRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; win: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPositions = useMemo(() => extractOpenPositions(trades), [trades]);

  const fetchPrices = useCallback(async () => {
    if (openPositions.length === 0) return;
    setLoading(true);
    try {
      const symbols = [...new Set(openPositions.map((p) => p.pair))];
      const r = await fetch(`/api/prices?symbols=${symbols.join(",")}`);
      if (r.ok) {
        const d = (await r.json()) as { prices: Record<string, number | null> };
        setPrices(d.prices);
        setLastRefresh(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }, [openPositions]);

  useEffect(() => {
    void fetchPrices();
    const timer = setInterval(() => void fetchPrices(), 30_000);
    return () => clearInterval(timer);
  }, [fetchPrices]);

  const rows: PositionRow[] = useMemo(() => {
    return openPositions.map((pos) => {
      const currentPrice = prices[pos.pair] ?? null;
      let unrealisedPnL: number | null = null;
      let unrealisedPct: number | null = null;
      let notionalValue: number | null = null;
      if (currentPrice !== null) {
        const cost = pos.avgEntryPrice * pos.totalQty;
        notionalValue = currentPrice * pos.totalQty;
        unrealisedPnL =
          pos.direction === "LONG"
            ? (currentPrice - pos.avgEntryPrice) * pos.totalQty
            : (pos.avgEntryPrice - currentPrice) * pos.totalQty;
        unrealisedPct = cost > 0 ? (unrealisedPnL / cost) * 100 : null;
      }
      return { ...pos, currentPrice, unrealisedPnL, unrealisedPct, notionalValue };
    });
  }, [openPositions, prices]);

  const totalUnrealisedPnL = rows.reduce(
    (sum, r) => (r.unrealisedPnL !== null ? sum + r.unrealisedPnL : sum),
    0
  );
  const hasAnyPrice = rows.some((r) => r.unrealisedPnL !== null);

  const showToast = useCallback((msg: string, win: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, win });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleConfirmClose = useCallback(
    async (closePrice: number, closeDate: string, notes: string) => {
      if (!closingRow) return;

      const counterDirection = closingRow.direction === "LONG" ? "SELL" : "BUY";
      const estPnL =
        closingRow.direction === "LONG"
          ? (closePrice - closingRow.avgEntryPrice) * closingRow.totalQty
          : (closingRow.avgEntryPrice - closePrice) * closingRow.totalQty;

      const closeTrade: Trade = {
        id: crypto.randomUUID(),
        pair: closingRow.pair,
        direction: counterDirection,
        entryPrice: closePrice,
        stopLoss: 0,
        takeProfit: 0,
        lotSize: closingRow.totalQty,
        date: closeDate,
        notes: notes || `Closed ${closingRow.direction} position @ ${closePrice}`,
        outcome: estPnL > 0 ? "WIN" : estPnL < 0 ? "LOSS" : "BE",
        netProfit: estPnL > 0 ? estPnL : 0,
        netLoss: estPnL < 0 ? Math.abs(estPnL) : 0,
        rr: 0,
      };

      addTrade(closeTrade);
      setClosingRow(null);

      await recalcPnL();

      showToast(
        `${closingRow.pair} closed · ${estPnL >= 0 ? "+" : ""}$${estPnL.toFixed(2)}`,
        estPnL >= 0
      );
    },
    [closingRow, addTrade, recalcPnL, showToast]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">Open Positions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openPositions.length} open{" "}
            {openPositions.length === 1 ? "position" : "positions"}
            {hasAnyPrice && (
              <span className={cn(
                "ml-3 font-semibold",
                totalUnrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {totalUnrealisedPnL >= 0 ? "+" : ""}${fmt(totalUnrealisedPnL)} unrealised
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchPrices()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh Prices
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {openPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Layers className="w-12 h-12 opacity-20" />
            <p className="text-sm">
              No open positions found. Import trades via the Brokers page or add
              fills manually in Trades.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <PositionCard
                key={`${row.pair}-${row.direction}`}
                row={row}
                onCloseClick={setClosingRow}
              />
            ))}
          </div>
        )}
      </div>

      {/* Close modal */}
      {closingRow && (
        <ClosePositionModal
          row={closingRow}
          onClose={() => setClosingRow(null)}
          onConfirm={handleConfirmClose}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white",
          toast.win ? "bg-emerald-600" : "bg-red-600"
        )}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
