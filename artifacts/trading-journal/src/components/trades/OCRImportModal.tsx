import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/authStore";
import {
  Upload, Camera, CheckCircle2, AlertCircle, Loader2, X,
  ArrowRight, TrendingUp, TrendingDown, RotateCcw,
} from "lucide-react";

export interface OCRResult {
  pair: string | null;
  direction: "BUY" | "SELL" | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number | null;
  profit: number | null;
  date: string | null;
  outcome: "WIN" | "LOSS" | "BE" | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUseResult: (result: OCRResult) => void;
}

type Step = "upload" | "analyzing" | "result" | "error";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FieldBadge({ label, value, missing }: { label: string; value: string | number | null; missing?: boolean }) {
  if (missing || value === null || value === undefined) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-600 italic">Not detected</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs text-white font-medium">{String(value)}</span>
    </div>
  );
}

export default function OCRImportModal({ open, onClose, onUseResult }: Props) {
  const { token } = useAuthStore();
  const [step, setStep] = useState<Step>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    setDragOver(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP, etc.)");
      setStep("error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be smaller than 8MB");
      setStep("error");
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setImagePreview(b64);
      setImageBase64(b64);
      await analyze(b64);
    } catch {
      setError("Failed to read image file");
      setStep("error");
    }
  }

  const analyze = useCallback(async (b64: string) => {
    setStep("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/ai/ocr-trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: b64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        setStep("error");
        return;
      }
      setResult(data.trade);
      setStep("result");
    } catch {
      setError("Network error — could not reach AI service");
      setStep("error");
    }
  }, [token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  function useResult() {
    if (!result) return;
    onUseResult(result);
    handleClose();
  }

  const detectedCount = result
    ? Object.values(result).filter((v) => v !== null).length
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
          {/* ── Upload step ── */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <p className="text-sm text-gray-400">
                Upload a screenshot from your trading platform. AI will automatically extract the trade details and pre-fill the form.
              </p>

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
                  <p className="text-white font-medium">Drop screenshot here</p>
                  <p className="text-gray-500 text-sm mt-1">or click to browse</p>
                  <p className="text-gray-600 text-xs mt-2">PNG, JPG, WEBP — max 8MB</p>
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
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Analyzing step ── */}
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
                    className="max-h-48 rounded-xl border border-white/10 opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      <span className="text-sm text-white font-medium">Analyzing…</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-medium">AI is reading your screenshot</p>
                <p className="text-gray-500 text-sm mt-1">Extracting trade details…</p>
              </div>
              <div className="flex gap-1.5">
                {["Pair", "Direction", "Prices", "Date"].map((label, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.4] }}
                    transition={{ delay: i * 0.3, repeat: Infinity, duration: 1.2 }}
                    className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded"
                  >
                    {label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Result step ── */}
          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm text-green-400 font-medium">
                    Extracted {detectedCount} field{detectedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-green-400/60 mt-0.5">
                    Review the details below, then click "Use These Details" to pre-fill the trade form
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Image preview */}
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Screenshot"
                      className="w-full rounded-xl border border-white/10 max-h-64 object-contain bg-black/40"
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

                {/* Extracted fields */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-0">
                  {/* Direction badge at top */}
                  {result.direction && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                      {result.direction === "BUY" ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm font-bold ${
                        result.direction === "BUY" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {result.direction}
                      </span>
                      {result.pair && (
                        <span className="text-sm text-white font-medium">{result.pair}</span>
                      )}
                    </div>
                  )}

                  <FieldBadge label="Entry Price" value={result.entryPrice} />
                  <FieldBadge label="Stop Loss" value={result.stopLoss} />
                  <FieldBadge label="Take Profit" value={result.takeProfit} />
                  <FieldBadge label="Lot Size" value={result.lotSize} />
                  <FieldBadge label="Date" value={result.date} />
                  <FieldBadge label="Outcome" value={result.outcome} />

                  {result.notes && (
                    <div className="pt-2 mt-1 border-t border-white/5">
                      <p className="text-xs text-gray-500 mb-1">AI Notes</p>
                      <p className="text-xs text-gray-400 italic">"{result.notes}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-colors"
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

          {/* ── Error step ── */}
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
                  <p className="text-sm text-red-400 font-medium">Analysis failed</p>
                  <p className="text-xs text-red-400/70 mt-1">{error}</p>
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
