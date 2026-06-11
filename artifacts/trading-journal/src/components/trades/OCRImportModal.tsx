import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload, Camera, CheckCircle2, AlertCircle, Loader2, X,
  ArrowRight, TrendingUp, TrendingDown, RotateCcw, ScanText,
} from "lucide-react";
import { parseOcrText } from "@/utils/ocrParser";

export interface OCRResult {
  pair: string | null;
  direction: "BUY" | "SELL" | null;
  entryPrice: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number | null;
  profit: number | null;
  date: string | null;
  outcome: "WIN" | "LOSS" | "BE" | null;
  session: "ASIA" | "TOKYO" | "LONDON" | "NEW_YORK" | null;
  strategy: string | null;
  patterns: string[];
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUseResult: (result: OCRResult) => void;
}

type Step = "upload" | "analyzing" | "result" | "error";

function FieldBadge({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className="text-xs text-muted-foreground/50 italic">Not detected</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-xs text-foreground font-semibold">{String(value)}</span>
    </div>
  );
}

export default function OCRImportModal({ open, onClose, onUseResult }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string>("Initializing…");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setImagePreview(null);
    setResult(null);
    setError(null);
    setDragOver(false);
    setProgress("Initializing…");
  }

  function handleClose() {
    reset();
    onClose();
  }

  const analyze = useCallback(async (file: File) => {
    setStep("analyzing");
    setError(null);
    setProgress("Loading OCR engine…");

    try {
      // Dynamically import Tesseract.js so it doesn't bloat initial bundle
      const Tesseract = await import("tesseract.js");
      setProgress("Scanning image…");

      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m: { status: string; progress?: number }) => {
          if (m.status === "recognizing text") {
            const pct = Math.round((m.progress ?? 0) * 100);
            setProgress(`Reading text… ${pct}%`);
          } else if (m.status === "loading tesseract core") {
            setProgress("Loading OCR engine…");
          } else if (m.status === "initialized api") {
            setProgress("Engine ready, scanning…");
          }
        },
      });

      setProgress("Parsing fields…");
      const raw = data.text ?? "";
      const parsed = parseOcrText(raw);

      setResult(parsed);
      setStep("result");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OCR failed — try a higher-resolution screenshot"
      );
      setStep("error");
    }
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP, etc.)");
      setStep("error");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Image must be smaller than 12 MB");
      setStep("error");
      return;
    }
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    await analyze(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  function useResult() {
    if (!result) return;
    onUseResult(result);
    handleClose();
  }

  const detectedCount = result
    ? Object.values(result).filter((v) =>
        v !== null && !(Array.isArray(v) && v.length === 0)
      ).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl bg-[#0d0d14] border border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Camera className="w-5 h-5 text-blue-400" />
            Import Trade from Screenshot
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ── Upload ── */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <ScanText className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-300">
                  Runs entirely on your device — no AI API, no internet required for OCR.
                  Works best with MT4 / MT5 screenshots.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all ${
                  dragOver
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-foreground font-semibold">Drop screenshot here</p>
                  <p className="text-muted-foreground text-sm mt-1">or click to browse</p>
                  <p className="text-muted-foreground/60 text-xs mt-2">PNG, JPG, WEBP — max 12 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { emoji: "📊", label: "MT4 / MT5" },
                  { emoji: "📈", label: "TradingView" },
                  { emoji: "🏦", label: "Broker platforms" },
                ].map(({ emoji, label }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/5 rounded-lg py-2.5 px-2">
                    <div className="text-lg mb-0.5">{emoji}</div>
                    <div className="text-xs text-muted-foreground font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Analyzing ── */}
          {step === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 py-10"
            >
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Screenshot"
                    className="max-h-48 rounded-xl border border-white/10 opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      <span className="text-sm text-white font-medium">{progress}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-center">
                <p className="text-foreground font-semibold">Reading your screenshot</p>
                <p className="text-muted-foreground text-sm mt-1">Using local Tesseract OCR — no API needed</p>
              </div>
              <div className="flex gap-1.5">
                {["Pair", "Direction", "Prices", "Date"].map((label, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.4] }}
                    transition={{ delay: i * 0.3, repeat: Infinity, duration: 1.2 }}
                    className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded"
                  >
                    {label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Result ── */}
          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm text-green-400 font-medium">
                    Extracted {detectedCount} field{detectedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-green-400/60 mt-0.5">
                    Review below — empty fields can be filled in manually
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Screenshot"
                      className="w-full rounded-xl border border-white/10 max-h-48 object-contain bg-black/40"
                    />
                    <button
                      onClick={reset}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                      title="Try a different image"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                )}

                {result.direction && (
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    result.direction === "BUY"
                      ? "bg-emerald-500/10 border-emerald-500/25"
                      : "bg-red-500/10 border-red-500/25"
                  }`}>
                    {result.direction === "BUY"
                      ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                      : <TrendingDown className="w-4 h-4 text-red-400" />
                    }
                    <span className={`font-bold text-sm ${result.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                      {result.direction}
                    </span>
                    {result.pair && (
                      <span className="text-foreground font-semibold text-sm">{result.pair}</span>
                    )}
                    {result.outcome && (
                      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                        result.outcome === "WIN" ? "bg-emerald-500/20 text-emerald-400"
                        : result.outcome === "LOSS" ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 text-muted-foreground"
                      }`}>{result.outcome}</span>
                    )}
                  </div>
                )}

                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-0">
                  <FieldBadge label="Entry Price" value={result.entryPrice} />
                  <FieldBadge label="Exit Price"  value={result.exitPrice} />
                  <FieldBadge label="Stop Loss"   value={result.stopLoss} />
                  <FieldBadge label="Take Profit" value={result.takeProfit} />
                  <FieldBadge label="Lot Size"    value={result.lotSize} />
                  <FieldBadge label="P&L"         value={result.profit != null ? `$${result.profit.toFixed(2)}` : null} />
                  <FieldBadge label="Date"        value={result.date} />
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-medium shrink-0">Session</span>
                    {result.session
                      ? <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full font-semibold">{result.session}</span>
                      : <span className="text-xs text-muted-foreground/50 italic">Not detected</span>
                    }
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-medium shrink-0">Strategy</span>
                    <span className="text-xs text-muted-foreground/50 italic">Not detected — add manually</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-border/80 text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  onClick={useResult}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  Use These Details
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Error ── */}
          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Could not read screenshot</p>
                  <p className="text-xs text-red-400/70 mt-1">{error}</p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    Tips: use a clear, high-resolution screenshot; avoid blurry or very small images.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
