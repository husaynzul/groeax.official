export type SessionName =
  | "London"
  | "New York"
  | "Asia"
  | "London-NY Overlap"
  | "NY-Asia Overlap"
  | "Off-Hours";

export interface TimeZoneClocks {
  EST: string;
  UTC: string;
  GMT: string;
  ASIA: string;
  PKT: string;
}

export interface SessionInfo {
  currentSession: SessionName;
  volatilityExpectation: "LOW" | "HIGH";
  activeMarkets: string[];
  nextSession: SessionName;
  minutesToNextSession: number;
  sessionProgress: number; // 0-100 percent through current session
  clocks: TimeZoneClocks;
  isOverlap: boolean;
}

// All times in UTC hours (float)
const SESSION_WINDOWS: Record<string, { open: number; close: number }> = {
  Asia:     { open: 0,    close: 9  },
  London:   { open: 8,    close: 16 },
  "New York": { open: 13, close: 22 },
};

function utcDecimalHour(d: Date): number {
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

function padded(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTZ(date: Date, tz: string): string {
  try {
    return date.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    return `${padded(h)}:${padded(m)}`;
  }
}

export function getSessionInfo(): SessionInfo {
  const now = new Date();
  const h = utcDecimalHour(now);

  const inAsia     = h >= SESSION_WINDOWS.Asia.open     && h < SESSION_WINDOWS.Asia.close;
  const inLondon   = h >= SESSION_WINDOWS.London.open   && h < SESSION_WINDOWS.London.close;
  const inNewYork  = h >= SESSION_WINDOWS["New York"].open && h < SESSION_WINDOWS["New York"].close;

  const overlapLdnNy  = inLondon && inNewYork;
  const overlapNyAsia = h >= 22 || h < 2;

  let currentSession: SessionName;
  let activeMarkets: string[] = [];
  let volatilityExpectation: "LOW" | "HIGH" = "LOW";
  let sessionOpen = 0;
  let sessionClose = 24;

  if (overlapLdnNy) {
    currentSession = "London-NY Overlap";
    activeMarkets = ["Forex", "Equities", "Futures", "Indices", "Crypto"];
    volatilityExpectation = "HIGH";
    sessionOpen = SESSION_WINDOWS["New York"].open;
    sessionClose = SESSION_WINDOWS.London.close;
  } else if (overlapNyAsia) {
    currentSession = "NY-Asia Overlap";
    activeMarkets = ["Crypto", "Futures", "JPY Pairs"];
    volatilityExpectation = "HIGH";
    sessionOpen = 22;
    sessionClose = 26; // wraps
  } else if (inLondon) {
    currentSession = "London";
    activeMarkets = ["EUR/GBP Pairs", "Gold", "Oil", "Indices"];
    volatilityExpectation = "HIGH";
    sessionOpen = SESSION_WINDOWS.London.open;
    sessionClose = SESSION_WINDOWS.London.close;
  } else if (inNewYork) {
    currentSession = "New York";
    activeMarkets = ["USD Pairs", "Equities", "Oil", "Gold", "Crypto"];
    volatilityExpectation = "HIGH";
    sessionOpen = SESSION_WINDOWS["New York"].open;
    sessionClose = SESSION_WINDOWS["New York"].close;
  } else if (inAsia) {
    currentSession = "Asia";
    activeMarkets = ["JPY Pairs", "AUD/NZD", "Crypto"];
    volatilityExpectation = "LOW";
    sessionOpen = SESSION_WINDOWS.Asia.open;
    sessionClose = SESSION_WINDOWS.Asia.close;
  } else {
    currentSession = "Off-Hours";
    activeMarkets = ["Crypto"];
    volatilityExpectation = "LOW";
    sessionOpen = 22;
    sessionClose = 24;
  }

  const sessionDuration = Math.max(sessionClose - sessionOpen, 1);
  const elapsed = Math.max(0, h - sessionOpen);
  const sessionProgress = Math.min(100, Math.round((elapsed / sessionDuration) * 100));

  // Next session
  const sessions: Array<{ session: SessionName; openHour: number }> = [
    { session: "Asia",       openHour: 0  },
    { session: "London",     openHour: 8  },
    { session: "New York",   openHour: 13 },
  ];
  let nextSession: SessionName = "Asia";
  let minutesToNextSession = 9999;
  for (const s of sessions) {
    let diff = s.openHour - h;
    if (diff <= 0) diff += 24;
    const mins = Math.round(diff * 60);
    if (mins < minutesToNextSession && mins > 0) {
      minutesToNextSession = mins;
      nextSession = s.session;
    }
  }
  if (minutesToNextSession === 9999) minutesToNextSession = 0;

  const clocks: TimeZoneClocks = {
    EST:  formatTZ(now, "America/New_York"),
    UTC:  formatTZ(now, "UTC"),
    GMT:  formatTZ(now, "Europe/London"),
    ASIA: formatTZ(now, "Asia/Tokyo"),
    PKT:  formatTZ(now, "Asia/Karachi"),
  };

  return {
    currentSession,
    volatilityExpectation,
    activeMarkets,
    nextSession,
    minutesToNextSession,
    sessionProgress,
    clocks,
    isOverlap: overlapLdnNy || overlapNyAsia,
  };
}
