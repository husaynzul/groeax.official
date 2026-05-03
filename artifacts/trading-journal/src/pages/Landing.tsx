import { motion } from "framer-motion";
import { Link } from "wouter";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";
import {
  ChevronRight, TrendingUp, BarChart2, Bot, Shield,
  Zap, Activity, ArrowUpRight, Globe, BookOpen,
  CandlestickChart, Calculator,
} from "lucide-react";

/* ── Hero fake candlestick data ─────────────────────────────────── */
const CANDLES = [
  {o:63800,h:64400,l:63500,c:64200},{o:64200,h:64900,l:64000,c:64750},
  {o:64750,h:65400,l:64600,c:65100},{o:65100,h:65300,l:64400,c:64600},
  {o:64600,h:65000,l:64300,c:64900},{o:64900,h:66200,l:64800,c:66000},
  {o:66000,h:66800,l:65700,c:65900},{o:65900,h:66100,l:65200,c:65400},
  {o:65400,h:65700,l:65000,c:65600},{o:65600,h:67100,l:65500,c:66900},
  {o:66900,h:67500,l:66600,c:67200},{o:67200,h:68000,l:67000,c:67800},
  {o:67800,h:68400,l:67500,c:68100},{o:68100,h:68600,l:67800,c:68400},
  {o:68400,h:69200,l:68200,c:69000},{o:69000,h:69400,l:68500,c:68700},
  {o:68700,h:69100,l:68400,c:68900},{o:68900,h:69500,l:68700,c:69300},
  {o:69300,h:70100,l:69100,c:69800},{o:69800,h:70200,l:69500,c:70000},
  {o:70000,h:70800,l:69800,c:70400},{o:70400,h:71200,l:70200,c:71000},
];

const PRICE_MIN = 63000, PRICE_MAX = 71500;
const SVG_W = 600, SVG_H = 200, PAD_Y = 14;
const candleW = Math.floor((SVG_W - 20) / CANDLES.length) - 2;

function priceY(p: number) {
  return PAD_Y + (1 - (p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * (SVG_H - PAD_Y * 2);
}

function simpleEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let e = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    if (i === period - 1) { out.push(e); continue; }
    e = data[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

const closes = CANDLES.map(c => c.c);
const ema9   = simpleEMA(closes, 5);
const ema21  = simpleEMA(closes, 10);

const VOLS = CANDLES.map(() => 2000 + Math.floor(Math.random() * 8000));

function HeroChart() {
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={PAD_Y + f * (SVG_H - PAD_Y * 2)} x2={SVG_W}
          y2={PAD_Y + f * (SVG_H - PAD_Y * 2)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {CANDLES.map((c, i) => {
        const x = 10 + i * (candleW + 2);
        const maxVol = 10000;
        const vh = Math.max(2, (VOLS[i] / maxVol) * 28);
        return (
          <rect key={`v${i}`} x={x} y={SVG_H - vh - 2} width={candleW} height={vh}
            fill={c.c >= c.o ? "rgba(16,185,129,0.16)" : "rgba(239,68,68,0.16)"} rx="1" />
        );
      })}
      {CANDLES.map((c, i) => {
        const x  = 10 + i * (candleW + 2);
        const cx = x + candleW / 2;
        const isUp = c.c >= c.o;
        const color = isUp ? "#10b981" : "#ef4444";
        const bodyTop = priceY(Math.max(c.o, c.c));
        const bodyH   = Math.max(1, priceY(Math.min(c.o, c.c)) - bodyTop);
        return (
          <g key={i}>
            <line x1={cx} y1={priceY(c.h)} x2={cx} y2={priceY(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="0.5" />
          </g>
        );
      })}
      <polyline
        points={ema9.map((v,i) => isNaN(v)?"":
          `${10+i*(candleW+2)+candleW/2},${priceY(v)}`).filter(Boolean).join(" ")}
        fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.85"
      />
      <polyline
        points={ema21.map((v,i) => isNaN(v)?"":
          `${10+i*(candleW+2)+candleW/2},${priceY(v)}`).filter(Boolean).join(" ")}
        fill="none" stroke="#06b6d4" strokeWidth="1.5" opacity="0.85"
      />
    </svg>
  );
}

/* ── Ticker ──────────────────────────────────────────────────────── */
const TICKERS = [
  { sym: "BTC/USD", price: "70,234", chg: "+2.41%", up: true },
  { sym: "ETH/USD", price: "3,851",  chg: "+1.87%", up: true },
  { sym: "EUR/USD", price: "1.0871", chg: "-0.12%", up: false },
  { sym: "XAU/USD", price: "2,312",  chg: "+0.43%", up: true },
  { sym: "SOL/USD", price: "182.40", chg: "+3.21%", up: true },
  { sym: "GBP/USD", price: "1.2634", chg: "-0.08%", up: false },
  { sym: "NAS100",  price: "18,234", chg: "+0.92%", up: true },
  { sym: "SPX500",  price: "5,234",  chg: "+0.54%", up: true },
  { sym: "BNB/USD", price: "601.20", chg: "+1.12%", up: true },
  { sym: "USD/JPY", price: "154.82", chg: "-0.31%", up: false },
];

/* ── Features ────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: CandlestickChart, title: "Live Charts",      color: "text-cyan-400",    glow: "from-cyan-500/20",    desc: "TradingView-style charts with EMA, RSI, MACD. Real-time prices from Binance & Yahoo Finance." },
  { icon: BookOpen,         title: "Trade Journal",    color: "text-violet-400",  glow: "from-violet-500/20",  desc: "Log trades with screenshots, notes, and tags. Searchable calendar with P&L heatmaps." },
  { icon: BarChart2,        title: "Analytics",        color: "text-emerald-400", glow: "from-emerald-500/20", desc: "Win rate, profit factor, expectancy, drawdown curves, and 20+ performance metrics." },
  { icon: Bot,              title: "AI Coach",         color: "text-pink-400",    glow: "from-pink-500/20",    desc: "GPT-powered coaching that reviews your journal, spots patterns, and gives actionable tips." },
  { icon: Zap,              title: "MT5 Bridge",       color: "text-yellow-400",  glow: "from-yellow-500/20",  desc: "Automatic trade sync from MetaTrader 5 via Expert Advisor. Every trade logged instantly." },
  { icon: Calculator,       title: "Risk Calculator",  color: "text-orange-400",  glow: "from-orange-500/20",  desc: "Position size, pip value, and R:R calculator. Never over-leverage a position again." },
];

const EXCHANGES = [
  { name: "Binance",  color: "text-yellow-400" },
  { name: "Bybit",    color: "text-orange-400" },
  { name: "Coinbase", color: "text-blue-400"   },
  { name: "Kraken",   color: "text-violet-400" },
  { name: "OKX",      color: "text-zinc-300"   },
  { name: "MT5",      color: "text-cyan-400"   },
  { name: "cTrader",  color: "text-emerald-400"},
  { name: "Alpaca",   color: "text-red-400"    },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden font-sans">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between
        px-6 py-4 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={groeaxLogo} alt="Groeax logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg tracking-tight">Groeax</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/45">
          <a href="#features" className="hover:text-white/80 transition-colors">Features</a>
          <a href="#brokers" className="hover:text-white/80 transition-colors">Brokers</a>
          <Link href="/pricing" className="hover:text-white/80 transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <button className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all">
              Sign in
            </button>
          </Link>
          <Link href="/signup">
            <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary
              text-primary-foreground text-sm font-semibold hover:bg-primary/90
              transition-all shadow-lg shadow-primary/20">
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center
        pt-24 pb-0 overflow-hidden">

        {/* Background glow orbs */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute top-[-15%] left-[15%] w-[700px] h-[700px] rounded-full bg-violet-700/15 blur-[150px]" />
          <div className="absolute top-[-5%]  right-[10%] w-[500px] h-[500px] rounded-full bg-pink-700/12  blur-[120px]" />
          <div className="absolute top-[40%]  left-[35%] w-[600px] h-[400px] rounded-full bg-cyan-700/8   blur-[130px]" />
          <div className="absolute top-[25%] left-[2%]  w-[300px] h-[300px] rounded-full bg-blue-700/10  blur-[100px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

        {/* Animated beam lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[12, 24, 37, 50, 63, 76, 88].map((pct, i) => (
            <motion.div key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.45, 0] }}
              transition={{ duration: 4 + i * 0.6, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" }}
              className="absolute top-0"
              style={{
                left: `${pct}%`, width: "1px", height: "60%",
                background: `linear-gradient(to bottom, transparent, ${
                  ["#8b5cf6","#ec4899","#06b6d4","#8b5cf6","#ec4899","#06b6d4","#8b5cf6"][i]
                }45, transparent)`,
              }}
            />
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-5xl mx-auto px-6">

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
              bg-white/5 border border-white/10 text-sm text-white/60 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live prices · MT5 bridge · AI coaching
          </motion.div>

          <motion.h1 initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, delay:0.1 }}
            className="text-6xl md:text-[84px] font-black leading-[0.92] tracking-tight mb-7">
            Trade Smarter.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Not Harder.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, delay:0.22 }}
            className="text-lg md:text-xl text-white/42 max-w-2xl mx-auto mb-10 leading-relaxed">
            Professional trading journal with live TradingView-style charts, AI coaching,
            MT5 auto-sync, and institutional analytics — all in one platform.
          </motion.p>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, delay:0.32 }}
            className="flex items-center justify-center gap-4 mb-12 flex-wrap">
            <Link href="/dashboard">
              <button className="px-8 py-4 rounded-xl bg-primary text-primary-foreground
                font-semibold text-[15px] hover:bg-primary/90 transition-all
                shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.99]">
                Start for Free
              </button>
            </Link>
            <Link href="/chart">
              <button className="flex items-center gap-2 px-8 py-4 rounded-xl
                border border-white/10 text-white/65 font-semibold text-[15px]
                hover:bg-white/5 hover:border-white/20 hover:text-white transition-all">
                Open Live Chart <ArrowUpRight className="w-4 h-4" />
              </button>
            </Link>
          </motion.div>

          {/* Ticker strip */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
            className="relative overflow-hidden mb-12 -mx-6">
            <div style={{ display:"flex", width:"max-content", animation:"tickerScroll 35s linear infinite" }}>
              {[...TICKERS, ...TICKERS].map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-2 border-r border-white/5 shrink-0">
                  <span className="text-xs font-mono font-semibold text-white/40">{t.sym}</span>
                  <span className="text-xs font-mono text-white/75">{t.price}</span>
                  <span className={`text-[11px] font-mono font-bold ${t.up ? "text-emerald-400" : "text-red-400"}`}>{t.chg}</span>
                </div>
              ))}
            </div>
            <div className="absolute left-0 inset-y-0 w-16 bg-gradient-to-r from-[#030712] to-transparent pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-16 bg-gradient-to-l from-[#030712] to-transparent pointer-events-none" />
          </motion.div>
        </div>

        {/* Chart preview card */}
        <motion.div initial={{ opacity:0, y:40, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
          transition={{ duration:0.85, delay:0.5 }}
          className="relative z-10 w-full max-w-5xl mx-auto px-6 mb-0">

          <div className="rounded-2xl border border-white/[0.09] bg-[#080c15]/95
            backdrop-blur-xl overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.7)]">

            {/* Window chrome */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.015]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex items-center gap-2 ml-3 bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-1">
                <span className="text-[11px] font-mono text-white/35">BTCUSD • H1 • Live</span>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {["M1","M5","H1","H4","D1"].map(t => (
                  <span key={t} className={`text-[10px] font-mono font-semibold hidden md:inline ${t==="H1" ? "text-primary" : "text-white/22"}`}>{t}</span>
                ))}
                <div className="w-px h-4 bg-white/10" />
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-yellow-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /> BINANCE LIVE
                </span>
              </div>
            </div>

            {/* OHLCV bar */}
            <div className="flex items-center gap-5 px-5 py-2 border-b border-white/[0.04] bg-white/[0.01]">
              {[["O","70,012","text-white/55"],["H","70,204","text-emerald-400"],
                ["L","69,891","text-red-400"],["C","70,156","text-white"],
                ["V","2.4B","text-white/35"]].map(([k,v,cls]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-white/22">{k}</span>
                  <span className={`text-[11px] font-mono font-semibold ${cls}`}>{v}</span>
                </div>
              ))}
              <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] font-mono">
                <span className="text-amber-400/65">● EMA 9</span>
                <span className="text-cyan-400/65">● EMA 21</span>
                <span className="text-purple-400/65">RSI 14</span>
              </div>
            </div>

            {/* Chart SVG */}
            <div className="h-52 px-2 pb-2 pt-1">
              <HeroChart />
            </div>
          </div>

          {/* Glow under card */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-16
            bg-primary/12 blur-3xl rounded-full pointer-events-none" />
        </motion.div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.012] mt-16">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Trading Pairs",    value: "100+",      icon: Globe },
            { label: "Timeframes",       value: "7",         icon: Activity },
            { label: "Live Data",        value: "Real-time", icon: Zap },
            { label: "Exchange Support", value: "8+",        icon: Shield },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="space-y-1.5">
              <Icon className="w-5 h-5 text-primary/50 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-black text-white">{value}</p>
              <p className="text-sm text-white/35">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-4">Everything you need</p>
          <h2 className="text-4xl md:text-5xl font-black leading-tight">
            Built for serious traders.
            <br /><span className="text-white/35">Not hobbyists.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, color, glow }, i) => (
            <motion.div key={title}
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true }} transition={{ delay:i*0.07 }}
              className="relative group p-6 rounded-2xl border border-white/[0.06]
                bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-px bg-gradient-to-r ${glow} to-transparent`} />
              <Icon className={`w-6 h-6 mb-4 ${color}`} />
              <h3 className="text-[15px] font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Exchanges ────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.012] py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs text-white/28 uppercase tracking-widest font-bold mb-8">
            Connect your exchange or broker
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {EXCHANGES.map(({ name, color }) => (
              <div key={name}
                className="px-5 py-2.5 rounded-xl border border-white/[0.07]
                  bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/[0.13] transition-all cursor-default">
                <span className={`text-sm font-bold ${color}`}>{name}</span>
              </div>
            ))}
          </div>
          <Link href="/brokers">
            <button className="mt-8 flex items-center gap-1.5 mx-auto text-sm text-white/35
              hover:text-white/60 transition-colors">
              View all integrations <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
          viewport={{ once:true }}
          className="relative rounded-3xl border border-white/[0.07]
            bg-gradient-to-br from-white/[0.035] to-white/[0.01]
            overflow-hidden px-8 md:px-16 py-16 text-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[600px] h-[300px] bg-primary/8 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black mb-5">Your edge starts here.</h2>
            <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
            Join traders who use Groeax to review every trade, fix every mistake, and grow every month.
            </p>
            <Link href="/dashboard">
              <button className="px-10 py-4 rounded-xl bg-primary text-primary-foreground
                font-bold text-[15px] hover:bg-primary/90 transition-all
                shadow-2xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.99]">
                Start Free — No card required
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-8 text-center">
        <p className="text-white/18 text-sm">© 2026 Groeax. Professional trading tools for serious traders.</p>
      </footer>

      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
