import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Check, Zap, Crown, Shield, ArrowLeft, Loader2,
  Bot, Brain, CandlestickChart, Link2, Layers,
  X, Copy, Star, Newspaper, Clock, BarChart3, Wifi,
  Upload, ImageIcon, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  useAuthStore, apiSubscribe, apiPaymentConfig,
  type PaymentConfig, type SubscribePlan,
} from "@/store/authStore";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

const SILVER_FEATURES = [
  { icon: Newspaper,        label: "News feed (15–30 min delay)" },
  { icon: BarChart3,        label: "Basic categories: Crypto, Stocks, Forex" },
  { icon: Clock,            label: "Trade journal & P&L tracking" },
  { icon: BarChart3,        label: "Basic analytics dashboard" },
];

const PLATINUM_FEATURES = [
  { icon: Wifi,             label: "Real-time news (no delay)" },
  { icon: Newspaper,        label: "All categories unlocked" },
  { icon: Clock,            label: "Time zone conversion feature" },
  { icon: Bot,              label: "Basic AI news filtering" },
  { icon: CandlestickChart, label: "Live chart with indicators" },
  { icon: Link2,            label: "Broker sync (Binance, Bybit…)" },
];

const PREMIUM_FEATURES = [
  { icon: Brain,            label: "Advanced AI market impact scoring" },
  { icon: Zap,              label: "Priority news fetching (fastest)" },
  { icon: BarChart3,        label: "Advanced analytics dashboard" },
  { icon: Layers,           label: "Early signal detection (crypto/forex)" },
  { icon: Link2,            label: "MT5 & all broker integrations" },
  { icon: Shield,           label: "VIP priority support badge" },
];

type Billing = "monthly" | "yearly";

interface PendingPayment {
  plan: SubscribePlan;
  label: string;
  amount: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user, token, updateUser, isPlatinum, isPremium } = useAuthStore();
  const [billing, setBilling] = useState<Billing>("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [txHash, setTxHash] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  // Screenshot state
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiPaymentConfig().then(setPaymentConfig).catch(() => {});
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Screenshot must be smaller than 10MB.");
      return;
    }
    setScreenshot(file);
    const preview = URL.createObjectURL(file);
    setScreenshotPreview(preview);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  };

  const startUpgrade = (planKey: SubscribePlan, label: string, amount: string) => {
    if (!token) { setLocation("/signup"); return; }
    setError(null);
    setSuccessMsg(null);
    setTxHash("");
    setScreenshot(null);
    setScreenshotPreview(null);
    setPending({ plan: planKey, label, amount });
  };

  const confirmPayment = async () => {
    if (!pending || !token) return;
    if (!screenshot && !txHash.trim()) {
      setError("Please upload your payment screenshot or paste a transaction hash.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let screenshotBase64: string | undefined;
      if (screenshot) {
        screenshotBase64 = await fileToBase64(screenshot);
      }

      const result = await apiSubscribe(token, pending.plan, {
        email,
        txHash: txHash.trim() || undefined,
        screenshotBase64,
      });

      updateUser(result.user);
      setPending(null);

      if (result.status === "activated") {
        setLocation("/dashboard");
      } else {
        // Pending — show success message
        setSuccessMsg(result.message ?? "Payment received! Your subscription will be activated after verification.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment submission failed");
    } finally {
      setLoading(false);
    }
  };

  const platinumPlan: SubscribePlan = billing === "yearly" ? "platinum_yearly" : "platinum_monthly";
  const premiumPlan: SubscribePlan  = billing === "yearly" ? "premium_yearly"  : "premium_monthly";

  const prices = {
    platinum: billing === "yearly"
      ? { display: "$8.75", sub: "Billed $105 / year" }
      : { display: "$10",   sub: "Billed monthly" },
    premium: billing === "yearly"
      ? { display: "$87.50", sub: "Billed $1,050 / year" }
      : { display: "$105",   sub: "Billed monthly" },
  };

  const copyWallet = () => {
    if (!paymentConfig) return;
    navigator.clipboard.writeText(paymentConfig.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      <div className="max-w-6xl mx-auto px-6 py-20">

        {/* Success banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Payment submitted successfully!</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">{successMsg}</p>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="ml-auto">
                <X className="w-4 h-4 text-emerald-400/60" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-5">
            <Crown className="w-3.5 h-3.5" /> Simple, transparent pricing
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="text-5xl font-black tracking-tight mb-4">Choose your plan</motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="text-white/45 text-lg max-w-xl mx-auto">
            Start free with Silver. Upgrade to Platinum or Premium for real-time intelligence and advanced AI analysis.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8 mt-8">
            <button onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white text-[#030712]" : "text-white/50 hover:text-white"}`}>
              Monthly
            </button>
            <button onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billing === "yearly" ? "bg-white text-[#030712]" : "text-white/50 hover:text-white"}`}>
              Yearly
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${billing === "yearly" ? "bg-emerald-500 text-white" : "bg-emerald-500/20 text-emerald-400"}`}>
                Save 12%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">

          {/* Silver */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-[24px] border border-white/10 bg-white/[0.025] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-white/50" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">Silver</p>
                <p className="text-xs text-white/35">Forever free</p>
              </div>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-black text-white">$0</span>
              <span className="text-white/35 text-sm ml-2">/ month</span>
            </div>
            <div className="space-y-3 mb-8">
              {SILVER_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-white/55">
                  <div className="w-5 h-5 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-white/40" />
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
            ) : !isPlatinum ? (
              <button className="w-full py-3 rounded-xl border border-white/15 text-sm font-semibold text-white/40 cursor-default">
                Your current plan
              </button>
            ) : null}
          </motion.div>

          {/* Platinum */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="rounded-[24px] border border-blue-500/30 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),rgba(255,255,255,0.02)_50%)] p-8 relative overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.1)]">
            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 uppercase tracking-wider">
                Most popular
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">Platinum</p>
                <p className="text-xs text-blue-400/70">Full real-time access</p>
              </div>
            </div>
            <div className="mb-2">
              <span className="text-5xl font-black text-white">{prices.platinum.display}</span>
              <span className="text-white/35 text-sm ml-2">/ month</span>
              <p className="text-blue-400 text-xs font-semibold mt-1">{prices.platinum.sub}</p>
            </div>
            <div className="space-y-3 mb-8 mt-6">
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Everything in Silver, plus:</p>
              {PLATINUM_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-blue-400" />
                  </div>
                  {label}
                </div>
              ))}
            </div>
            {isPlatinum && !isPremium ? (
              <button className="w-full py-3 rounded-xl bg-blue-500/20 border border-blue-500/30 text-sm font-semibold text-blue-300 cursor-default">
                ✓ Your current plan
              </button>
            ) : !isPlatinum ? (
              <button
                onClick={() => startUpgrade(platinumPlan, `Platinum (${billing})`, billing === "yearly" ? "105" : "10")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/25"
              >
                <Zap className="w-4 h-4" /> Upgrade to Platinum
              </button>
            ) : null}
          </motion.div>

          {/* Premium */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
            className="rounded-[24px] border border-violet-500/30 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.12),rgba(255,255,255,0.02)_50%)] p-8 relative overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.12)]">
            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 uppercase tracking-wider">
                Best value
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Crown className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">Premium</p>
                <p className="text-xs text-violet-400/70">Advanced AI + Priority signals</p>
              </div>
            </div>
            <div className="mb-2">
              <span className="text-5xl font-black text-white">{prices.premium.display}</span>
              <span className="text-white/35 text-sm ml-2">/ month</span>
              <p className="text-emerald-400 text-xs font-semibold mt-1">{prices.premium.sub}</p>
            </div>
            <div className="space-y-3 mb-8 mt-6">
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Everything in Platinum, plus:</p>
              {PREMIUM_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-violet-400" />
                  </div>
                  {label}
                </div>
              ))}
            </div>
            {isPremium ? (
              <button className="w-full py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-sm font-semibold text-violet-300 cursor-default">
                ✓ Your current plan
              </button>
            ) : (
              <button
                onClick={() => startUpgrade(premiumPlan, `Premium (${billing})`, billing === "yearly" ? "1050" : "105")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25"
              >
                <Crown className="w-4 h-4" /> Upgrade to Premium
              </button>
            )}
          </motion.div>
        </div>

        {/* Trust */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="text-center space-y-3">
          <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-white/25">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Secure payments</span>
            <span>·</span>
            <span>USDT TRC20</span>
            <span>·</span>
            <span>Manual verification</span>
            <span>·</span>
            <span>No hidden fees</span>
          </div>
          <p className="text-xs text-white/18">© 2026 Groeax · Professional trading tools for serious traders</p>
        </motion.div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !loading && setPending(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0b0f18] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">Send Payment</h2>
                  <p className="text-sm text-white/40 mt-0.5">{pending.label}</p>
                </div>
                <button onClick={() => !loading && setPending(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              {/* Step 1: Payment details */}
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 mb-4 space-y-3">
                <p className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">Step 1 — Send Payment</p>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Amount to send</span>
                  <span className="text-lg font-bold text-white">{pending.amount} USDT (TRC20)</span>
                </div>

                {paymentConfig?.binanceMerchantId && (
                  <div>
                    <p className="text-xs text-white/40 mb-1">Binance Merchant ID</p>
                    <p className="font-mono font-bold text-white">{paymentConfig.binanceMerchantId}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-white/40 mb-1.5">USDT TRC20 Wallet Address</p>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <code className="text-xs text-white/75 flex-1 break-all font-mono">
                      {paymentConfig?.wallet ?? "Loading…"}
                    </code>
                    <button onClick={copyWallet} className="shrink-0 p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {copied && <p className="text-xs text-emerald-400 mt-1">✓ Copied!</p>}
                </div>
              </div>

              {/* Step 2: Upload screenshot */}
              <div className="mb-4">
                <p className="text-xs uppercase tracking-widest text-white/50 font-semibold mb-2">
                  Step 2 — Upload Payment Screenshot <span className="text-amber-400">*Required</span>
                </p>

                {screenshotPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 bg-white/5">
                    <img src={screenshotPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain" />
                    <button
                      onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-emerald-500/80 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-white" />
                      <span className="text-xs font-semibold text-white">{screenshot?.name}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-white/30 rounded-xl p-6 text-center cursor-pointer transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-white/10 transition-colors">
                      <Upload className="w-5 h-5 text-white/40" />
                    </div>
                    <p className="text-sm font-semibold text-white/60 mb-1">Click or drag to upload screenshot</p>
                    <p className="text-xs text-white/30">PNG, JPG, WEBP up to 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                )}

                <p className="text-xs text-white/30 mt-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" />
                  Screenshot is sent directly to admin for verification
                </p>
              </div>

              {/* Optional: email + TX hash */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Email (for confirmation)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-violet-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">
                    Transaction Hash (optional — for instant activation)
                  </label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="64-character TRON TX hash (e.g. a1b2c3d4…)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 font-mono text-xs"
                  />
                  <p className="text-[10px] text-white/25 mt-1">
                    Find this in your wallet's transaction history. If left blank, admin will activate manually.
                  </p>
                </div>
              </div>

              {/* Notification note */}
              <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg px-3 py-2.5 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-400/80">
                  After submitting, our admin will receive your screenshot via WhatsApp and activate your subscription within a few hours.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
              )}

              <div className="space-y-2.5">
                <button
                  onClick={confirmPayment}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm transition-all disabled:opacity-60"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Submit Payment</>
                  }
                </button>
                <button
                  onClick={() => !loading && setPending(null)}
                  className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
