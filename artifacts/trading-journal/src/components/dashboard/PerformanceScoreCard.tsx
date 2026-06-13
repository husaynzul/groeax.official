import { Zap, CheckCircle2 } from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";

interface Props { analytics: Analytics }

// ─── CSS Border Gauge ────────────────────────────────────────────────────────
// Exact CSS-border semicircle technique: thick half-ring via border + border-radius,
// with a dynamic needle and outer arc labels.
function CSSGauge({
  value, max,
  topColor, rightColor, leftColor = "transparent",
  labels,
}: {
  value: number; max: number;
  topColor: string; rightColor: string; leftColor?: string;
  labels: string[]; // [far-left, quarter-left, top, quarter-right, far-right]
}) {
  const ratio  = Math.min(Math.max(value / max, 0), 1);
  // −90° = pointing left (0), 0° = pointing up (50%), +90° = pointing right (100%)
  const rotate = ratio * 180 - 90;

  // Dimensions (CSS box-sizing: content-box so border adds to size)
  const IW = 150; // inner width
  const IH = 75;  // inner height (half of IW for a perfect semicircle)
  const BW = 18;  // border width
  const BR = IW / 2 + BW; // border-radius for outer curve

  // needle length = nearly the inner radius
  const needleH = IH - 4;

  // Wrapper total size including border
  const totalW = IW + BW * 2;

  // Label positions — computed at arc midpoints, outside the border
  // Arc goes from left (180° CCW from right) to right (0°) as value 0→1
  // labelPositions: [0%, 25%, 50%, 75%, 100%] as angles 180°→90°→0°
  const labelAngles = [180, 135, 90, 45, 0]; // degrees from 3-o'clock (east)
  const LR = BR + 11; // radius to label center
  const cx = totalW / 2;  // center x of arc within wrapper
  const cy = IH + BW;     // center y of arc within wrapper (bottom of semicircle)

  const labelPositions = labelAngles.map(deg => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + LR * Math.cos(rad), y: cy - LR * Math.sin(rad) };
  });

  const textAnchors = ["end", "end", "middle", "start", "start"] as const;

  return (
    <div style={{ position: "relative", width: totalW, margin: "0 auto" }}>

      {/* Labels outside arc */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {labels.map((txt, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              fontSize: 9,
              color: "#64748b",
              fontFamily: "inherit",
              lineHeight: 1,
              left: labelPositions[i].x,
              top: labelPositions[i].y,
              transform: textAnchors[i] === "end"
                ? "translate(-100%, -50%)"
                : textAnchors[i] === "start"
                  ? "translate(0, -50%)"
                  : "translate(-50%, -50%)",
              whiteSpace: "nowrap",
            }}
          >
            {txt}
          </span>
        ))}
      </div>

      {/* Gauge shell — background track */}
      <div
        style={{
          width: IW,
          height: IH,
          border: `${BW}px solid #2f3747`,
          borderBottom: "none",
          borderRadius: `${BR}px ${BR}px 0 0`,
          position: "relative",
          boxSizing: "content-box",
          margin: "0 auto",
          marginTop: 14, // room for top label
        }}
      >
        {/* Colour overlay — ::before equivalent */}
        <div
          style={{
            position: "absolute",
            top: -BW,
            left: -BW,
            width: IW,
            height: IH,
            border: `${BW}px solid transparent`,
            borderTopColor: topColor,
            borderRightColor: rightColor,
            borderLeftColor: leftColor,
            borderBottom: "none",
            borderRadius: `${BR}px ${BR}px 0 0`,
            boxSizing: "content-box",
            pointerEvents: "none",
          }}
        />

        {/* Needle */}
        <div
          style={{
            position: "absolute",
            width: 3,
            height: needleH,
            background: "white",
            bottom: 0,
            left: "50%",
            transform: `translateX(-50%) rotate(${rotate}deg)`,
            transformOrigin: "bottom center",
            borderRadius: "2px 2px 0 0",
          }}
        />

        {/* Pivot dot */}
        <div
          style={{
            position: "absolute",
            width: 13,
            height: 13,
            background: "#6b7280",
            borderRadius: "50%",
            bottom: -6.5,
            left: "50%",
            transform: "translateX(-50%)",
            border: "2px solid #111c2a",
            zIndex: 1,
          }}
        />
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
      <div className="absolute inset-y-0 left-0 rounded-full"
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
          className={`rounded-full border-2 shrink-0 ${i < score ? "bg-emerald-500 border-emerald-400" : "bg-transparent border-[#2a3a52]"}`}
          style={{ width: "clamp(10px, 8%, 20px)", height: "clamp(10px, 8%, 20px)" }}
        />
      ))}
    </div>
  );
}

// ─── Rating helpers ───────────────────────────────────────────────────────────
function wr(v: number) {
  if (v >= 70) return { t: "Excellent", c: "text-emerald-400" };
  if (v >= 55) return { t: "Good",      c: "text-emerald-400" };
  if (v >= 45) return { t: "Average",   c: "text-yellow-400"  };
  return             { t: "Weak",       c: "text-red-400"     };
}
function pf(v: number) {
  if (v >= 3) return { t: "Excellent", c: "text-emerald-400" };
  if (v >= 2) return { t: "Good",      c: "text-emerald-400" };
  if (v >= 1) return { t: "Average",   c: "text-yellow-400"  };
  return             { t: "Poor",      c: "text-red-400"     };
}
function dd(v: number) {
  if (v <= 15) return { t: "Low",      c: "text-emerald-400" };
  if (v <= 25) return { t: "Moderate", c: "text-yellow-400"  };
  return              { t: "High",     c: "text-red-400"     };
}
function cs(s: number) {
  if (s >= 5) return { t: "Excellent", c: "text-emerald-400" };
  if (s >= 4) return { t: "High",      c: "text-emerald-400" };
  if (s >= 3) return { t: "Average",   c: "text-yellow-400"  };
  return             { t: "Low",       c: "text-red-400"     };
}
function ov(s: number) {
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

  const wLbl = wr(winRate);
  const pLbl = pf(profitFactor);
  const dLbl = dd(maxDD);
  const cLbl = cs(conScore);
  const oLbl = ov(overall);

  return (
    <div className="glass-card p-3 sm:p-4 w-full">

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider select-none">
          Performance Score
        </h2>
      </div>

      {totalTrades === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <div className="flex flex-col gap-0">

          {/* ── Gauges row ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-x-2 w-full">

            {/* Win Rate */}
            <div className="flex flex-col items-center min-w-0 overflow-visible">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Win Rate</p>
              <CSSGauge
                value={winRate}
                max={100}
                topColor="#f0b84b"
                rightColor="#66c04f"
                leftColor="transparent"
                labels={["0%", "25%", "50%", "75%", "100%"]}
              />
              <p className={`text-xl sm:text-2xl font-bold leading-none mt-3 ${wLbl.c}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className={`text-[11px] font-semibold mt-0.5 ${wLbl.c}`}>{wLbl.t}</p>
            </div>

            {/* Profit Factor */}
            <div className="flex flex-col items-center min-w-0 overflow-visible">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Profit Factor</p>
              <CSSGauge
                value={Math.min(profitFactor, 4)}
                max={4}
                topColor="#e74c3c"
                rightColor="#f1c40f"
                leftColor="#2ecc71"
                labels={["0", "1", "2", "3", "4+"]}
              />
              <p className={`text-xl sm:text-2xl font-bold leading-none mt-3 ${pLbl.c}`}>
                {profitFactor >= 4 ? "4+" : profitFactor.toFixed(2)}
              </p>
              <p className={`text-[11px] font-semibold mt-0.5 ${pLbl.c}`}>{pLbl.t}</p>
            </div>
          </div>

          {/* ── Divider ─────────────────────────────────────── */}
          <div className="border-t border-white/5 my-3" />

          {/* ── Bottom row ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-x-3 w-full">

            {/* Max Drawdown */}
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium text-center">Max Drawdown</p>
              <div className="w-full">
                <div className="flex justify-between text-[8.5px] text-muted-foreground/50 mb-1">
                  <span>0%</span><span>15%</span><span>30%</span>
                </div>
                <DrawdownBar value={maxDD} max={30} />
              </div>
              <p className={`text-xl font-bold leading-none ${dLbl.c}`}>
                {maxDD.toFixed(1)}%
              </p>
              <p className={`text-[11px] font-semibold ${dLbl.c}`}>{dLbl.t}</p>
            </div>

            {/* Consistency */}
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium text-center">Consistency</p>
              <ConsistencyDots score={conScore} />
              <p className={`text-xl font-bold leading-none ${cLbl.c}`}>
                {conScore} / 5
              </p>
              <p className={`text-[11px] font-semibold ${cLbl.c}`}>{cLbl.t}</p>
            </div>
          </div>

          {/* ── Overall footer ──────────────────────────────── */}
          <div className="border-t border-white/5 mt-2.5 pt-2 flex items-center gap-2">
            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${oLbl.c}`} />
            <span className="text-xs text-muted-foreground font-medium">Overall Performance:</span>
            <span className={`text-xs font-bold ${oLbl.c}`}>{oLbl.t}</span>
          </div>

        </div>
      )}
    </div>
  );
}
