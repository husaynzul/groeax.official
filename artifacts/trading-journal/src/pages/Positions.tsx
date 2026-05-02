import { useMemo, useEffect, useState, useCallback } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { extractOpenPositions, type OpenPosition } from "@/engine/pnlEngine";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtTradeDate } from "@/lib/dateUtils";

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

function PnLBadge({
  value,
  pct,
}: {
  value: number | null;
  pct: number | null;
}) {
  if (value === null)
    return (
      <span className="text-muted-foreground text-sm">Fetching price…</span>
    );
  const pos = value >= 0;
  return (
    <div className={cn("flex flex-col items-end", pos ? "text-emerald-400" : "text-red-400")}>
      <span className="font-semibold text-sm">
        {pos ? "+" : ""}${fmt(value)}
      </span>
      <span className="text-xs opacity-80">
        {pos ? "+" : ""}
        {fmt(pct)}%
      </span>
    </div>
  );
}

export default function Positions() {
  const trades = useTradeStore((s) => s.trades);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const openPositions = useMemo(
    () => extractOpenPositions(trades),
    [trades]
  );

  const fetchPrices = useCallback(async () => {
    if (openPositions.length === 0) return;
    setLoading(true);
    try {
      const symbols = [...new Set(openPositions.map((p) => p.pair))];
      const r = await fetch(
        `/api/prices?symbols=${symbols.join(",")}`
      );
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
              <span
                className={cn(
                  "ml-3 font-semibold",
                  totalUnrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {totalUnrealisedPnL >= 0 ? "+" : ""}${fmt(totalUnrealisedPnL)}{" "}
                unrealised
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
            <RefreshCw
              className={cn("w-3.5 h-3.5", loading && "animate-spin")}
            />
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
              <PositionCard key={`${row.pair}-${row.direction}`} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PositionCard({ row }: { row: PositionRow }) {
  const isLong = row.direction === "LONG";
  const pnlPositive =
    row.unrealisedPnL !== null && row.unrealisedPnL >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-border/70 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left: symbol + direction */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full text-white shrink-0",
              isLong ? "bg-emerald-500/20" : "bg-red-500/20"
            )}
          >
            {isLong ? (
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wide">
                {row.pair}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  isLong
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                )}
              >
                {row.direction}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Opened {fmtTradeDate(row.openDate)} ·{" "}
              {row.tradeIds.length}{" "}
              {row.tradeIds.length === 1 ? "fill" : "fills"}
            </span>
          </div>
        </div>

        {/* Right: unrealised P&L */}
        <PnLBadge value={row.unrealisedPnL} pct={row.unrealisedPct} />
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Qty" value={row.totalQty.toString()} />
        <Stat
          label="Avg Entry"
          value={fmtPrice(row.avgEntryPrice, row.pair)}
        />
        <Stat
          label="Current Price"
          value={fmtPrice(row.currentPrice, row.pair)}
          loading={row.currentPrice === null}
        />
        <Stat
          label="Notional Value"
          value={row.notionalValue !== null ? `$${fmt(row.notionalValue)}` : "—"}
          highlight={
            row.unrealisedPnL !== null
              ? pnlPositive
                ? "green"
                : "red"
              : undefined
          }
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: string;
  loading?: boolean;
  highlight?: "green" | "red";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          loading && "animate-pulse text-muted-foreground",
          highlight === "green" && "text-emerald-400",
          highlight === "red" && "text-red-400"
        )}
      >
        {loading ? "…" : value}
      </span>
    </div>
  );
}
