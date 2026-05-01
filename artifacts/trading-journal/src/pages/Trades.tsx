import { useMemo, useState } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import { format } from "date-fns";
import { Plus, Search, Trash2, Edit2, ChevronUp, ChevronDown } from "lucide-react";
import AddTradeModal from "@/components/trades/AddTradeModal";
import { Trade } from "@/types";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);

type SortKey = "date" | "pair" | "direction" | "netProfit" | "rr" | "outcome";
type SortDir = "asc" | "desc";

export default function Trades() {
  const trades = useTradeStore((s) => s.trades);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);
  const clearAll = useTradeStore((s) => s.clearAll);
  const analytics = useMemo(() => computeAnalytics(trades), [trades]);

  const [addOpen, setAddOpen] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [search, setSearch] = useState("");
  const [filterPair, setFilterPair] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmClear, setConfirmClear] = useState(false);

  const allPairs = useMemo(
    () => Array.from(new Set(trades.map((t) => t.pair))).sort(),
    [trades]
  );

  const sorted = useMemo(() => {
    let list = [...trades];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.pair.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
      );
    }
    if (filterPair !== "all") list = list.filter((t) => t.pair === filterPair);
    if (filterDirection !== "all") list = list.filter((t) => t.direction === filterDirection);
    if (filterOutcome !== "all") list = list.filter((t) => t.outcome === filterOutcome);

    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "date") { av = a.date; bv = b.date; }
      else if (sortKey === "pair") { av = a.pair; bv = b.pair; }
      else if (sortKey === "direction") { av = a.direction; bv = b.direction; }
      else if (sortKey === "netProfit") { av = a.netProfit; bv = b.netProfit; }
      else if (sortKey === "rr") { av = a.rr; bv = b.rr; }
      else if (sortKey === "outcome") { av = a.outcome ?? ""; bv = b.outcome ?? ""; }

      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return list;
  }, [trades, search, filterPair, filterDirection, filterOutcome, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-primary" />
    ) : (
      <ChevronDown className="w-3 h-3 text-primary" />
    );
  }

  const selectClass =
    "bg-card border border-input rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Trades</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {analytics.totalTrades} total &nbsp;|&nbsp;
            <span className="text-emerald-400">{fmtMoney(analytics.totalProfit)} won</span>
            &nbsp;|&nbsp;
            <span className="text-red-400">{fmtMoney(analytics.totalLoss)} lost</span>
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          data-testid="button-add-trade-page"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Trade
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search pair, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-trades"
            className="bg-card border border-input rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </div>

        <select
          value={filterPair}
          onChange={(e) => setFilterPair(e.target.value)}
          className={selectClass}
          data-testid="select-filter-pair"
        >
          <option value="all">All Pairs</option>
          {allPairs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
          className={selectClass}
          data-testid="select-filter-direction"
        >
          <option value="all">All Directions</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>

        <select
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
          className={selectClass}
          data-testid="select-filter-outcome"
        >
          <option value="all">All Outcomes</option>
          <option value="WIN">Win</option>
          <option value="LOSS">Loss</option>
          <option value="BE">Breakeven</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {trades.length === 0
              ? "No trades yet. Click \"Add Trade\" to log your first trade."
              : "No trades match your filters."}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {(
                    [
                      { key: "date", label: "Date" },
                      { key: "pair", label: "Pair" },
                      { key: "direction", label: "Dir" },
                    ] as { key: SortKey; label: string }[]
                  ).map(({ key, label }) => (
                    <th
                      key={key}
                      className="text-left text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort(key)}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        <SortIcon k={key} />
                      </div>
                    </th>
                  ))}
                  <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">Entry</th>
                  <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">SL</th>
                  <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">TP</th>
                  <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">Lot</th>
                  <th
                    className="text-right text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("netProfit")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Net P&L <SortIcon k="netProfit" />
                    </div>
                  </th>
                  <th
                    className="text-right text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("rr")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      R:R <SortIcon k="rr" />
                    </div>
                  </th>
                  <th
                    className="text-right text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("outcome")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Result <SortIcon k="outcome" />
                    </div>
                  </th>
                  <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    data-testid={`row-trade-${t.id}`}
                    className="border-b border-border/40 hover:bg-accent/20 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">
                      {format(new Date(t.date + "T12:00:00"), "MM/dd/yyyy")}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium">{t.pair}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          t.direction === "BUY"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.entryPrice}</td>
                    <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.stopLoss}</td>
                    <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.takeProfit}</td>
                    <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.lotSize}</td>
                    <td
                      className={`py-2.5 px-4 text-right text-xs font-semibold ${
                        t.outcome === "WIN"
                          ? "text-emerald-400"
                          : t.outcome === "LOSS"
                          ? "text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t.outcome === "WIN"
                        ? `+${fmtMoney(t.netProfit)}`
                        : t.outcome === "LOSS"
                        ? `-${fmtMoney(t.netLoss)}`
                        : "BE"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                      {t.rr.toFixed(2)}R
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          t.outcome === "WIN"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : t.outcome === "LOSS"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.outcome ?? "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditTrade(t)}
                          data-testid={`button-edit-trade-${t.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTrade(t.id)}
                          data-testid={`button-delete-trade-${t.id}`}
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              data-testid="button-clear-all"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                This will permanently delete all {trades.length} trades.
              </span>
              <button
                onClick={() => {
                  clearAll();
                  setConfirmClear(false);
                }}
                data-testid="button-confirm-clear"
                className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20"
              >
                Yes, clear all
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <AddTradeModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editTrade && (
        <AddTradeModal
          open={!!editTrade}
          onClose={() => setEditTrade(null)}
          editTrade={editTrade}
        />
      )}
    </div>
  );
}
