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
  Radio,
  Flame,
  BarChart2,
  ChevronRight,
  Clock,
} from "lucide-react";

interface IntelligenceEvent {
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
}

const SENTIMENT_CONFIG = {
  bullish:  { label: "BULLISH",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20", icon: TrendingUp },
  bearish:  { label: "BEARISH",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     glow: "shadow-red-500/20",     icon: TrendingDown },
  neutral:  { label: "NEUTRAL",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    glow: "shadow-blue-500/20",    icon: Activity },
  volatile: { label: "VOLATILE", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   glow: "shadow-amber-500/20",   icon: Zap },
};

const CATEGORY_COLORS: Record<string, string> = {
  Crypto:      "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Forex:       "text-blue-400   bg-blue-500/10   border-blue-500/20",
  Commodities: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  Energy:      "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Equities:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Macro:       "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function ImpactBar({ score, sentiment }: { score: number; sentiment: string }) {
  const colors: Record<string, string> = {
    bullish: "from-emerald-500 to-emerald-400",
    bearish: "from-red-500 to-red-400",
    volatile: "from-amber-500 to-amber-400",
    neutral: "from-blue-500 to-blue-400",
  };
  const gradient = colors[sentiment] ?? colors.neutral;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
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
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
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

function EventCard({ event, index }: { event: IntelligenceEvent; index: number }) {
  const s = SENTIMENT_CONFIG[event.sentiment] ?? SENTIMENT_CONFIG.neutral;
  const SIcon = s.icon;
  const catCls = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Macro;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`relative rounded-2xl border bg-white/[0.02] overflow-hidden transition-all hover:bg-white/[0.04] group ${
        event.isBreaking
          ? "border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.12)]"
          : event.isMarketShift
          ? "border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
          : "border-white/8"
      }`}
    >
      {/* Top glow strip */}
      <div className={`absolute inset-x-0 top-0 h-px ${
        event.isBreaking ? "bg-gradient-to-r from-transparent via-red-500 to-transparent" :
        event.isMarketShift ? "bg-gradient-to-r from-transparent via-amber-400 to-transparent" :
        `bg-gradient-to-r from-transparent via-white/10 to-transparent`
      }`} />

      {/* Breaking / Market Shift badges */}
      {(event.isBreaking || event.isMarketShift) && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          {event.isBreaking && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse uppercase tracking-wider">
              <Flame className="w-2.5 h-2.5" /> Breaking
            </span>
          )}
          {event.isMarketShift && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase tracking-wider">
              <AlertTriangle className="w-2.5 h-2.5" /> Shift
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 pr-24">
          {/* Sentiment icon */}
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 border ${s.bg} ${s.border} shadow-lg ${s.glow}`}>
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

        {/* AI Summary */}
        <p className="text-xs text-white/50 mt-2.5 leading-relaxed">{event.aiSummary}</p>

        {/* Metrics row */}
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
                <span className="text-[10px] text-white/55">{event.confidenceScore >= 80 ? "High" : event.confidenceScore >= 60 ? "Med" : "Low"}</span>
              </div>
            </div>
            <ConfidenceRing score={event.confidenceScore} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            {event.sources.map((src) => (
              <span key={src} className="text-[8px] text-white/25 px-1.5 py-0.5 rounded border border-white/8 bg-white/[0.02]">{src}</span>
            ))}
          </div>
          <div className="flex items-center gap-1 text-white/25">
            <Clock className="w-3 h-3" />
            <span className="text-[9px]">{fmtRelative(event.timestamp)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-2.5 text-center">
      <p className={`text-base font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

export default function Intelligence() {
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [tick, setTick] = useState(0);

  const fetchFeed = useCallback(async () => {
    setError(null);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/intelligence/feed`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: IntelligenceEvent[] = await res.json();
      setEvents(data);
      setLastUpdated(new Date());
    } catch {
      setError("Intelligence feed unavailable. Retrying…");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(() => {
      fetchFeed();
      setTick((t) => t + 1);
    }, 20_000);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const categories = [...new Set(events.map((e) => e.category))];
  const filtered = events.filter((e) => {
    const sentOk = filterSentiment === "all" || e.sentiment === filterSentiment;
    const catOk = filterCategory === "all" || e.category === filterCategory;
    return sentOk && catOk;
  });

  const breakingCount = events.filter((e) => e.isBreaking).length;
  const shiftCount = events.filter((e) => e.isMarketShift).length;
  const avgImpact = events.length ? Math.round(events.reduce((s, e) => s + e.impactScore, 0) / events.length) : 0;
  const avgConf = events.length ? Math.round(events.reduce((s, e) => s + e.confidenceScore, 0) / events.length) : 0;

  return (
    <div className="p-5 max-w-5xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.2)]">
            <Brain className="w-5 h-5 text-violet-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white/90">Intelligence Core</h1>
            <p className="text-xs text-white/35 mt-0.5">
              AI-fused market signals · Live fusion every 20s
              {lastUpdated && <span className="ml-2">· {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => { setLoading(true); fetchFeed(); }}
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
        <div className="grid grid-cols-4 gap-2">
          <StatPill label="Events" value={events.length} color="text-white/90" />
          <StatPill label="Breaking" value={breakingCount} color={breakingCount > 0 ? "text-red-400" : "text-white/40"} />
          <StatPill label="Avg Impact" value={avgImpact} color={avgImpact > 70 ? "text-amber-400" : "text-white/60"} />
          <StatPill label="Avg Confidence" value={`${avgConf}%`} color={avgConf >= 70 ? "text-emerald-400" : "text-white/60"} />
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/8">
          {["all", "bullish", "bearish", "volatile", "neutral"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSentiment(s)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg capitalize transition-colors ${
                filterSentiment === s ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60"
              }`}
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
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && events.length === 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-16 text-center">
          <Brain className="w-8 h-8 text-violet-400 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-white/45">Running intelligence fusion pipeline…</p>
          <p className="text-xs text-white/25 mt-1">Clustering signals from multiple feeds</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && events.length === 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Feed error</p>
            <p className="text-xs text-white/35 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Intelligence Feed ───────────────────────────────────────────── */}
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

      {/* ── Live ticker footer ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-white/25">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[10px]">Live · Fusing every 20s · {events.length} clusters detected</span>
        </div>
        <span className="text-[10px] text-white/20">TradeLog Intelligence OS v1.0</span>
      </div>
    </div>
  );
}
