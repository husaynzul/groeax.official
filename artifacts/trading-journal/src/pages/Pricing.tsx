import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Check, Zap, Crown, Star, ArrowLeft, Loader2, Shield,
  Bot, Brain, CandlestickChart, Activity, Link2, Layers, X, Copy,
} from "lucide-react";
import { useAuthStore, apiSubscribe } from "@/store/authStore";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

const BINANCE_WALLET = "THrybvwth3eDpXVnZwBRohZ7AB3bY4Cqjs";
const BINANCE_ID = "520572397";

const FREE_FEATURES = [
  { icon: Activity, label: "Trade Journal & P&L tracking" },
  { icon: Activity, label: "Full analytics dashboard" },
  { icon: Activity, label: "Risk calculator" },
  { icon: Activity, label: "Market news feed" },
  { icon: Activity, label: "CSV import / export" },
];

const PREMIUM_FEATURES = [
  { icon: Bot,              label: "AI Trading Coach (unlimited)" },
  { icon: Brain,            label: "Market Intelligence OS" },
  { icon: Zap,              label: "Live trading signals" },
  { icon: CandlestickChart, label: "Live chart with indicators" },
  { icon: Link2,            label: "Broker sync (MT5, Binance, Bybit…)" },
  { icon: Layers,           label: "Open positions tracker" },
  { icon: Shield,           label: "Priority support" },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user, token, updateUser, isPremium } = useAuthStore();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBinance, setShowBinance] = useState(false);
  const [binanceEmail, setBinanceEmail] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  const subscribe = async () => {
    if (!token) {
      setLocation("/signup");
      return;
    }
    if (billing === "yearly") {
      setShowBinance(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedUser = await apiSubscribe(token, billing);
      updateUser(updatedUser);
      setLocation("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmBinancePayment = async () => {
    if (!binanceEmail || !txHash.trim()) {
      setError("Please enter your email and transaction hash.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedUser = await apiSubscribe(token!, "yearly", { email: binanceEmail, txHash: txHash.trim() });
      updateUser(updatedUser);
      setShowBinance(false);
      setLocation("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={groeaxLogo} alt="Groeax" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg tracking-tight">Groeax</span>
        </Link>
        {user ? (
          <button onClick={() => setLocation("/dashboard")} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors">Sign in</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Get started</Link>
          </div>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-5">
            <Crown className="w-3.5 h-3.5" /> Simple, transparent pricing
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="text-5xl font-black tracking-tight mb-4">
            Choose your plan
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="text-white/45 text-lg max-w-xl mx-auto">
            Start free. Upgrade to unlock the full Groeax experience — AI coaching, live signals, and institutional-grade analytics.
          </motion.p>

          {/* Billing toggle */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8 mt-8">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white text-[#030712]" : "text-white/50 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billing === "yearly" ? "bg-white text-[#030712]" : "text-white/50 hover:text-white"}`}
            >
              Yearly
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${billing === "yearly" ? "bg-emerald-500 text-white" : "bg-emerald-500/20 text-emerald-400"}`}>
                Save 32%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">

          {/* Free */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="rounded-[24px] border border-white/10 bg-white/[0.025] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-white/50" />
              </div>
              <div>
                <p className="font-bold text-white">Free</p>
                <p className="text-xs text-white/35">Forever free</p>
              </div>
            </div>

            <div className="mb-8">
              <span className="text-5xl font-black text-white">$0</span>
              <span className="text-white/35 text-sm ml-2">/ month</span>
            </div>

            <div className="space-y-3 mb-8">
              {FREE_FEATURES.map(({ label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-white/55">
                  <div className="w-5 h-5 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-white/50" />
                  </div>
                  {label}
                </div>
              ))}
            </div>

            {!user ? (
              <Link href="/signup">
                <button className="w-full py-3 rounded-xl border border-white/15 text-sm font-semibold text-white/70 hover:bg-white/5 transition-colors">
                  Get started free
                </button>
              </Link>
            ) : !isPremium ? (
              <button className="w-full py-3 rounded-xl border border-white/15 text-sm font-semibold text-white/50 cursor-default">
                Your current plan
              </button>
            ) : null}
          </motion.div>

          {/* Premium */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-[24px] border border-violet-500/30 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.12),rgba(255,255,255,0.02)_50%)] p-8 relative overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.12)]">

            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 uppercase tracking-wider">
                Most popular
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Crown className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-white">Premium</p>
                <p className="text-xs text-violet-400/70">Full Groeax experience</p>
              </div>
            </div>

            <div className="mb-2">
              {billing === "yearly" ? (
                <>
                  <span className="text-5xl font-black text-white">$7.50</span>
                  <span className="text-white/35 text-sm ml-2">/ month</span>
                  <p className="text-emerald-400 text-xs font-semibold mt-1">Billed $90 / year</p>
                </>
              ) : (
                <>
                  <span className="text-5xl font-black text-white">$7</span>
                  <span className="text-white/35 text-sm ml-2">/ month</span>
                  <p className="text-white/30 text-xs mt-1">Billed monthly</p>
                </>
              )}
            </div>

            <div className="space-y-3 mb-8 mt-6">
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Everything in Free, plus:</p>
              {PREMIUM_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-violet-400" />
                  </div>
                  {label}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            {isPremium ? (
              <button className="w-full py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-sm font-semibold text-violet-300 cursor-default">
                ✓ Your current plan
              </button>
            ) : (
              <button
                onClick={subscribe}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? "Processing…" : `Upgrade to Premium`}
              </button>
            )}
          </motion.div>
        </div>

        {/* Trust badges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center space-y-3">
          <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-white/25">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Secure checkout</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>Instant access</span>
            <span>·</span>
            <span>No hidden fees</span>
          </div>
          <p className="text-xs text-white/18">© 2026 Groeax · Professional trading tools for serious traders</p>
        </motion.div>
      </div>

      {/* Binance Payment Modal */}
      {showBinance && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowBinance(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-[#0b0f18] border border-white/10 rounded-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Send Payment</h2>
              <button
                onClick={() => setShowBinance(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-violet-500/10 border border-violet-500/25 rounded-lg p-3 text-sm text-violet-300">
                <p className="font-semibold mb-1">Binance ID: {BINANCE_ID}</p>
                <p className="text-xs text-violet-300/70">Send exactly 90 USDT (TRC20) to the wallet below</p>
              </div>

              <div>
                <p className="text-sm text-white/50 mb-2">Wallet Address:</p>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                  <code className="text-xs text-white/80 flex-1 break-all font-mono">{BINANCE_WALLET}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(BINANCE_WALLET);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-xs text-emerald-400 mt-1">✓ Copied to clipboard</p>}
              </div>

              <div>
                <label className="text-sm text-white/50 mb-2 block">Email (for order tracking)</label>
                <input
                  type="email"
                  value={binanceEmail}
                  onChange={(e) => setBinanceEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="text-sm text-white/50 mb-2 block">Transaction Hash / TX ID</label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Paste your BTC transaction hash here"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-violet-500/50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={confirmBinancePayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm transition-all disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {loading ? "Confirming…" : "Confirm Payment"}
              </button>
              <button
                onClick={() => setShowBinance(false)}
                className="w-full py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-[10px] text-white/25 text-center mt-4">
              Your subscription will activate within 24 hours after we verify your payment.
            </p>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
