import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO, isToday, isTomorrow, isPast, differenceInMinutes } from "date-fns";
import { Newspaper, RefreshCw, AlertTriangle, Clock, Filter, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CalEvent {
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast?: string;
  previous?: string;
  actual?: string;
}

type NewsTimezone = "PKT" | "IST" | "GST" | "UK" | "EST" | "PST";

const IMPACT_CONFIG = {
  High:    { color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/30",    dot: "bg-red-400",    label: "HIGH"   },
  Medium:  { color: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/30",  dot: "bg-amber-400",  label: "MED"    },
  Low:     { color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30",   dot: "bg-blue-400",   label: "LOW"    },
  Holiday: { color: "text-muted-foreground", bg: "bg-secondary/30", border: "border-border", dot: "bg-muted-foreground", label: "HOL" },
};

const MAJOR_CURRENCIES = ["ALL", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
const TIME_ZONE_GROUPS = [
  { value: "all", label: "All Time Zones" },
  { value: "asia", label: "Asia" },
  { value: "india", label: "India" },
  { value: "pakistan", label: "Pakistan" },
  { value: "japan", label: "Japan" },
  { value: "china", label: "China" },
  { value: "singapore", label: "Singapore" },
];

const NEWS_TIMEZONES: Array<{ value: NewsTimezone; label: string; display: string; tz: string }> = [
  { value: "PKT", label: "Pakistan (PKT)", display: "PKT", tz: "Asia/Karachi" },
  { value: "IST", label: "India (IST)", display: "IST", tz: "Asia/Kolkata" },
  { value: "GST", label: "UAE (GST)", display: "GST", tz: "Asia/Dubai" },
  { value: "UK", label: "UK (GMT/BST)", display: "UK", tz: "Europe/London" },
  { value: "EST", label: "USA (EST)", display: "EST", tz: "America/New_York" },
  { value: "PST", label: "USA (PST)", display: "PST", tz: "America/Los_Angeles" },
];

const FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿",
  CNY: "🇨🇳", KRW: "🇰🇷", SGD: "🇸🇬",
};

function getFlag(country: string) {
  return FLAG[country] ?? "🌐";
}

function fmtTZ(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return format(date, "HH:mm");
  }
}

function fmtEventTime(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, "HH:mm");
  } catch { return "--:--"; }
}

function fmtEventDay(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEE, MMM d");
  } catch { return "Unknown"; }
}

function timeUntil(dateStr: string): string | null {
  try {
    const d = parseISO(dateStr);
    if (isPast(d)) return null;
    const mins = differenceInMinutes(d, new Date());
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 24) return `${hrs}h ${rem}m`;
    return null;
  } catch { return null; }
}

function groupByDay(events: CalEvent[]): Record<string, CalEvent[]> {
  const groups: Record<string, CalEvent[]> = {};
  events.forEach((e) => {
    const key = fmtEventDay(e.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
}

export default function News() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterImpact, setFilterImpact] = useState<string>("High");
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [filterTimeZone, setFilterTimeZone] = useState<string>("all");
  const [selectedTimezone, setSelectedTimezone] = useState<NewsTimezone>("PKT");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const basePath = (await import("@/lib/apiBase")).getApiBase();
      const res = await fetch(`${basePath}/api/news/calendar`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CalEvent[] = await res.json();
      const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(sorted);
      setLastUpdated(new Date());
    } catch {
      setError("Unable to load economic calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filtered = events.filter((e) => {
    const impactMatch = filterImpact === "all" ? true : e.impact === filterImpact;
    const currencyMatch = filterCurrency === "all" || filterCurrency === "ALL" ? true : e.country === filterCurrency;
    const timeZoneMatch =
      filterTimeZone === "all"
        ? true
        : filterTimeZone === "asia"
          ? ["INR", "PKR", "JPY", "CNY", "SGD"].includes(e.country)
          : filterTimeZone === "india"
            ? e.country === "INR"
            : filterTimeZone === "pakistan"
              ? e.country === "PKR"
              : filterTimeZone === "japan"
                ? e.country === "JPY"
                : filterTimeZone === "china"
                  ? e.country === "CNY"
                  : filterTimeZone === "singapore"
                    ? e.country === "SGD"
                    : true;
    return impactMatch && currencyMatch && timeZoneMatch;
  });

  const grouped = groupByDay(filtered);
  const groupKeys = Object.keys(grouped);
  const selectedTz = useMemo(
    () => NEWS_TIMEZONES.find((tz) => tz.value === selectedTimezone) ?? NEWS_TIMEZONES[0],
    [selectedTimezone]
  );

  const highImpactCount = events.filter(
    (e) => e.impact === "High" && !isPast(parseISO(e.date))
  ).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Market News</h1>
            <p className="text-xs text-muted-foreground">
              Economic calendar · Live forex events this week
              {lastUpdated && (
                <span className="ml-2 text-muted-foreground/50">
                  Updated {format(lastUpdated, "HH:mm")}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highImpactCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {highImpactCount} high-impact upcoming
            </span>
          )}
          <button
            onClick={fetchNews}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
          <Filter className="w-3 h-3 text-muted-foreground ml-1.5" />
          { ["all", "High", "Medium", "Low"].map((v) => (
            <button
              key={v}
              onClick={() => setFilterImpact(v)}
              className={`text-xs px-3 py-1 rounded-md transition-colors font-medium ${
                filterImpact === v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "all" ? "All" : v}
              {v === "High" && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-400 align-middle" />}
              {v === "Medium" && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" />}
              {v === "Low" && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 align-middle" />}
            </button>
          )) }
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
          <Globe className="w-3 h-3 text-muted-foreground ml-1.5" />
          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="text-xs bg-transparent text-muted-foreground px-2 py-1 focus:outline-none"
          >
            <option value="all">All Time Zones</option>
            {MAJOR_CURRENCIES.filter((c) => c !== "ALL").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
          <Globe className="w-3 h-3 text-muted-foreground ml-1.5" />
          <select
            value={filterTimeZone}
            onChange={(e) => setFilterTimeZone(e.target.value)}
            className="text-xs bg-transparent text-muted-foreground px-2 py-1 focus:outline-none"
          >
            {TIME_ZONE_GROUPS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
          <Clock className="w-3 h-3 text-muted-foreground ml-1.5" />
          <select
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value as NewsTimezone)}
            className="text-xs bg-transparent text-muted-foreground px-2 py-1 focus:outline-none"
          >
            {NEWS_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="glass-card p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading economic calendar…</p>
        </div>
      )}

      {error && !loading && (
        <div className="glass-card p-6 flex items-start gap-3 border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Could not load calendar</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button
              onClick={fetchNews}
              className="text-xs text-primary hover:underline mt-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-5">
          {groupKeys.length === 0 ? (
            <div className="glass-card p-10 text-center text-muted-foreground text-sm">
              No events match the current filters.
            </div>
          ) : (
            groupKeys.map((day) => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    day === "Today"
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary/60 text-muted-foreground"
                  }`}>
                    {day}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground">{grouped[day].length} events</span>
                </div>

                <div className="space-y-1.5">
                  {grouped[day].map((ev, i) => {
                    const cfg = IMPACT_CONFIG[ev.impact] ?? IMPACT_CONFIG.Low;
                    const until = timeUntil(ev.date);
                    const past = isPast(parseISO(ev.date));
                    const hasActual = !!ev.actual;
                    const utcDate = parseISO(ev.date);

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          past ? "opacity-50" : ""
                        } ${
                          ev.impact === "High" && !past
                            ? "bg-red-500/5 border-red-500/20 hover:border-red-500/35"
                            : "bg-card border-border hover:border-border/80"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${ev.impact === "High" && !past ? "animate-pulse" : ""}`} />
                        <div className="w-16 text-center shrink-0">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">UTC</p>
                          <p className="text-xs font-mono font-semibold text-foreground">{fmtTZ(utcDate, "UTC")}</p>
                          <p className="text-[9px] text-emerald-400/80 font-bold">{until ?? "Now"}</p>
                        </div>
                        <div className="w-16 text-center shrink-0">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">PKT</p>
                          <p className="text-xs font-mono font-semibold text-foreground">{fmtTZ(utcDate, "Asia/Karachi")}</p>
                        </div>
                        <div className="w-16 text-center shrink-0">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">IST</p>
                          <p className="text-xs font-mono font-semibold text-foreground">{fmtTZ(utcDate, "Asia/Kolkata")}</p>
                        </div>
                        <div className="w-16 text-center shrink-0">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{selectedTz.display}</p>
                          <p className="text-xs font-mono font-semibold text-primary">{fmtTZ(utcDate, selectedTz.tz)}</p>
                        </div>
                        <div className="w-10 text-center shrink-0">
                          <span className="text-base">{getFlag(ev.country)}</span>
                          <p className="text-[9px] font-bold text-muted-foreground">{ev.country}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                          {ev.forecast && (
                            <div className="text-center">
                              <p className="text-[8px] text-muted-foreground">Forecast</p>
                              <p className="text-[10px] font-semibold text-foreground">{ev.forecast}</p>
                            </div>
                          )}
                          {hasActual ? (
                            <div className="text-center">
                              <p className="text-[8px] text-muted-foreground">Actual</p>
                              <p className={`text-[10px] font-bold ${
                                ev.actual && ev.forecast
                                  ? parseFloat(ev.actual) >= parseFloat(ev.forecast)
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                  : "text-foreground"
                              }`}>{ev.actual}</p>
                            </div>
                          ) : ev.previous && (
                            <div className="text-center">
                              <p className="text-[8px] text-muted-foreground">Previous</p>
                              <p className="text-[10px] text-muted-foreground">{ev.previous}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground/40 mt-6">
        Data from ForexFactory · Refreshes every 5 minutes · Times shown in UTC and selected zones
      </p>
    </div>
  );
}
