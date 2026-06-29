import { useMemo, useState, useEffect } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { computeAnalytics } from "@/engine/analyticsEngine";
import { fmtTradeDate } from "@/lib/dateUtils";
import { Plus, Search, Trash2, Edit2, ChevronUp, ChevronDown, Upload, Download, RefreshCw, CheckCircle, AlertCircle, Camera } from "lucide-react";
import AddTradeModal, { TradeFormPrefill } from "@/components/trades/AddTradeModal";
import TradeDetailDrawer from "@/components/trades/TradeDetailDrawer";
import CSVImportModal from "@/components/trades/CSVImportModal";
import OCRImportModal, { OCRResult } from "@/components/trades/OCRImportModal";
import { Trade } from "@/types";
import { exportTradesToCSV } from "@/utils/csvExporter";
import { usePnLRecalculator } from "@/hooks/usePnLRecalculator";

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
  const startingBalance = useTradeStore((s) => s.startingBalance);
  const analytics = useMemo(() => computeAnalytics(trades, startingBalance), [trades, startingBalance]);

  const addTrade = useTradeStore((s) => s.addTrade);
  const { recalculate, running: recalcRunning, lastResult } = usePnLRecalculator();
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrPrefill, setOcrPrefill] = useState<TradeFormPrefill | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [search, setSearch] = useState("");
  const [filterPair, setFilterPair] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!lastResult) return;
    const s = lastResult.summary;
    const msg = lastResult.error
      ? `Error: ${lastResult.error}`
      : s.matchedPositions === 0
        ? "No matchable round-trips found."
        : `Matched ${s.matchedPositions} positions — ${s.wins}W / ${s.losses}L · Net ${s.totalPnL >= 0 ? "+" : ""}${s.totalPnL.toFixed(2)}`;
    setToast({ ok: !lastResult.error, msg });
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [lastResult]);

  async function handleRecalculate() {
    if (trades.length === 0) { setToast({ ok: false, msg: "No trades to recalculate." }); return; }
    await recalculate();
  }

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

  function handleOcrResult(result: OCRResult) {
    const prefill: TradeFormPrefill = {};
    if (result.pair)              prefill.pair         = result.pair;
    if (result.direction)         prefill.direction    = result.direction;
    if (result.entryPrice)        prefill.entryPrice   = result.entryPrice;
    if (result.exitPrice)         prefill.exitPrice    = result.exitPrice;
    if (result.stopLoss)          prefill.stopLoss     = result.stopLoss;
    if (result.takeProfit)        prefill.takeProfit   = result.takeProfit;
    if (result.lotSize)           prefill.lotSize      = result.lotSize;
    if (result.profit != null)    prefill.brokerProfit = result.profit;
    if (result.date)              prefill.date         = result.date;
    if (result.outcome)           prefill.outcome      = result.outcome;
    if (result.notes)             prefill.notes        = result.notes;
    if (result.strategy)          prefill.strategy     = result.strategy;
    if (result.patterns?.length)  prefill.patterns     = result.patterns;
    if (result.session)           prefill.session      = result.session;
    setOcrPrefill(prefill);
    setAddOpen(true);
  }

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
    <div className="p-3 sm:p-4 md:p-6">
      {/* P&L recalc toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all
          ${toast.ok ? "bg-emerald-950 border-emerald-700 text-emerald-300" : "bg-red-950 border-red-700 text-red-300"}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Trades</h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-1.5">
            <span>{analytics.totalTrades} total</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-emerald-400">{fmtMoney(analytics.totalProfit)} won</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-red-400">{fmtMoney(analytics.totalLoss)} lost</span>
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          data-testid="button-add-trade-page"
          className="shrink-0 flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">Add Trade</span>
          <span className="xs:hidden">Add</span>
        </button>
      </div>

      {/* ── Secondary action buttons — stacked on mobile, row on desktop ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setOcrOpen(true)}
          className="flex items-center gap-1.5 border border-blue-500/30 hover:border-blue-500/60 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <Camera className="w-3.5 h-3.5 shrink-0" />
          <span>Screenshot</span>
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 border border-border hover:border-primary/50 bg-card hover:bg-accent text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span>CSV</span>
        </button>
        {trades.length > 0 && (
          <button
            onClick={() => exportTradesToCSV(trades)}
            className="flex items-center gap-1.5 border border-border hover:border-primary/50 bg-card hover:bg-accent text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export</span>
          </button>
        )}
        {trades.length > 0 && (
          <button
            onClick={handleRecalculate}
            disabled={recalcRunning}
            className="flex items-center gap-1.5 border border-border hover:border-primary/50 bg-card hover:bg-accent text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${recalcRunning ? "animate-spin" : ""}`} />
            <span>Recalc</span>
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="space-y-2 mb-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search pair, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-trades"
            className="w-full bg-card border border-input rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select value={filterPair} onChange={(e) => setFilterPair(e.target.value)} className={selectClass} data-testid="select-filter-pair">
            <option value="all">All Pairs</option>
            {allPairs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterDirection} onChange={(e) => setFilterDirection(e.target.value)} className={selectClass} data-testid="select-filter-direction">
            <option value="all">All Dir.</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)} className={selectClass} data-testid="select-filter-outcome">
            <option value="all">All</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="BE">BE</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-muted-foreground text-sm">
            {trades.length === 0
              ? "No trades yet. Tap \"Add\" to log your first trade."
              : "No trades match your filters."}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile card list (hidden on md+) ── */}
          <div className="md:hidden space-y-2">
            {sorted.map((t) => (
              <button
                key={t.id}
                data-testid={`row-trade-${t.id}`}
                onClick={() => setSelectedTrade(t)}
                className="w-full text-left glass-card p-3.5 hover:border-white/15 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate">{t.pair}</span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    }`}>{t.direction}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    t.outcome === "WIN" ? "bg-emerald-500/15 text-emerald-400" :
                    t.outcome === "LOSS" ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"
                  }`}>{t.outcome ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
                    <span>{fmtTradeDate(t.date, "MM/dd/yy")}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{t.rr.toFixed(2)}R</span>
                    {t.strategy && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate">{t.strategy}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-sm font-bold ${
                      t.outcome === "WIN" ? "text-emerald-400" :
                      t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` :
                       t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "BE"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditTrade(t); }}
                      data-testid={`button-edit-trade-${t.id}`}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTrade(t.id); }}
                      data-testid={`button-delete-trade-${t.id}`}
                      className="p-1.5 text-muted-foreground hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ── Desktop table (hidden on mobile) ── */}
          <div className="hidden md:block glass-card overflow-hidden">
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
                        <div className="flex items-center gap-1">{label}<SortIcon k={key} /></div>
                      </th>
                    ))}
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">Entry</th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">SL</th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">TP</th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">Lot</th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("netProfit")}>
                      <div className="flex items-center justify-end gap-1">Net P&L <SortIcon k="netProfit" /></div>
                    </th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("rr")}>
                      <div className="flex items-center justify-end gap-1">R:R <SortIcon k="rr" /></div>
                    </th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("outcome")}>
                      <div className="flex items-center justify-end gap-1">Result <SortIcon k="outcome" /></div>
                    </th>
                    <th className="text-right text-xs text-muted-foreground py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <tr
                      key={t.id}
                      data-testid={`row-trade-${t.id}`}
                      onClick={() => setSelectedTrade(t)}
                      className="border-b border-border/40 hover:bg-accent/20 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{fmtTradeDate(t.date, "MM/dd/yyyy")}</td>
                      <td className="py-2.5 px-4 text-xs font-medium">{t.pair}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{t.direction}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.entryPrice}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.stopLoss}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.takeProfit}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.lotSize}</td>
                      <td className={`py-2.5 px-4 text-right text-xs font-semibold ${t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"}`}>
                        {t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "BE"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">{t.rr.toFixed(2)}R</td>
                      <td className="py-2.5 px-4 text-right">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.outcome === "WIN" ? "bg-emerald-500/20 text-emerald-400" : t.outcome === "LOSS" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"}`}>{t.outcome ?? "—"}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setEditTrade(t); }} data-testid={`button-edit-trade-${t.id}`} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteTrade(t.id); }} data-testid={`button-delete-trade-${t.id}`} className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {trades.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Delete all {trades.length} trades?
              </span>
              <button
                onClick={() => { clearAll(); setConfirmClear(false); }}
                data-testid="button-confirm-clear"
                className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20"
              >
                Yes, clear all
              </button>
              <button onClick={() => setConfirmClear(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <AddTradeModal
        key={ocrPrefill ? JSON.stringify(ocrPrefill) : "add"}
        open={addOpen}
        onClose={() => { setAddOpen(false); setOcrPrefill(null); }}
        prefill={ocrPrefill ?? undefined}
      />
      {editTrade && (
        <AddTradeModal
          open={!!editTrade}
          onClose={() => setEditTrade(null)}
          editTrade={editTrade}
        />
      )}
      <OCRImportModal
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onUseResult={handleOcrResult}
      />
      <TradeDetailDrawer
        trade={selectedTrade}
        open={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onEdit={(t) => { setSelectedTrade(null); setEditTrade(t); }}
        onDelete={(id) => { deleteTrade(id); setSelectedTrade(null); }}
      />
      <CSVImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(newTrades) => {
          newTrades.forEach((t) => addTrade(t));
          setImportOpen(false);
        }}
      />
    </div>
  );
}
