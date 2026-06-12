import { Zap, CheckCircle2 } from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";

interface Props { analytics: Analytics }

// ─── SVG Arc Math ────────────────────────────────────────────────────────────
// Upper semicircle: left (v=0) → top (v=0.5) → right (v=1)
// Standard math angle: θ = 180 - v·180 degrees (y-up convention)
// In SVG (y-down):  x = cx + r·cos(θ_rad),  y = cy − r·sin(θ_rad)
// sweep=0 = counterclockwise in SVG y-down = traces the upper arc ✓

function ptOnArc(cx: number, cy: number, r: number, v: number) {
  const rad = ((180 - v * 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcD(cx: number, cy: number, r: number, v0: number, v1: number) {
  const s = ptOnArc(cx, cy, r, v0);
  const e = ptOnArc(cx, cy, r, v1);
  const largeArc = Math.abs(v1 - v0) > 0.5 ? 1 : 0;
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 0 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
}

// ─── Responsive Semi-Gauge ───────────────────────────────────────────────────
// Uses a fixed internal coordinate space (200×130) but renders as width="100%"
// so it scales to any container without overflow or cropping.

interface GaugeSegment { from: number; to: number; color: string }
interface GaugeLabel   { value: number; text: string }

function SemiGauge({
  value, maxValue, segments, labels,
}: {
  value: number; maxValue: number;
  segments: GaugeSegment[]; labels: GaugeLabel[];
}) {
  // Fixed internal coordinate space — SVG will scale via width="100%"
  const VW = 200;   // viewBox width
  const VH = 130;   // viewBox height (enough for labels above + needle below arc)
  const cx = 100;   // arc centre x
  const cy = 112;   // arc centre y (near bottom so top labels don't clip)
  const r  = 76;    // arc radius
  const thick = 14; // stroke width

  const ratio = Math.min(Math.max(value / maxValue, 0), 1);
  const needleRad = ((180 - ratio * 180) * Math.PI) / 180;
  const nLen = r - thick * 0.5;
  const nx = cx + nLen * Math.cos(needleRad);
  const ny = cy - nLen * Math.sin(needleRad);

  return (
    // preserveAspectRatio="xMidYMid meet" ensures the SVG scales correctly
    // overflow="visible" prevents label clipping
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      style={{ display: "block", overflow: "visible", maxWidth: 240, margin: "0 auto" }}
      aria-hidden="true"
    >
      {/* background track */}
      <path
        d={arcD(cx, cy, r, 0, 1)}
        fill="none"
        stroke="#1e2535"
        strokeWidth={thick}
        strokeLinecap="butt"
      />

      {/* colored segments */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={arcD(cx, cy, r, seg.from / maxValue, seg.to / maxValue)}
          fill="none"
          stroke={seg.color}
          strokeWidth={thick}
          strokeLinecap="butt"
        />
      ))}

      {/* tick labels — inside SVG so they scale with the gauge */}
      {labels.map((lbl, i) => {
        const v = lbl.value / maxValue;
        const labelR = r + thick + 9;
        const p = ptOnArc(cx, cy, labelR, v);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
            fontFamily="inherit"
          >
            {lbl.text}
          </text>
        );
      })}

      {/* needle */}
      <line
        x1={cx} y1={cy}
        x2={nx.toFixed(3)} y2={ny.toFixed(3)}
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* pivot circle */}
      <circle cx={cx} cy={cy} r={5.5} fill="#6b7280" />
    </svg>
  );
}

// ─── Responsive Drawdown Bar (pure CSS — no fixed-width SVG) ─────────────────
function DrawdownBar({ value, max = 30 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100;
  return (
    <div className="relative w-full h-[18px] rounded-full overflow-hidden bg-[#1e2535]">
      {/* full-width dim gradient */}
      <div
        className="absolute inset-0 rounded-full opacity-30"
        style={{ background: "linear-gradient(to right, #22c55e 0%, #f97316 50%, #ef4444 100%)" }}
      />
      {/* filled portion */}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(pct, 4)}%`,
          background: "linear-gradient(to right, #22c55e 0%, #f97316 50%, #ef4444 100%)",
        }}
      />
      {/* marker */}
      <div
        className="absolute inset-y-[-3px] w-[3px] rounded-sm bg-white opacity-90"
        style={{ left: `calc(${pct}% - 1.5px)` }}
      />
    </div>
  );
}

// ─── Consistency Dots ─────────────────────────────────────────────────────────
function ConsistencyDots({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-7 h-7 rounded-full border-2 shrink-0 ${
            i < score
              ? "bg-emerald-500 border-emerald-400"
              : "bg-transparent border-[#2a3347]"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Rating helpers ───────────────────────────────────────────────────────────
function winRateLabel(v: number) {
  if (v >= 70) return { text: "Excellent", color: "text-emerald-400" };
  if (v >= 55) return { text: "Good",      color: "text-emerald-400" };
  if (v >= 45) return { text: "Average",   color: "text-yellow-400"  };
  return             { text: "Weak",       color: "text-red-400"     };
}
function pfLabel(v: number) {
  if (v >= 3)   return { text: "Excellent", color: "text-emerald-400" };
  if (v >= 1.5) return { text: "Good",      color: "text-emerald-400" };
  if (v >= 1)   return { text: "Average",   color: "text-yellow-400"  };
  return               { text: "Weak",      color: "text-red-400"     };
}
function ddLabel(v: number) {
  if (v <= 15) return { text: "Low",      color: "text-emerald-400" };
  if (v <= 25) return { text: "Moderate", color: "text-yellow-400"  };
  return              { text: "High",     color: "text-red-400"     };
}
function consistencyLabel(s: number) {
  if (s >= 5) return { text: "Excellent", color: "text-emerald-400" };
  if (s >= 4) return { text: "High",      color: "text-emerald-400" };
  if (s >= 3) return { text: "Average",   color: "text-yellow-400"  };
  return             { text: "Low",       color: "text-red-400"     };
}
function overallLabel(s: number): { text: string; color: string } {
  if (s >= 4.5) return { text: "Excellent", color: "text-emerald-400" };
  if (s >= 3.5) return { text: "Strong",    color: "text-emerald-400" };
  if (s >= 2.5) return { text: "Good",      color: "text-yellow-400"  };
  if (s >= 1.5) return { text: "Fair",      color: "text-orange-400"  };
  return               { text: "Weak",      color: "text-red-400"     };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PerformanceScoreCard({ analytics }: Props) {
  const { winRate, totalProfit, totalLoss, drawdownStats, totalTrades, avgWin, avgLoss } = analytics;

  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 4 : 0;
  const maxDD        = drawdownStats.drawdownPercent;

  const consistencyScore = [
    winRate >= 50,
    profitFactor >= 1.5,
    maxDD <= 15,
    avgWin >= avgLoss,
    totalTrades >= 5,
  ].filter(Boolean).length;

  const overall =
    (winRate / 100) * 1.5 +
    (Math.min(profitFactor, 4) / 4) * 1.5 +
    Math.max(0, 1 - maxDD / 30) * 1 +
    (consistencyScore / 5) * 1;

  const winLbl  = winRateLabel(winRate);
  const pfLbl   = pfLabel(profitFactor);
  const ddLbl   = ddLabel(maxDD);
  const consLbl = consistencyLabel(consistencyScore);
  const overLbl = overallLabel(overall);

  const wrSegments: GaugeSegment[] = [
    { from: 0,   to: 25,  color: "#6b7280" },
    { from: 25,  to: 50,  color: "#f97316" },
    { from: 50,  to: 75,  color: "#eab308" },
    { from: 75,  to: 100, color: "#22c55e" },
  ];
  const wrLabels: GaugeLabel[] = [
    { value: 0,   text: "0%"   },
    { value: 25,  text: "25%"  },
    { value: 50,  text: "50%"  },
    { value: 75,  text: "75%"  },
    { value: 100, text: "100%" },
  ];
  const pfSegments: GaugeSegment[] = [
    { from: 0, to: 1, color: "#ef4444" },
    { from: 1, to: 2, color: "#f97316" },
    { from: 2, to: 3, color: "#eab308" },
    { from: 3, to: 4, color: "#22c55e" },
  ];
  const pfLabels: GaugeLabel[] = [
    { value: 0, text: "0"  },
    { value: 1, text: "1"  },
    { value: 2, text: "2"  },
    { value: 3, text: "3"  },
    { value: 4, text: "4+" },
  ];

  return (
    /* overflow-hidden on the card prevents any child from breaking out */
    <div className="glass-card p-4 flex flex-col overflow-hidden w-full box-border">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Performance Score
        </h2>
      </div>

      {totalTrades === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-w-0">

          {/* ── Row 1: Win Rate + Profit Factor ── */}
          <div className="grid grid-cols-2 gap-2 min-w-0">

            {/* Win Rate */}
            <div className="flex flex-col items-center gap-1 min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground font-medium">Win Rate</p>
              <div className="w-full min-w-0">
                <SemiGauge
                  value={winRate}
                  maxValue={100}
                  segments={wrSegments}
                  labels={wrLabels}
                />
              </div>
              <p className={`text-xl font-bold leading-none ${winLbl.color}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className={`text-xs font-semibold ${winLbl.color}`}>{winLbl.text}</p>
            </div>

            {/* Profit Factor */}
            <div className="flex flex-col items-center gap-1 min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground font-medium">Profit Factor</p>
              <div className="w-full min-w-0">
                <SemiGauge
                  value={Math.min(profitFactor, 4)}
                  maxValue={4}
                  segments={pfSegments}
                  labels={pfLabels}
                />
              </div>
              <p className={`text-xl font-bold leading-none ${pfLbl.color}`}>
                {profitFactor >= 4 ? "4+" : profitFactor.toFixed(2)}
              </p>
              <p className={`text-xs font-semibold ${pfLbl.color}`}>{pfLbl.text}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* ── Row 2: Max Drawdown + Consistency ── */}
          <div className="grid grid-cols-2 gap-2 min-w-0">

            {/* Max Drawdown */}
            <div className="flex flex-col items-center gap-2 min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground font-medium">Max Drawdown</p>
              {/* tick labels */}
              <div className="flex justify-between w-full text-[9px] text-muted-foreground/60 px-0.5">
                <span>0%</span><span>15%</span><span>30%</span>
              </div>
              {/* bar fills its column exactly */}
              <div className="w-full px-0.5">
                <DrawdownBar value={maxDD} max={30} />
              </div>
              <p className={`text-xl font-bold leading-none ${ddLbl.color}`}>
                {maxDD.toFixed(1)}%
              </p>
              <p className={`text-xs font-semibold ${ddLbl.color}`}>{ddLbl.text}</p>
            </div>

            {/* Consistency */}
            <div className="flex flex-col items-center gap-2 min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground font-medium">Consistency</p>
              <div className="w-full flex items-center justify-center py-1">
                <ConsistencyDots score={consistencyScore} />
              </div>
              <p className={`text-xl font-bold leading-none ${consLbl.color}`}>
                {consistencyScore} / 5
              </p>
              <p className={`text-xs font-semibold ${consLbl.color}`}>{consLbl.text}</p>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-white/5 pt-2.5 flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${overLbl.color}`} />
            <span className="text-xs text-muted-foreground font-medium">Overall Performance:</span>
            <span className={`text-xs font-bold ${overLbl.color}`}>{overLbl.text}</span>
          </div>

        </div>
      )}
    </div>
  );
}
