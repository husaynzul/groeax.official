import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { apiSignup, useAuthStore } from "@/store/authStore";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

const FREE_FEATURES = [
  "Trade journal & analytics",
  "Risk calculator",
  "Market news feed",
  "Basic dashboard",
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!email.includes("@")) return setError("Enter a valid email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      const { token, user } = await apiSignup(name, email, password);
      setAuth(user, token);
      setLocation("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[10%] w-[600px] h-[600px] rounded-full bg-violet-700/12 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[500px] h-[500px] rounded-full bg-emerald-700/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-[880px] grid md:grid-cols-[1fr_420px] gap-8 items-center"
      >
        {/* Left — value prop */}
        <div className="hidden md:block">
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity mb-8">
            <img src={groeaxLogo} alt="Groeax" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-black tracking-tight text-white">Groeax</span>
          </Link>
          <h2 className="text-4xl font-black leading-tight text-white mb-4">
            Start your trading<br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-emerald-400 bg-clip-text text-transparent">
              journey today.
            </span>
          </h2>
          <p className="text-white/45 text-base mb-8 leading-relaxed">
            Join traders who use Groeax to review every trade, fix every mistake, and grow every month.
          </p>
          <div className="space-y-3">
            {FREE_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-white/60">
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                {f}
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm text-violet-400 font-semibold">
              <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-violet-400" />
              </div>
              AI Coach, Live Intelligence & more with Premium
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div>
          <div className="md:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={groeaxLogo} alt="Groeax" className="w-9 h-9 object-contain" />
              <span className="text-xl font-black tracking-tight text-white">Groeax</span>
            </Link>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] p-8">
            <h1 className="text-xl font-bold text-white mb-1">Create your account</h1>
            <p className="text-sm text-white/40 mb-7">Free forever · Upgrade when you're ready</p>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/35 font-semibold">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/35 font-semibold">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    autoComplete="email"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/35 font-semibold">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Creating account…" : "Create free account"}
              </button>
            </form>

            <p className="text-center text-sm text-white/30 mt-6">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                Sign in
              </Link>
            </p>
            <p className="text-center text-[10px] text-white/20 mt-3">
              By signing up you agree to use Groeax responsibly.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
