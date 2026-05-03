import { useEffect, useState } from "react";
import { TradingSession } from "@/types";
import { Clock, Globe } from "lucide-react";

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
      { city: "Hong Kong", iana: "Asia/Hong_Kong", abbr: "HKT" },
      { city: "Singapore", iana: "Asia/Singapore", abbr: "SGT" },
      { city: "Sydney", iana: "Australia/Sydney", abbr: "AEDT" },
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
      { city: "Tokyo", iana: "Asia/Tokyo", abbr: "JST" },
      { city: "Seoul", iana: "Asia/Seoul", abbr: "KST" },
      { city: "Osaka", iana: "Asia/Tokyo", abbr: "JST" },
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
      { city: "London", iana: "Europe/London", abbr: "GMT" },
      { city: "Frankfurt", iana: "Europe/Berlin", abbr: "CET" },
      { city: "Zurich", iana: "Europe/Zurich", abbr: "CET" },
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
      { city: "New York", iana: "America/New_York", abbr: "EST" },
      { city: "Chicago", iana: "America/Chicago", abbr: "CST" },
      { city: "Toronto", iana: "America/Toronto", abbr: "EST" },
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
  if (startUTC <= endUTC) elapsed = (utcHour - startUTC) * 60 + utcMin;
  else elapsed = utcHour >= startUTC ? (utcHour - startUTC) * 60 + utcMin : (24 - startUTC + utcHour) * 60 + utcMin;
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

export default function TradingSessions() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcTime = `${String(utcHour).padStart(2, "0")}:${String(utcMin).padStart(2, "0")} UTC`;
  const activeSessions = SESSIONS.filter((s) => isSessionActive(s.startUTC, s.endUTC, utcHour));
  const overlap = activeSessions.length > 1;

  return (
    <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] backdrop-blur-xl p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          {overlap && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wider animate-pulse">Overlap</span>}
          <span className="text-[10px] text-white/35 font-mono">{utcTime}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SESSIONS.map((s) => {
          const active = isSessionActive(s.startUTC, s.endUTC, utcHour);
          const pct = active ? sessionProgress(s.startUTC, s.endUTC, utcHour, utcMin) : 0;
          const countdown = !active ? fmtCountdown(minsUntilOpen(s.startUTC, utcHour, utcMin)) : null;
          return (
            <div key={s.id} className={`relative rounded-xl p-3 border transition-all overflow-hidden ${active ? "border-white/10 bg-white/[0.035]" : "border-white/5 bg-white/[0.02]"}`}>
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent ${s.color} opacity-60`} />
              <div className="flex items-center justify-between mb-2">
                <span className="text-base">{s.flag}</span>
                <div className={`w-2 h-2 rounded-full ${active ? `bg-current ${s.color} shadow-[0_0_10px_currentColor]` : "bg-white/20"}`} />
              </div>
              <p className={`text-xs font-semibold ${active ? s.color : "text-white/45"}`}>{s.label}</p>
              <p className="text-[9px] text-white/25 mt-0.5 font-mono">{String(s.startUTC).padStart(2, "0")}:00 – {String(s.endUTC).padStart(2, "0")}:00 UTC</p>
              <div className="mt-2 space-y-0.5">
                {s.tzones.map((tz) => (
                  <div key={tz.city} className="flex items-center justify-between">
                    <span className="text-[9px] text-white/35 truncate max-w-[60%]">{tz.city}</span>
                    <span className={`text-[9px] font-mono font-semibold ${active ? s.color : "text-white/40"}`}>{fmtLocalTime(tz.iana, now)} <span className="opacity-60 font-normal">{tz.abbr}</span></span>
                  </div>
                ))}
              </div>
              {active ? (
                <div className="mt-2.5">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[8px] text-white/30">Progress</span>
                    <span className={`text-[8px] font-bold ${s.color}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color} bg-current`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex items-center gap-1.5 text-white/35">
                  <Globe className="w-3 h-3" />
                  <p className="text-[8px]">Opens in <span className="text-white/55 font-semibold">{countdown}</span></p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
