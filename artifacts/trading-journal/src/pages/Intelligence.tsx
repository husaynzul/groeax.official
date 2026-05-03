import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  RefreshCw,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Flame,
  Clock,
  Globe,
  CheckCircle,
  XCircle,
  BarChart2,
  Radar,
  Layers,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface VerificationResult {
  verified: boolean;
  trustScore: number;
  sourceTier: 1 | 2 | 3;
  reason: string;
  label: string;
}

interface PairImpact {
  pair: string;
  impactDirection: "bullish" | "bearish" | "volatile" | "neutral";
  impactStrength: number;
  expectedMove: "low" | "medium" | "high";
}

interface PairIntelligenceResult {
  affectedPairs: PairImpact[];
  expectedVolatility: "LOW" | "MEDIUM" | "HIGH";
  estimatedMovePercent: "0-1%" | "1-3%" | "3-8%" | "8%+";
}

interface EnhancedEvent {
  id: string;
  eventTitle: string;
  category: string;
  sources: string[];
  sentiment: "bullish" | "bearish" | "neutral" | "volatile";
  impactScore: number;
  confidenceScore: number;
  timestamp: number;
  aiSummary: string;
  isBreaking: boolean;
  isMarketShift: boolean;
  tags: string[];
  asset: string;
  verification: VerificationResult;
  pairAnalysis: PairIntelligenceResult;
}

interface TimeZoneClocks {
  EST: string;
  UTC: string;
  GMT: string;
  ASIA: string;
  PKT: string;
}

interface SessionInfo {
  currentSession: string;
  volatilityExpectation: "LOW" | "HIGH";
  activeMarkets: string[];
  nextSession: string;
  minutesToNextSession: number;
  sessionProgress: number;
  clocks: TimeZoneClocks;
  isOverlap: boolean;
}

interface MatrixCell {
  pair: string;
  direction: "bullish" | "bearish" | "volatile" | "neutral";
  strength: number;
}

interface PairMatrix {
  pairs: string[];
  assets: string[];
  cells: Record<string, Record<string, MatrixCell>>;
}

interface MarketIntelligenceResponse {
  session: SessionInfo;
  events: EnhancedEvent[];
  pairMatrix: PairMatrix;
  generatedAt: number;
}

// ── Config ────────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  bullish:  { label: "BULLISH",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: TrendingUp },
  bearish:  { label: "BEARISH",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     icon: TrendingDown },
  neutral:  { label: "NEUTRAL",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    icon: Activity },
  volatile: { label: "VOLATILE", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   icon: Zap },
};

const CATEGORY_COLORS: Record<string, string> = {
  Crypto:      "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Forex:       "text-blue-400   bg-blue-500/10   border-blue-500/20",
  Commodities: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  Energy:      "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Equities:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Macro:       "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

const SESSION_COLORS: Record<string, string> = {
  "London":           "text-blue-400 bg-blue-500/15 border-blue-500/25",
  "New York":         "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
  "Asia":             "text-violet-400 bg-violet-500/15 border-violet-500/25",
  "London-NY Overlap":"text-amber-400 bg-amber-500/15 border-amber-500/25",
  "NY-Asia Overlap":  "text-orange-400 bg-orange-500/15 border-orange-500/25",
  "Off-Hours":        "text-slate-400 bg-slate-500/10 border-slate-500/15",
};

const DIRECTION_CELL: Record<string, { bg: string; text: string; symbol: string }> = {
  bullish:  { bg: "bg-emerald-500/15", text: "text-emerald-400", symbol: "▲" },
  bearish:  { bg: "bg-red-500/15",     text: "text-red-400",     symbol: "▼" },
  volatile: { bg: "bg-amber-500/15",   text: "text-amber-400",   symbol: "⚡" },
  neutral:  { bg: "bg-white/[0.03]",   text: "text-white/25",    symbol: "—" },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────

function ImpactBar({ score, sentiment }: { score: number; sentiment: string }) {
  const colors: Record<string, string> = {
    bullish: "from-emerald-500 to-emerald-400",
    bearish: "from-red-500 to-red-400",
    volatile: "from-amber-500 to-amber-400",
    neutral: "from-blue-500 to-blue-400",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${colors[sentiment] ?? colors.neutral}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-bold text-white/60 w-8 text-right">{score}</span>
    </div>
  );
}

function ConfidenceRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#6b7280";
  const r = 14, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <svg width="40" height="40" className="rotate-[-90deg]">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[9px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function TrustBadge({ v }: { v: VerificationResult }) {
  const tierColor =
    v.sourceTier === 1 ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" :
    v.sourceTier === 2 ? "text-blue-400 bg-blue-500/15 border-blue-500/30" :
    "text-slate-400 bg-slate-500/10 border-slate-500/20";
  return (
    <div className="flex items-center gap-1.5">
      {v.verified
        ? <CheckCircle className="w-3 h-3 text-emerald-400" />
        : <XCircle className="w-3 h-3 text-slate-500" />}
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${tierColor}`}>
        {v.label}
      </span>
      <span className="text-[9px] text-white/30">{v.trustScore}% trust</span>
    </div>
  );
}

function EventCard({ event, index }: { event: EnhancedEvent; index: number }) {
  const s = SENTIMENT_CONFIG[event.sentiment] ?? SENTIMENT_CONFIG.neutral;
  const SIcon = s.icon;
  const catCls = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Macro;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`relative rounded-2xl border bg-white/[0.02] overflow-hidden hover:bg-white/[0.035] group ${
        event.isBreaking ? "border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.12)]" :
        event.isMarketShift ? "border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.08)]" :
        !event.verification.verified ? "border-white/5 opacity-75" :
        "border-white/8"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-px ${
        event.isBreaking ? "bg-gradient-to-r from-transparent via-red-500 to-transparent" :
        event.isMarketShift ? "bg-gradient-to-r from-transparent via-amber-400 to-transparent" :
        "bg-gradient-to-r from-transparent via-white/10 to-transparent"
      }`} />

      {(event.isBreaking || event.isMarketShift) && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          {event.isBreaking && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse uppercase">
              <Flame className="w-2.5 h-2.5" /> Breaking
            </span>
          )}
          {event.isMarketShift && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase">
              <AlertTriangle className="w-2.5 h-2.5" /> Shift
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3 pr-24">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 border ${s.bg} ${s.border}`}>
            <SIcon className={`w-4 h-4 ${s.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${catCls}`}>{event.category}</span>
              {event.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-[9px] text-white/30 font-mono">{tag}</span>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-white/90 leading-snug">{event.eventTitle}</h3>
          </div>
        </div>

        <p className="text-xs text-white/50 mt-2.5 leading-relaxed">{event.aiSummary}</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">Impact</span>
              <span className={`text-[9px] font-bold uppercase ${s.color}`}>{event.sentiment}</span>
            </div>
            <ImpactBar score={event.impactScore} sentiment={event.sentiment} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Confidence</p>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/55">
                  {event.confidenceScore >= 80 ? "High" : event.confidenceScore >= 60 ? "Med" : "Low"}
                </span>
              </div>
            </div>
            <ConfidenceRing score={event.confidenceScore} />
          </div>
        </div>

        {/* Volatility + pair count */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
            event.pairAnalysis.expectedVolatility === "HIGH" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
            event.pairAnalysis.expectedVolatility === "MEDIUM" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
            "text-slate-400 bg-slate-500/10 border-slate-500/20"
          }`}>
            {event.pairAnalysis.expectedVolatility} VOL · {event.pairAnalysis.estimatedMovePercent}
          </span>
          <span className="text-[9px] text-white/25">{event.pairAnalysis.affectedPairs.length} pairs affected</span>
        </div>

        {/* Verification + footer */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <TrustBadge v={event.verification} />
          <div className="flex items-center gap-1 text-white/25">
            <Clock className="w-3 h-3" />
            <span className="text-[9px]">{fmtRelative(event.timestamp)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Global Market Time Panel ──────────────────────────────────────────────

function MarketTimePanel({ session }: { session: SessionInfo }) {
  const sessionCls = SESSION_COLORS[session.currentSession] ?? SESSION_COLORS["Off-Hours"];
  const tzRows: Array<{ label: string; tz: keyof typeof session.clocks; market: string }> = [
    { label: "EST", tz: "EST",  market: "New York" },
    { label: "UTC", tz: "UTC",  market: "Reference" },
    { label: "GMT", tz: "GMT",  market: "London" },
    { label: "TYO", tz: "ASIA", market: "Tokyo" },
    { label: "PKT", tz: "PKT",  market: "Karachi" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Global Market Clock</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${sessionCls}`}>
            {session.currentSession}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            session.volatilityExpectation === "HIGH"
              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
              : "text-slate-400 bg-slate-500/10 border-slate-500/15"
          }`}>
            {session.volatilityExpectation} VOL
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/6">
        {/* Time zone clocks */}
        <div className="p-4">
          <p className="text-[9px] text-white/30 uppercase tracking-wider mb-3">Live Clocks</p>
          <div className="space-y-2">
            {tzRows.map(({ label, tz, market }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-white/30 w-8">{label}</span>
                  <span className="text-[10px] text-white/20">{market}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-white/85">{session.clocks[tz]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Session progress */}
        <div className="p-4">
          <p className="text-[9px] text-white/30 uppercase tracking-wider mb-3">Session Progress</p>
          <div className="space-y-3">
            {[
              { name: "Asia",     active: session.currentSession.includes("Asia"),     open: "00:00", close: "09:00 UTC" },
              { name: "London",   active: session.currentSession.includes("London"),   open: "08:00", close: "16:00 UTC" },
              { name: "New York", active: session.currentSession.includes("New York"), open: "13:00", close: "22:00 UTC" },
            ].map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-semibold ${s.active ? "text-white/80" : "text-white/30"}`}>{s.name}</span>
                  <span className="text-[9px] text-white/20">{s.open}–{s.close}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  {s.active && (
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${session.sessionProgress}%` }}
                      transition={{ duration: 1 }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active markets */}
        <div className="p-4">
          <p className="text-[9px] text-white/30 uppercase tracking-wider mb-3">Active Markets</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {session.activeMarkets.map((m) => (
              <span key={m} className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary/80 border border-primary/20">{m}</span>
            ))}
          </div>
          {session.isOverlap && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-[10px] font-bold text-amber-400">⚡ Overlap Session Active</p>
              <p className="text-[9px] text-white/35 mt-0.5">Highest liquidity period — expect large moves</p>
            </div>
          )}
          {!session.isOverlap && (
            <p className="text-[9px] text-white/25">Next: <span className="text-white/45 font-medium">{session.nextSession}</span> in {session.minutesToNextSession}m</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Pair Impact Matrix ────────────────────────────────────────────────────

function PairImpactMatrix({ matrix }: { matrix: PairMatrix }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
        <Layers className="w-4 h-4 text-violet-400" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Pair Impact Matrix</h2>
        <span className="ml-auto text-[9px] text-white/25">News → Pair directional impact</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-2.5 text-white/30 font-medium uppercase tracking-wider w-24">Asset</th>
              {matrix.pairs.map((pair) => (
                <th key={pair} className="px-2 py-2.5 text-white/30 font-medium text-center min-w-[72px]">
                  <span className="font-mono text-[9px]">{pair}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.assets.map((asset, ai) => (
              <tr key={asset} className={`border-b border-white/[0.04] ${ai % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-4 py-2">
                  <span className="font-bold text-white/70 font-mono">{asset}</span>
                </td>
                {matrix.pairs.map((pair) => {
                  const cell = matrix.cells[asset]?.[pair];
                  const cfg = DIRECTION_CELL[cell?.direction ?? "neutral"];
                  return (
                    <td key={pair} className="px-2 py-2 text-center">
                      <div className={`inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[58px] ${cfg.bg}`}>
                        <span className={`text-sm leading-none ${cfg.text}`}>{cfg.symbol}</span>
                        {cell && cell.strength > 0 && (
                          <span className={`text-[8px] mt-0.5 ${cfg.text} opacity-70`}>{cell.strength}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-4 text-[9px] text-white/25">
        <span className="flex items-center gap-1"><span className="text-emerald-400 font-bold">▲</span> Bullish impact</span>
        <span className="flex items-center gap-1"><span className="text-red-400 font-bold">▼</span> Bearish impact</span>
        <span className="flex items-center gap-1"><span className="text-amber-400 font-bold">⚡</span> High volatility</span>
        <span className="flex items-center gap-1"><span className="text-white/20 font-bold">—</span> Neutral / no data</span>
      </div>
    </motion.div>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-2.5 text-center">
      <p className={`text-base font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function Intelligence() {
  const [data, setData] = useState<MarketIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "matrix">("feed");

  const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/market-intelligence`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MarketIntelligenceResponse = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      setError("Intelligence feed unavailable. Retrying…");
    } finally {
      setLoading(false);
    }
  }, [BASE]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 20_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const events = data?.events ?? [];
  const categories = [...new Set(events.map((e) => e.category))];

  const filtered = events.filter((e) => {
    const sentOk = filterSentiment === "all" || e.sentiment === filterSentiment;
    const catOk = filterCategory === "all" || e.category === filterCategory;
    const verOk = !filterVerified || e.verification.verified;
    return sentOk && catOk && verOk;
  });

  const breakingCount = events.filter((e) => e.isBreaking).length;
  const shiftCount = events.filter((e) => e.isMarketShift).length;
  const verifiedCount = events.filter((e) => e.verification.verified).length;
  const avgImpact = events.length ? Math.round(events.reduce((s, e) => s + e.impactScore, 0) / events.length) : 0;
  const avgConf = events.length ? Math.round(events.reduce((s, e) => s + e.confidenceScore, 0) / events.length) : 0;

  return (
    <div className="p-5 max-w-6xl space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.2)]">
            <Brain className="w-5 h-5 text-violet-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white/90">Global AI Intelligence OS</h1>
            <p className="text-xs text-white/35 mt-0.5">
              Multi-pair · Verified news · Session-aware · Live fusion every 20s
              {lastUpdated && <span className="ml-2">· {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {breakingCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 animate-pulse">
              <Flame className="w-3 h-3" /> {breakingCount} Breaking
            </span>
          )}
          {shiftCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3" /> {shiftCount} Shift{shiftCount > 1 ? "s" : ""}
            </span>
          )}
          {data?.session && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${SESSION_COLORS[data.session.currentSession] ?? SESSION_COLORS["Off-Hours"]}`}>
              {data.session.currentSession}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg border border-white/8 hover:border-primary/30 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Strip ─────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatPill label="Events" value={events.length} color="text-white/90" />
          <StatPill label="Breaking" value={breakingCount} color={breakingCount > 0 ? "text-red-400" : "text-white/40"} />
          <StatPill label="Verified" value={verifiedCount} color="text-emerald-400" />
          <StatPill label="Avg Impact" value={avgImpact} color={avgImpact > 70 ? "text-amber-400" : "text-white/60"} />
          <StatPill label="Avg Confidence" value={`${avgConf}%`} color={avgConf >= 70 ? "text-emerald-400" : "text-white/60"} />
        </div>
      )}

      {/* ── Global Market Time Panel ─────────────────────────────────────── */}
      {data?.session && <MarketTimePanel session={data.session} />}

      {/* ── Tab Nav ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/8 w-fit">
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${activeTab === "feed" ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60"}`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Verified News Feed
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${activeTab === "matrix" ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60"}`}
        >
          <Radar className="w-3.5 h-3.5" /> Pair Impact Matrix
        </button>
      </div>

      {/* ── Pair Impact Matrix Tab ───────────────────────────────────────── */}
      {activeTab === "matrix" && data?.pairMatrix && (
        <PairImpactMatrix matrix={data.pairMatrix} />
      )}

      {/* ── Verified News Feed Tab ───────────────────────────────────────── */}
      {activeTab === "feed" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/8">
              {["all", "bullish", "bearish", "volatile", "neutral"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSentiment(s)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg capitalize transition-colors ${filterSentiment === s ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60"}`}
                >
                  {s === "all" ? "All Signals" : s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/8">
              <button
                onClick={() => setFilterCategory("all")}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${filterCategory === "all" ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60"}`}
              >
                All Markets
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${filterCategory === cat ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFilterVerified((v) => !v)}
              className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${filterVerified ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-white/[0.03] text-white/35 border-white/8 hover:text-white/60"}`}
            >
              <CheckCircle className="w-3 h-3" /> Verified only
            </button>
          </div>

          {/* Loading */}
          {loading && events.length === 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-16 text-center">
              <Brain className="w-8 h-8 text-violet-400 mx-auto mb-3 animate-pulse" />
              <p className="text-sm text-white/45">Running intelligence fusion pipeline…</p>
              <p className="text-xs text-white/25 mt-1">Clustering · verifying · mapping pairs</p>
            </div>
          )}

          {/* Error */}
          {error && events.length === 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Feed error</p>
                <p className="text-xs text-white/35 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Event cards */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AnimatePresence>
                {filtered.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {!loading && filtered.length === 0 && events.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center text-white/35 text-sm">
              No events match the current filters.
            </div>
          )}
        </>
      )}

      {/* ── Live footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-white/25">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[10px]">Live · Fusing every 20s · {events.length} clusters · {verifiedCount} verified</span>
        </div>
        <span className="text-[10px] text-white/20">Groeax Intelligence OS v2.0</span>
      </div>
    </div>
  );
}
