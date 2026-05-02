import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, CheckCircle, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { parseCSV, ParsedCSVResult } from "@/utils/csvParser";
import { Trade } from "@/types";
import { format } from "date-fns";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (trades: Trade[]) => void;
}

export default function CSVImportModal({ open, onClose, onImport }: Props) {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ParsedCSVResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setResult(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) processFile(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!result?.trades.length) return;
    onImport(result.trades);
    setStep("done");
  };

  const handleClose = () => {
    setResult(null);
    setStep("upload");
    setFileName("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative z-10 w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">Import CSV</h2>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {step === "upload" && (
            <div>
              <p className="text-xs text-muted-foreground mb-4">
                Upload a CSV exported from MetaTrader, TradeZella, Notion, or any trading platform. TradeLog will auto-detect columns.
              </p>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3 transition-colors ${
                  dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drop your CSV file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </div>
                <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
              </div>

              {/* Supported columns hint */}
              <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Auto-detected columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Date","Pair/Symbol","Direction","Entry","SL","TP","Lots","Outcome","P&L","R:R","Strategy","Notes"].map((c) => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "preview" && result && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {result.trades.length} trades found · {result.skipped} rows skipped
                  </p>
                </div>
                {result.trades.length > 0 ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </div>

              {/* Column mapping */}
              {Object.keys(result.columnMap).length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2">Detected columns</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.columnMap).map(([from, to]) => (
                      <span key={from} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {from} → {to}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 max-h-28 overflow-y-auto">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Warnings</p>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[10px] text-amber-300/80">{e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-[10px] text-amber-400/60 mt-1">+{result.errors.length - 5} more…</p>
                  )}
                </div>
              )}

              {/* Preview table */}
              {result.trades.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/60 sticky top-0">
                        <tr>
                          {["Date","Pair","Dir","Entry","SL","TP","Outcome","P&L","R:R"].map((h) => (
                            <th key={h} className="text-left text-[10px] text-muted-foreground py-2 px-3 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.slice(0, 8).map((t, i) => (
                          <tr key={i} className="border-t border-border/40">
                            <td className="py-1.5 px-3 text-muted-foreground">{format(new Date(t.date + "T12:00:00"), "MMM d")}</td>
                            <td className="py-1.5 px-3 font-medium">{t.pair}</td>
                            <td className="py-1.5 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                {t.direction}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-muted-foreground">{t.entryPrice}</td>
                            <td className="py-1.5 px-3 text-red-400">{t.stopLoss || "—"}</td>
                            <td className="py-1.5 px-3 text-emerald-400">{t.takeProfit || "—"}</td>
                            <td className="py-1.5 px-3">
                              <span className={t.outcome === "WIN" ? "text-emerald-400" : t.outcome === "LOSS" ? "text-red-400" : "text-muted-foreground"}>
                                {t.outcome ?? "—"}
                              </span>
                            </td>
                            <td className={`py-1.5 px-3 font-semibold ${t.outcome === "WIN" ? "text-emerald-400" : "text-red-400"}`}>
                              {t.outcome === "WIN" ? `+${fmtMoney(t.netProfit)}` : t.outcome === "LOSS" ? `-${fmtMoney(t.netLoss)}` : "—"}
                            </td>
                            <td className="py-1.5 px-3 text-muted-foreground">{t.rr.toFixed(2)}R</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.trades.length > 8 && (
                    <div className="py-2 px-3 text-center text-[10px] text-muted-foreground border-t border-border/40">
                      +{result.trades.length - 8} more trades
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-base font-semibold">Import Successful!</p>
              <p className="text-sm text-muted-foreground">
                {result?.trades.length} trades imported to your journal.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          {step === "upload" && (
            <button onClick={handleClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
              <button
                onClick={handleImport}
                disabled={!result?.trades.length}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-40"
              >
                Import {result?.trades.length} Trades
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === "done" && (
            <button onClick={handleClose} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors">
              Done
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
