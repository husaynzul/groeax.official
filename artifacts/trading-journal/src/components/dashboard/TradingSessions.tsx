import { useEffect, useState } from "react";
import { TradingSession } from "@/types";
import { Clock } from "lucide-react";

interface TZInfo {
  city: string;
  iana: string;
  abbr: string;
}

const SESSIONS: {
  id: TradingSession;
  label: string;
  flag: string;
  color: string;
  glow: string;
  startUTC: number;
  endUTC: number;
  tzones: TZInfo[];
}[] = [
  {
    id: "ASIA",
    label: "Asia",
    flag: "🌏",
    color: "text-cyan-400",
    glow: "shadow-cyan-500/40",
    startUTC: 23,
    endUTC: 8,
    tzones: [
      { city: "Hong Kong", iana: "Asia/Hong_Kong",  abbr: "HKT"  },
      { city: "Singapore", iana: "Asia/Singapore",  abbr: "SGT"  },
      { city: "Sydney",    iana: "Australia/Sydney", abbr: "AEDT" },
    ],
  },
  {
    id: "TOKYO",
    label: "Tokyo",
    flag: "🗼",
    color: "text-violet-400",
    glow: "shadow-violet-500/40",
    startUTC: 0,
    endUTC: 9,
    tzones: [
      { city: "Tokyo",  iana: "Asia/Tokyo", abbr: "JST" },
      { city: "Seoul",  iana: "Asia/Seoul", abbr: "KST" },
      { city: "Osaka",  iana: "Asia/Tokyo", abbr: "JST" },
    ],
  },
  {
    id: "LONDON",
    label: "London",
    flag: "🇬🇧",
    color: "text-blue-400",
    glow: "shadow-blue-500/40",
    startUTC: 8,
    endUTC: 17,
    tzones: [
      { city: "London",    iana: "Europe/London", abbr: "GMT"  },
      { city: "Frankfurt", iana: "Europe/Berlin", abbr: "CET"  },
      { city: "Zurich",    iana: "Europe/Zurich", abbr: "CET"  },
    ],
  },
  {
    id: "NEW_YORK",
    label: "New York",
    flag: "🗽",
    color: "text-emerald-400",
    glow: "shadow-emerald-500/40",
    startUTC: 13,
    endUTC: 22,
    tzones: [
      { city: "New York", iana: "America/New_York", abbr: "EST"  },
      { city: "Chicago",  iana: "America/Chicago",  abbr: "CST"  },
      { city: "Toronto",  iana: "America/Toronto",  abbr: "EST"  },
    ],
  },
];

function isSessionActive(startUTC: number, endUTC: number, utcHour: number): boolean {
  if (startUTC < endUTC) return utcHour >= startUTC && utcHour < endUTC;
  return utcHour >= startUTC || utcHour < endUTC;
}

function sessionProgress(startUTC: number, endUTC: number, utcHour: number, utcMin: number): number {
  const totalMins = (endUTC > startUTC ? endUTC - startUTC : 24 - startUTC + endUTC) * 60;
  let elapsed = 0;
  if (startUTC <= endUTC) {
    elapsed = (utcHour - startUTC) * 60 + utcMin;
  } else {
    elapsed = utcHour >= startUTC
      ? (utcHour - startUTC) * 60 + utcMin
      : (24 - startUTC + utcHour) * 60 + utcMin;
  }
  return Math.min(100, Math.max(0, (elapsed / totalMins) * 100));
}

function minsUntilOpen(startUTC: number, utcHour: number, utcMin: number): number {
  const startMins = startUTC * 60;
  const nowMins = utcHour * 60 + utcMin;
  return startMins > nowMins ? startMins - nowMins : 1440 - nowMins + startMins;
}

function fmtCountdown(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtLocalTime(iana: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return "--:--";
  }
}

function getAbbr(iana: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "short",
    }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export default function TradingSessions() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const utcHour = now.getUTCHours();
  const utcMin  = now.getUTCMinutes();
  const utcTime = `${String(utcHour).padStart(2, "0")}:${String(utcMin).padStart(2, "0")} UTC`;

  const activeSessions = SESSIONS.filter((s) => isSessionActive(s.startUTC, s.endUTC, utcHour));
  const overlap = activeSessions.length > 1;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          {overlap && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase tracking-wider animate-pulse">
              Overlap
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">{utcTime}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SESSIONS.map((s) => {
          const active = isSessionActive(s.startUTC, s.endUTC, utcHour);
          const pct = active ? sessionProgress(s.startUTC, s.endUTC, utcHour, utcMin) : 0;
          const countdown = !active ? fmtCountdown(minsUntilOpen(s.startUTC, utcHour, utcMin)) : null;

          return (
            <div
              key={s.id}
              className={`relative rounded-xl p-3 border transition-all ${
                active
                  ? `border-${s.color.split("-")[1]}-500/30 bg-${s.color.split("-")[1]}-500/5`
                  : "border-border bg-secondary/20"
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-base">{s.flag}</span>
                <div className={`w-2 h-2 rounded-full ${active ? `bg-current ${s.color} ${s.glow} shadow-md` : "bg-muted-foreground/30"}`} />
              </div>

              <p className={`text-xs font-semibold ${active ? s.color : "text-muted-foreground"}`}>{s.label}</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono">
                {String(s.startUTC).padStart(2, "0")}:00 – {String(s.endUTC).padStart(2, "0")}:00 UTC
              </p>

              {/* Timezone clocks */}
              <div className="mt-2 space-y-0.5">
                {s.tzones.map((tz) => {
                  const localTime = fmtLocalTime(tz.iana, now);
                  const abbr = getAbbr(tz.iana, now);
                  return (
                    <div key={tz.city} className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/70 truncate max-w-[60%]">{tz.city}</span>
                      <span className={`text-[9px] font-mono font-semibold ${active ? s.color : "text-muted-foreground/60"}`}>
                        {localTime} <span className="opacity-60 font-normal">{abbr}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress / countdown */}
              {active ? (
                <div className="mt-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[8px] text-muted-foreground">Progress</span>
                    <span className={`text-[8px] font-bold ${s.color}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-current ${s.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-[8px] text-muted-foreground/50">Opens in</p>
                  <p className="text-[9px] font-semibold text-muted-foreground">{countdown}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
