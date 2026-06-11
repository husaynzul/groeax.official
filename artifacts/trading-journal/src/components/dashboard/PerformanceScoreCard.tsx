import { Zap, CheckCircle2 } from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";

interface Props {
  analytics: Analytics;
}

// ── SVG arc math ─────────────────────────────────────────────────────────────
// Upper semicircle: left (0%) → top (50%) → right (100%)
// angle for value v∈[0,1]: 180 - v*180  degrees (standard math, y-up)
// In SVG (y-down): x = cx + r·cos(θ_rad),  y = cy - r·sin(θ_rad)
// Arc sweep=0 (counterclockwise in SVG y-down) traces the upper arc correctly.

function pt(cx: number, cy: number, r: number, v: number) {
  const rad = ((180 - v * 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, v0: number, v1: number) {
  const s = pt(cx, cy, r, v0);
  const e = pt(cx, cy, r, v1);
  const large = Math.abs(v1 - v0) > 0.5 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Semi-circle gauge ─────────────────────────────────────────────────────────
interface GaugeSegment { from: number; to: number; color: string }
interface GaugeLabel   { value: number; text: string }

function SemiGauge({
  value, maxValue, segments, labels, size = 160, thickness = 14,
}: {
  value: number; maxValue: number;
  segments: GaugeSegment[]; labels: GaugeLabel[];
  size?: number; thickness?: number;
}) {
  const cx = size / 2;
  const cy = size * 0.6;         // sit lower so we see the full arc
  const r  = size * 0.4;
  const ratio = Math.min(Math.max(value / maxValue, 0), 1);

  // needle
  const needleRad = ((180 - ratio * 180) * Math.PI) / 180;
  const nLen = r - thickness * 0.6;
  const nx = cx + nLen * Math.cos(needleRad);
  const ny = cy - nLen * Math.sin(needleRad);

  return (
    <svg viewBox={`0 0 ${size} ${cy + 8}`} width={size} height={cy + 8}>
      {/* background track */}
      <path
        d={arcPath(cx, cy, r, 0, 1)}
        fill="none"
        stroke="#1e2535"
        strokeWidth={thickness}
        strokeLinecap="butt"
      />

      {/* colored segments */}
      {segments.map((seg, i) => {
        const v0 = seg.from / maxValue;
        const v1 = seg.to   / maxValue;
        return (
          <path
            key={i}
            d={arcPath(cx, cy, r, v0, v1)}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
          />
        );
      })}

      {/* tick labels */}
      {labels.map((lbl, i) => {
        const v = lbl.value / maxValue;
        const labelR = r + thickness + 6;
        const p = pt(cx, cy, labelR, v);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontSize={8}
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
        x2={nx.toFixed(2)} y2={ny.toFixed(2)}
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* pivot */}
      <circle cx={cx} cy={cy} r={5} fill="#6b7280" />
    </svg>
  );
}

// ── Drawdown horizontal bar ───────────────────────────────────────────────────
function DrawdownBar({ value, max = 30 }: { value: number; max?: number }) {
  const clampedPct = Math.min(value, max) / max; // 0..1
  const W = 220;
  const H = 18;
  const markerX = clampedPct * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="ddGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#22c55e" />
          <stop offset="50%"  stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <clipPath id="ddClip">
          <rect x={0} y={0} width={W} height={H} rx={H / 2} />
        </clipPath>
      </defs>

      {/* background */}
      <rect x={0} y={0} width={W} height={H} rx={H / 2} fill="#1e2535" />

      {/* color gradient fill up to current value */}
      <g clipPath="url(#ddClip)">
        <rect x={0} y={0} width={W} height={H} fill="url(#ddGrad)" opacity={0.35} />
        <rect x={0} y={0} width={Math.max(markerX, H)} height={H} fill="url(#ddGrad)" />
      </g>

      {/* marker line */}
      <rect
        x={markerX - 1.5}
        y={-3}
        width={3}
        height={H + 6}
        rx={2}
        fill="white"
        opacity={0.9}
      />
    </svg>
  );
}

// ── Consistency dots ──────────────────────────────────────────────────────────
function ConsistencyDots({ score }: { score: number }) {
  return (
    <div className="flex gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-9 h-9 rounded-full border-2 ${
            i < score
              ? "bg-emerald-500 border-emerald-400"
              : "bg-transparent border-[#2a3347]"
          }`}
        />
      ))}
    </div>
  );
}

// ── Rating helpers ────────────────────────────────────────────────────────────
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
  if (v <= 5)  return { text: "Low",      color: "text-emerald-400" };
  if (v <= 15) return { text: "Low",      color: "text-emerald-400" };
  if (v <= 25) return { text: "Moderate", color: "text-yellow-400"  };
  return              { text: "High",     color: "text-red-400"     };
}

function consistencyLabel(score: number) {
  if (score >= 5) return { text: "Excellent", color: "text-emerald-400" };
  if (score >= 4) return { text: "High",      color: "text-emerald-400" };
  if (score >= 3) return { text: "Average",   color: "text-yellow-400"  };
  return                 { text: "Low",       color: "text-red-400"     };
}

function overallLabel(score: number): { text: string; color: string } {
  if (score >= 4.5) return { text: "Excellent", color: "text-emerald-400" };
  if (score >= 3.5) return { text: "Strong",    color: "text-emerald-400" };
  if (score >= 2.5) return { text: "Good",      color: "text-yellow-400"  };
  if (score >= 1.5) return { text: "Fair",      color: "text-orange-400"  };
  return                   { text: "Weak",      color: "text-red-400"     };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PerformanceScoreCard({ analytics }: Props) {
  const {
    winRate, totalProfit, totalLoss, drawdownStats, totalTrades, avgWin, avgLoss,
  } = analytics;

  // Derived metrics
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 4 : 0;
  const maxDD        = drawdownStats.drawdownPercent;

  // Consistency score (0-5): how many of these criteria are met
  const consistencyScore = [
    winRate >= 50,
    profitFactor >= 1.5,
    maxDD <= 15,
    avgWin >= avgLoss,
    totalTrades >= 5,
  ].filter(Boolean).length;

  // Overall weighted score (1-5)
  const overall =
    (winRate / 100) * 1.5 +
    (Math.min(profitFactor, 4) / 4) * 1.5 +
    (Math.max(0, 1 - maxDD / 30)) * 1 +
    (consistencyScore / 5) * 1;

  const winLbl  = winRateLabel(winRate);
  const pfLbl   = pfLabel(profitFactor);
  const ddLbl   = ddLabel(maxDD);
  const consLbl = consistencyLabel(consistencyScore);
  const overLbl = overallLabel(overall);

  const empty = totalTrades === 0;

  // Win Rate gauge segments
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

  // Profit Factor gauge (max display = 4)
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
    <div className="glass-card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Performance Score
        </h2>
      </div>

      {empty ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          {/* Top row: Win Rate + Profit Factor gauges */}
          <div className="grid grid-cols-2 divide-x divide-white/5">
            {/* Win Rate */}
            <div className="flex flex-col items-center gap-1 pr-3">
              <p className="text-xs text-muted-foreground font-medium">Win Rate</p>
              <SemiGauge
                value={winRate}
                maxValue={100}
                segments={wrSegments}
                labels={wrLabels}
                size={150}
                thickness={13}
              />
              <p className={`text-xl font-bold -mt-2 ${winLbl.color}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className={`text-xs font-semibold ${winLbl.color}`}>{winLbl.text}</p>
            </div>

            {/* Profit Factor */}
            <div className="flex flex-col items-center gap-1 pl-3">
              <p className="text-xs text-muted-foreground font-medium">Profit Factor</p>
              <SemiGauge
                value={Math.min(profitFactor, 4)}
                maxValue={4}
                segments={pfSegments}
                labels={pfLabels}
                size={150}
                thickness={13}
              />
              <p className={`text-xl font-bold -mt-2 ${pfLbl.color}`}>
                {profitFactor >= 4 ? "4+" : profitFactor.toFixed(2)}
              </p>
              <p className={`text-xs font-semibold ${pfLbl.color}`}>{pfLbl.text}</p>
            </div>
          </div>

          {/* Bottom row: Max Drawdown + Consistency */}
          <div className="grid grid-cols-2 divide-x divide-white/5 mt-1">
            {/* Max Drawdown */}
            <div className="flex flex-col items-center gap-2 pr-3">
              <p className="text-xs text-muted-foreground font-medium">Max Drawdown</p>
              <div className="w-full flex flex-col items-center gap-1">
                <div className="flex justify-between w-full text-[9px] text-muted-foreground/70 px-0.5">
                  <span>0%</span><span>15%</span><span>30%</span>
                </div>
                <DrawdownBar value={maxDD} max={30} />
              </div>
              <p className={`text-xl font-bold ${ddLbl.color}`}>{maxDD.toFixed(1)}%</p>
              <p className={`text-xs font-semibold ${ddLbl.color}`}>{ddLbl.text}</p>
            </div>

            {/* Consistency */}
            <div className="flex flex-col items-center gap-2 pl-3">
              <p className="text-xs text-muted-foreground font-medium">Consistency</p>
              <div className="flex-1 flex items-center">
                <ConsistencyDots score={consistencyScore} />
              </div>
              <p className={`text-xl font-bold ${consLbl.color}`}>{consistencyScore} / 5</p>
              <p className={`text-xs font-semibold ${consLbl.color}`}>{consLbl.text}</p>
            </div>
          </div>

          {/* Overall footer */}
          <div className="mt-auto pt-2 border-t border-white/5 flex items-center gap-2 bg-white/[0.02] -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${overLbl.color}`} />
            <span className="text-xs text-muted-foreground font-medium">
              Overall Performance:
            </span>
            <span className={`text-xs font-bold ${overLbl.color}`}>{overLbl.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
