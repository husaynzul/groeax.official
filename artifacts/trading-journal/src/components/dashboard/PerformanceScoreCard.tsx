import { useRef, useEffect, useState } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";

interface Props { analytics: Analytics }

// ─── Responsive CSS Border Gauge ─────────────────────────────────────────────
// Sizes itself to its container using ResizeObserver — no overflow, always centered.
function CSSGauge({
  value, max,
  topColor, rightColor, leftColor = "transparent",
  labels,
}: {
  value: number; max: number;
  topColor: string; rightColor: string; leftColor?: string;
  labels: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Fire immediately so we have a real size on first paint
    setAvailW(el.getBoundingClientRect().width);
    const obs = new ResizeObserver(([entry]) => setAvailW(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Dynamic sizing — all derived from available container width
  const BLEED  = 14;                                    // label bleed on each side (px)
  const rawIW  = availW > 0 ? availW - BLEED * 2 - 4 : 130;
  const IW     = Math.min(Math.max(rawIW, 80), 148);   // clamp 80–148
  const BW     = Math.max(10, Math.round(IW * 0.115)); // border proportional, min 10
  const IH     = IW / 2;
  const BR     = IW / 2 + BW;
  const totalW = IW + BW * 2;
  const LR     = BR + 10;
  const BLEED_ACT = (availW - totalW) / 2;             // actual centering bleed
  const cx     = totalW / 2 + BLEED_ACT;
  const cy     = IH + BW + 6;                          // 6px top breathing room
  const wrapW  = availW > 0 ? availW : totalW + BLEED * 2;
  const wrapH  = cy + 6;                               // 6px bottom breathing room
  const needleH = IH - 3;
  const fontSize = Math.max(8, Math.min(10, IW * 0.075));

  const ratio  = Math.min(Math.max(value / max, 0), 1);
  const rotate = ratio * 180 - 90;

  const labelAngles = [180, 135, 90, 45, 0];
  const textAnchors = ["end", "end", "middle", "start", "start"] as const;
  const labelPositions = labelAngles.map(deg => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + LR * Math.cos(rad), y: cy - LR * Math.sin(rad) };
  });

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div style={{ position: "relative", width: wrapW, height: wrapH }}>

        {/* Arc labels */}
        {labels.map((txt, i) => (
          <span key={i} style={{
            position: "absolute",
            fontSize,
            color: "#64748b",
            fontFamily: "inherit",
            lineHeight: 1,
            left: labelPositions[i].x,
            top: labelPositions[i].y,
            transform: textAnchors[i] === "end"
              ? "translate(-100%,-50%)"
              : textAnchors[i] === "start"
                ? "translate(0,-50%)"
                : "translate(-50%,-50%)",
            whiteSpace: "nowrap",
          }}>{txt}</span>
        ))}

        {/* Gauge shell — background track */}
        <div style={{
          position: "absolute",
          left: BLEED_ACT,
          top: 6,
          width: IW,
          height: IH,
          border: `${BW}px solid #2f3747`,
          borderBottom: "none",
          borderRadius: `${BR}px ${BR}px 0 0`,
          boxSizing: "content-box",
        }}>
          {/* Colour arcs overlay */}
          <div style={{
            position: "absolute", top: -BW, left: -BW,
            width: IW, height: IH,
            border: `${BW}px solid transparent`,
            borderTopColor: topColor,
            borderRightColor: rightColor,
            borderLeftColor: leftColor,
            borderBottom: "none",
            borderRadius: `${BR}px ${BR}px 0 0`,
            boxSizing: "content-box",
            pointerEvents: "none",
          }} />

          {/* Needle */}
          <div style={{
            position: "absolute",
            width: Math.max(2, BW * 0.15),
            height: needleH,
            background: "white",
            bottom: 0,
            left: "50%",
            transform: `translateX(-50%) rotate(${rotate}deg)`,
            transformOrigin: "bottom center",
            borderRadius: "2px 2px 0 0",
            transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
          }} />

          {/* Pivot dot */}
          <div style={{
            position: "absolute",
            width: Math.max(10, BW * 0.7),
            height: Math.max(10, BW * 0.7),
            background: "#6b7280",
            borderRadius: "50%",
            bottom: -Math.max(5, BW * 0.35),
            left: "50%",
            transform: "translateX(-50%)",
            border: "2px solid #111c2a",
            zIndex: 1,
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Drawdown Bar ─────────────────────────────────────────────────────────────
function DrawdownBar({ value, max = 30 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100;
  return (
    <div className="relative w-full h-[13px] rounded-full bg-[#182030] overflow-hidden">
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to right,#22c55e 0%,#f97316 50%,#ef4444 100%)", opacity: 0.22 }} />
      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
        style={{
          width: `${Math.max(pct, 3)}%`,
          background: "linear-gradient(to right,#22c55e 0%,#f97316 50%,#ef4444 100%)",
        }} />
      <div className="absolute top-[-2px] bottom-[-2px] w-[2.5px] rounded-sm bg-white/90 pointer-events-none"
        style={{ left: `clamp(1px, calc(${pct}% - 1.25px), calc(100% - 3.5px))` }} />
    </div>
  );
}

// ─── Consistency Dots ─────────────────────────────────────────────────────────
function ConsistencyDots({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 w-full">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}
          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 shrink-0 transition-colors ${
            i < score ? "bg-emerald-500 border-emerald-400" : "bg-transparent border-[#2a3a52]"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Rating helpers ───────────────────────────────────────────────────────────
function rateWinRate(v: number) {
  if (v >= 70) return { t: "Excellent", c: "text-emerald-400" };
  if (v >= 55) return { t: "Good",      c: "text-emerald-400" };
  if (v >= 45) return { t: "Average",   c: "text-yellow-400"  };
  return             { t: "Weak",       c: "text-red-400"     };
}
function ratePF(v: number) {
  if (v >= 3) return { t: "Excellent", c: "text-emerald-400" };
  if (v >= 2) return { t: "Good",      c: "text-emerald-400" };
  if (v >= 1) return { t: "Average",   c: "text-yellow-400"  };
  return             { t: "Poor",      c: "text-red-400"     };
}
function rateDD(v: number) {
  if (v <= 15) return { t: "Low",      c: "text-emerald-400" };
  if (v <= 25) return { t: "Moderate", c: "text-yellow-400"  };
  return              { t: "High",     c: "text-red-400"     };
}
function rateCon(s: number) {
  if (s >= 5) return { t: "Excellent", c: "text-emerald-400" };
  if (s >= 4) return { t: "High",      c: "text-emerald-400" };
  if (s >= 3) return { t: "Average",   c: "text-yellow-400"  };
  return             { t: "Low",       c: "text-red-400"     };
}
function rateOverall(s: number) {
  if (s >= 4.5) return { t: "Excellent", c: "text-emerald-400" };
  if (s >= 3.5) return { t: "Strong",    c: "text-emerald-400" };
  if (s >= 2.5) return { t: "Good",      c: "text-yellow-400"  };
  if (s >= 1.5) return { t: "Fair",      c: "text-orange-400"  };
  return               { t: "Weak",      c: "text-red-400"     };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PerformanceScoreCard({ analytics }: Props) {
  const { winRate, totalProfit, totalLoss, drawdownStats, totalTrades, avgWin, avgLoss } = analytics;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 4 : 0;
  const maxDD = drawdownStats.drawdownPercent;

  const conScore = [
    winRate >= 50, profitFactor >= 1.5, maxDD <= 15, avgWin >= avgLoss, totalTrades >= 5,
  ].filter(Boolean).length;

  const overall =
    (winRate / 100) * 1.5 +
    (Math.min(profitFactor, 4) / 4) * 1.5 +
    Math.max(0, 1 - maxDD / 30) * 1 +
    (conScore / 5) * 1;

  const wLbl = rateWinRate(winRate);
  const pLbl = ratePF(profitFactor);
  const dLbl = rateDD(maxDD);
  const cLbl = rateCon(conScore);
  const oLbl = rateOverall(overall);

  return (
    <div className="glass-card p-3 sm:p-4 w-full">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider select-none">
          Performance Score
        </h2>
      </div>

      {totalTrades === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Gauges row ───────────────────────── */}
          <div className="grid grid-cols-2 gap-2">

            {/* Win Rate */}
            <div className="flex flex-col items-center min-w-0 overflow-hidden">
              <p className="text-[11px] text-muted-foreground font-medium mb-1 tracking-wide">Win Rate</p>
              <CSSGauge
                value={winRate} max={100}
                topColor="#f0b84b" rightColor="#66c04f" leftColor="transparent"
                labels={["0%", "25%", "50%", "75%", "100%"]}
              />
              <p className={`text-xl sm:text-2xl font-bold leading-tight mt-1 ${wLbl.c}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className={`text-[11px] font-semibold ${wLbl.c}`}>{wLbl.t}</p>
            </div>

            {/* Profit Factor */}
            <div className="flex flex-col items-center min-w-0 overflow-hidden">
              <p className="text-[11px] text-muted-foreground font-medium mb-1 tracking-wide">Profit Factor</p>
              <CSSGauge
                value={Math.min(profitFactor, 4)} max={4}
                topColor="#e74c3c" rightColor="#f1c40f" leftColor="#2ecc71"
                labels={["0", "1", "2", "3", "4+"]}
              />
              <p className={`text-xl sm:text-2xl font-bold leading-tight mt-1 ${pLbl.c}`}>
                {profitFactor >= 4 ? "4+" : profitFactor.toFixed(2)}
              </p>
              <p className={`text-[11px] font-semibold ${pLbl.c}`}>{pLbl.t}</p>
            </div>
          </div>

          {/* ── Divider ───────────────────────────── */}
          <div className="border-t border-white/5" />

          {/* ── Bottom metrics row ────────────────── */}
          <div className="grid grid-cols-2 gap-3">

            {/* Max Drawdown */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-muted-foreground font-medium tracking-wide">Max Drawdown</p>
              <div className="flex justify-between text-[9px] text-muted-foreground/50">
                <span>0%</span><span>15%</span><span>30%</span>
              </div>
              <DrawdownBar value={maxDD} max={30} />
              <p className={`text-xl font-bold leading-tight ${dLbl.c}`}>{maxDD.toFixed(1)}%</p>
              <p className={`text-[11px] font-semibold ${dLbl.c}`}>{dLbl.t}</p>
            </div>

            {/* Consistency */}
            <div className="flex flex-col gap-2 items-center">
              <p className="text-[11px] text-muted-foreground font-medium tracking-wide">Consistency</p>
              <ConsistencyDots score={conScore} />
              <p className={`text-xl font-bold leading-tight ${cLbl.c}`}>{conScore} / 5</p>
              <p className={`text-[11px] font-semibold ${cLbl.c}`}>{cLbl.t}</p>
            </div>
          </div>

          {/* ── Overall footer ───────────────────── */}
          <div className="border-t border-white/5 pt-1 flex items-center gap-2">
            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${oLbl.c}`} />
            <span className="text-xs text-muted-foreground font-medium">Overall Performance:</span>
            <span className={`text-xs font-bold ${oLbl.c}`}>{oLbl.t}</span>
          </div>

        </div>
      )}
    </div>
  );
}
