import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Trade } from "@/types";
import { fmtTradeDate } from "@/lib/dateUtils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BookOpen,
  Tag,
  Hash,
  Calendar,
  ArrowUpDown,
  Edit2,
  Trash2,
} from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

interface Props {
  trade: Trade | null;
  open: boolean;
  onClose: () => void;
  onEdit: (t: Trade) => void;
  onDelete: (id: string) => void;
}

function PriceRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}

function StatBadge({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex-1 bg-secondary/40 rounded-xl p-3 min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground truncate">{value}</p>
      {sub && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {sub}
        </p>
      )}
    </div>
  );
}

export default function TradeDetailDrawer({
  trade,
  open,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  if (!trade) return null;

  const isWin = trade.outcome === "WIN";
  const isLoss = trade.outcome === "LOSS";
  const isBE = trade.outcome === "BE";

  const pnl = isWin
    ? trade.netProfit
    : isLoss
    ? -trade.netLoss
    : 0;

  const outcomeColor = isWin
    ? "text-emerald-400"
    : isLoss
    ? "text-red-400"
    : "text-muted-foreground";

  const outcomeBg = isWin
    ? "bg-emerald-500/15 border-emerald-500/30"
    : isLoss
    ? "bg-red-500/15 border-red-500/30"
    : "bg-muted/20 border-border";

  const pnlLabel = isWin
    ? `+${fmtMoney(trade.netProfit)}`
    : isLoss
    ? `-${fmtMoney(trade.netLoss)}`
    : "Breakeven";

  const rrColor =
    trade.rr >= 2
      ? "text-emerald-400"
      : trade.rr >= 1
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[hsl(var(--card))] border-border overflow-y-auto p-0"
      >
        {/* ── Header ─────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between pr-6">
            <div>
              <SheetTitle className="text-xl font-bold tracking-tight">
                {trade.pair}
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {fmtTradeDate(trade.date, "EEEE, MMM d yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  trade.direction === "BUY"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/15 text-red-400 border-red-500/30"
                }`}
              >
                {trade.direction}
              </span>
            </div>
          </div>
        </SheetHeader>

        <div className="px-5 py-4 space-y-5">
          {/* ── P&L card ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className={`rounded-2xl border p-4 flex items-center justify-between ${outcomeBg}`}
          >
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Net P&L
              </p>
              <p className={`text-3xl font-black tabular-nums ${outcomeColor}`}>
                {pnlLabel}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${outcomeBg}`}>
              {isWin ? (
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              ) : isLoss ? (
                <TrendingDown className="w-6 h-6 text-red-400" />
              ) : (
                <Target className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
          </motion.div>

          {/* ── Stats row ─────────────────────────── */}
          <div className="flex gap-2">
            <StatBadge
              label="R:R"
              value={`${trade.rr.toFixed(2)}R`}
              sub={
                trade.rr >= 2
                  ? "Excellent"
                  : trade.rr >= 1
                  ? "Good"
                  : "Below 1:1"
              }
            />
            <StatBadge
              label="Lot Size"
              value={String(trade.lotSize)}
              sub="lots"
            />
            <StatBadge
              label="Result"
              value={trade.outcome ?? "—"}
              sub={
                isWin ? "Trade won" : isLoss ? "Trade lost" : "Breakeven"
              }
            />
          </div>

          {/* ── Price levels ─────────────────────── */}
          <div className="rounded-xl border border-border bg-secondary/20 px-4 py-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider py-2.5 border-b border-border/40">
              Price Levels
            </p>
            <PriceRow
              label="Entry Price"
              value={trade.entryPrice}
              color="text-foreground"
            />
            <PriceRow
              label="Stop Loss"
              value={trade.stopLoss}
              color="text-red-400"
            />
            <PriceRow
              label="Take Profit"
              value={trade.takeProfit}
              color="text-emerald-400"
            />

            {/* Visual SL/TP bar */}
            <div className="py-3">
              <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                {/* risk zone */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-red-500/60"
                  style={{
                    width: `${Math.min(
                      (Math.abs(trade.entryPrice - trade.stopLoss) /
                        Math.abs(trade.takeProfit - trade.stopLoss)) *
                        100,
                      100
                    )}%`,
                  }}
                />
                {/* reward zone */}
                <div
                  className="absolute right-0 top-0 h-full rounded-full bg-emerald-500/60"
                  style={{
                    width: `${Math.min(
                      (Math.abs(trade.takeProfit - trade.entryPrice) /
                        Math.abs(trade.takeProfit - trade.stopLoss)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-red-400">SL</span>
                <span className="text-[9px] text-muted-foreground">Entry</span>
                <span className="text-[9px] text-emerald-400">TP</span>
              </div>
            </div>
          </div>

          {/* ── Strategy & Patterns ──────────────── */}
          {(trade.strategy || (trade.patterns && trade.patterns.length > 0)) && (
            <div className="space-y-3">
              {trade.strategy && (
                <div className="flex items-start gap-2.5">
                  <Tag className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                      Strategy
                    </p>
                    <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 text-xs font-medium px-2.5 py-1 rounded-full">
                      {trade.strategy}
                    </span>
                  </div>
                </div>
              )}

              {trade.patterns && trade.patterns.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Hash className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                      Patterns
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {trade.patterns.map((p) => (
                        <span
                          key={p}
                          className="bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes ────────────────────────────── */}
          {trade.notes && (
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Notes
                </p>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {trade.notes}
              </p>
            </div>
          )}

          {/* ── Actions ──────────────────────────── */}
          <div className="flex gap-3 pt-1 pb-6">
            <button
              onClick={() => { onClose(); onEdit(trade); }}
              className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium py-2.5 rounded-xl transition-colors border border-border"
            >
              <Edit2 className="w-4 h-4" />
              Edit Trade
            </button>
            <button
              onClick={() => { onDelete(trade.id); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium py-2.5 rounded-xl transition-colors border border-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
