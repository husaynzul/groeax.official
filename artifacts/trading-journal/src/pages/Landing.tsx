import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  TrendingUp, BarChart2, Rewind, Bot, CandlestickChart,
  Zap, Shield, Globe, ChevronRight, ArrowRight,
  Activity, BookOpen, Calculator,
} from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

const FEATURES = [
  {
    icon: CandlestickChart,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    title: "Live Charts",
    desc: "Real-time candlestick charts with Binance crypto, Yahoo Finance forex, metals and indices. EMA, RSI overlays built in.",
  },
  {
    icon: Rewind,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    title: "Bar Replay",
    desc: "Replay any market candle by candle. Practice your strategy without risking real money. Full virtual trade simulation.",
  },
  {
    icon: BarChart2,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    title: "Deep Analytics",
    desc: "Win rate, profit factor, drawdown, streaks, session heatmaps. Understand exactly where you make and lose money.",
  },
  {
    icon: Bot,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    title: "AI Coach",
    desc: "Get personalized trade review and improvement tips powered by AI. Identify patterns in your psychology and execution.",
  },
  {
    icon: BookOpen,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "Trade Journal",
    desc: "Log trades with screenshots, notes and emotions. Build a complete record of your trading history.",
  },
  {
    icon: Calculator,
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
    title: "Risk Calculator",
    desc: "Calculate position size, risk/reward ratio and pip value automatically before entering any trade.",
  },
];

const STATS = [
  { value: "50+", label: "Trading Pairs" },
  { value: "7",   label: "Timeframes" },
  { value: "5",   label: "Indicators" },
  { value: "∞",   label: "Trade History" },
];

const BROKERS = ["Binance", "Coinbase", "Kraken", "Bybit", "OKX", "MT5", "Alpaca", "OANDA"];

/* ── Fake sparkline SVG ─────────────────────────────────────────────── */
function Sparkline({ color, points }: { color: string; points: string }) {
  return (
    <svg viewBox="0 0 120 40" className="w-full h-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Mini chart card ─────────────────────────────────────────────────── */
function ChartCard({ pair, price, change, positive, points }: {
  pair: string; price: string; change: string; positive: boolean; points: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white/80">{pair}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${positive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {change}
        </span>
      </div>
      <div className="h-10">
        <Sparkline color={positive ? "#10b981" : "#ef4444"} points={points} />
      </div>
      <p className="text-sm font-bold text-white font-mono">{price}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#080c15] text-white overflow-x-hidden">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#080c15]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-white tracking-tight">TradeLog</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`${BASE}/dashboard`}
            className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link href={`${BASE}/dashboard`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Open App <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-violet-500/8 rounded-full blur-[80px]" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-emerald-500/8 rounded-full blur-[80px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Live market data · 50+ pairs
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
            The Trading Journal
            <br />
            <span className="bg-gradient-to-r from-primary via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              Built for Professionals
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track every trade, replay markets candle by candle, analyze your edge with AI,
            and watch live charts from Binance, Yahoo Finance and 50+ pairs — all in one dark-mode dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={`${BASE}/dashboard`}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground text-base font-bold hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25">
              Start Journaling Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href={`${BASE}/chart`}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-white text-base font-semibold hover:bg-white/10 transition-all">
              <Activity className="w-4 h-4 text-emerald-400" />
              View Live Charts
            </Link>
          </div>
        </motion.div>

        {/* Mini chart cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative z-10 mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl mx-auto"
        >
          <ChartCard pair="BTC/USD" price="$69,245" change="+2.4%" positive points="0,30 20,25 40,28 60,15 80,8 100,12 120,5" />
          <ChartCard pair="ETH/USD" price="$3,512" change="+1.8%" positive points="0,35 20,30 40,20 60,25 80,18 100,10 120,5" />
          <ChartCard pair="EUR/USD" price="1.0854" change="-0.12%" positive={false} points="0,10 20,12 40,15 60,20 80,25 100,28 120,35" />
          <ChartCard pair="XAU/USD" price="$2,331" change="+0.8%" positive points="0,28 20,22 40,25 60,18 80,15 100,10 120,5" />
        </motion.div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-white">{s.value}</p>
              <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Everything you need to grow as a trader</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              From live market data to AI-powered trade review — built for serious traders.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors group"
              >
                <div className={`inline-flex p-2.5 rounded-xl border mb-4 ${f.bg}`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Broker integrations ─────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-5">
              <Globe className="w-3.5 h-3.5" />
              Multi-broker support
            </div>
            <h2 className="text-3xl font-extrabold mb-3">Connect your exchange or broker</h2>
            <p className="text-white/40 mb-10">Import trades automatically from all major platforms.</p>

            <div className="flex flex-wrap justify-center gap-3">
              {BROKERS.map((b) => (
                <div key={b}
                  className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/60 font-medium">
                  {b}
                </div>
              ))}
              <div className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/40 font-medium">
                + more
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Highlights ─────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", title: "Real-Time Data", desc: "Binance WebSocket + Yahoo Finance. No delayed or simulated prices." },
            { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Your Data, Local", desc: "All trades stored in your browser. No account required. Full privacy." },
            { icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", title: "No Lookahead", desc: "Bar Replay enforces strict candle-by-candle rules. Test your strategy honestly." },
          ].map((item) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
            >
              <div className={`inline-flex p-2.5 rounded-xl border mb-3 ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <h3 className="font-bold text-white mb-1.5">{item.title}</h3>
              <p className="text-sm text-white/45">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Ready to trade smarter?
            </h2>
            <p className="text-white/40 text-lg mb-8">
              No sign up. No credit card. Open your dashboard and start journaling right now.
            </p>
            <Link href={`${BASE}/dashboard`}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-primary text-primary-foreground text-base font-bold hover:bg-primary/90 transition-all hover:scale-105 shadow-xl shadow-primary/30">
              Open TradeLog Free
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
            <span className="text-sm font-semibold text-white/60">TradeLog</span>
          </div>
          <p className="text-xs text-white/25">
            For educational and journaling purposes only. Not financial advice.
          </p>
          <div className="flex gap-4">
            <Link href={`${BASE}/dashboard`} className="text-xs text-white/40 hover:text-white/70 transition-colors">Dashboard</Link>
            <Link href={`${BASE}/chart`} className="text-xs text-white/40 hover:text-white/70 transition-colors">Live Chart</Link>
            <Link href={`${BASE}/replay`} className="text-xs text-white/40 hover:text-white/70 transition-colors">Replay</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
