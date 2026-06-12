import { Zap, CheckCircle2 } from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";

interface Props { analytics: Analytics }

// ─── SVG Math ────────────────────────────────────────────────────────────────
// Upper semicircle convention (y-down SVG):
//   value v ∈ [0,1] → angle θ = (180 − v·180)° (standard math, y-up)
//   point: x = cx + r·cos(θ_rad),  y = cy − r·sin(θ_rad)
//   arc drawn with sweep-flag=0  → traces the upper (visible) half

function ptArc(cx: number, cy: number, r: number, v: number) {
  const θ = ((180 - v * 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(θ), y: cy - r * Math.sin(θ) };
}

function segPath(cx: number, cy: number, r: number, v0: number, v1: number) {
  const s = ptArc(cx, cy, r, v0);
  const e = ptArc(cx, cy, r, v1);
  const la = Math.abs(v1 - v0) > 0.5 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${la} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ─── Semi-Gauge ───────────────────────────────────────────────────────────────
// All coordinates live in a fixed internal space.
// The SVG renders as width="100%" (scales to any container).
// viewBox is padded so edge labels (0% / 100%) are never clipped.

interface Seg { from: number; to: number; color: string }
interface Lbl { value: number; text: string }

function SemiGauge({ value, max, segs, lbls }: {
  value: number; max: number; segs: Seg[]; lbls: Lbl[];
}) {
  // ── internal coordinate constants ──────────────────────────────────────────
  const CX = 100;  // arc centre
  const CY = 108;  // arc centre (low so top label has room)
  const R  = 72;   // arc radius
  const TK = 15;   // stroke thickness  (matches reference image)

  // viewBox padded so nothing clips:
  //   left label "0%" centred at x ≈ CX−R−TK−10 ≈ 3  → need ~20 px left margin
  //   right label "100%" centred at x ≈ CX+R+TK+10 ≈ 197 → need ~20 px right room
  //   top label "50%" at y ≈ CY−R−TK−12 ≈ 9 → need ~15 px top margin
  const VBX = -22;          // viewBox origin x
  const VBY = -18;          // viewBox origin y
  const VBW = 244;          // viewBox width
  const VBH = CY + 16 - VBY; // viewBox height (through pivot + small gap below)

  const ratio = Math.min(Math.max(value / max, 0), 1);
  const θ = ((180 - ratio * 180) * Math.PI) / 180;
  const nLen = R - TK * 0.4;   // needle length (tips inside arc)
  const nx = CX + nLen * Math.cos(θ);
  const ny = CY - nLen * Math.sin(θ);

  // Per-label text anchor & offset so edge labels don't straddle the SVG border
  function labelAnchor(v: number) {
    if (v < 0.1) return "end";
    if (v > 0.9) return "start";
    return "middle";
  }

  return (
    <svg
      viewBox={`${VBX} ${VBY} ${VBW} ${VBH}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      {/* background track */}
      <path d={segPath(CX, CY, R, 0, 1)}
        fill="none" stroke="#1c2333" strokeWidth={TK} strokeLinecap="butt" />

      {/* coloured segments */}
      {segs.map((s, i) => (
        <path key={i}
          d={segPath(CX, CY, R, s.from / max, s.to / max)}
          fill="none" stroke={s.color} strokeWidth={TK} strokeLinecap="butt" />
      ))}

      {/* tick labels */}
      {lbls.map((l, i) => {
        const v  = l.value / max;
        const lr = R + TK + 8;
        const p  = ptArc(CX, CY, lr, v);
        return (
          <text key={i}
            x={p.x} y={p.y + 4}
            textAnchor={labelAnchor(v)}
            fontSize={9} fill="#6b7280" fontFamily="inherit">
            {l.text}
          </text>
        );
      })}

      {/* needle */}
      <line x1={CX} y1={CY} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
        stroke="white" strokeWidth={2.5} strokeLinecap="round" />
      {/* pivot */}
      <circle cx={CX} cy={CY} r={5.5} fill="#6b7280" />
    </svg>
  );
}

// ─── Drawdown Bar ─────────────────────────────────────────────────────────────
// Pure-CSS — zero fixed pixel widths, always fits its column.
function DrawdownBar({ value, max = 30 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100;
  return (
    <div className="relative w-full h-[16px] rounded-full bg-[#1c2333] overflow-hidden">
      {/* dim full gradient */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to right,#22c55e 0%,#f97316 50%,#ef4444 100%)", opacity: 0.28 }} />
      {/* active fill */}
      <div className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(pct, 3)}%`,
          background: "linear-gradient(to right,#22c55e 0%,#f97316 50%,#ef4444 100%)",
        }} />
      {/* marker */}
      <div className="absolute top-[-2px] bottom-[-2px] w-[3px] rounded-sm bg-white/90 pointer-events-none"
        style={{ left: `clamp(1px, calc(${pct}% - 1.5px), calc(100% - 4px))` }} />
    </div>
  );
}

// ─── Consistency Dots ─────────────────────────────────────────────────────────
function ConsistencyDots({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center" style={{ gap: "clamp(4px, 3vw, 10px)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}
          className={`rounded-full border-2 shrink-0 ${i < score ? "bg-emerald-500 border-emerald-400" : "bg-transparent border-[#2a3a52]"}`}
          style={{ width: "clamp(20px, 10vw, 32px)", height: "clamp(20px, 10vw, 32px)" }} />
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
  if (v >= 3)   return { t: "Excellent", c: "text-emerald-400" };
  if (v >= 1.5) return { t: "Good",      c: "text-emerald-400" };
  if (v >= 1)   return { t: "Average",   c: "text-yellow-400"  };
  return               { t: "Weak",      c: "text-red-400"     };
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

  const wrSegs: Seg[] = [
    { from: 0,  to: 25,  color: "#6b7280" },
    { from: 25, to: 50,  color: "#f97316" },
    { from: 50, to: 75,  color: "#eab308" },
    { from: 75, to: 100, color: "#22c55e" },
  ];
  const wrLbls: Lbl[] = [
    { value: 0,   text: "0%"   },
    { value: 25,  text: "25%"  },
    { value: 50,  text: "50%"  },
    { value: 75,  text: "75%"  },
    { value: 100, text: "100%" },
  ];
  const pfSegs: Seg[] = [
    { from: 0, to: 1, color: "#ef4444" },
    { from: 1, to: 2, color: "#f97316" },
    { from: 2, to: 3, color: "#eab308" },
    { from: 3, to: 4, color: "#22c55e" },
  ];
  const pfLbls: Lbl[] = [
    { value: 0, text: "0"  },
    { value: 1, text: "1"  },
    { value: 2, text: "2"  },
    { value: 3, text: "3"  },
    { value: 4, text: "4+" },
  ];

  return (
    <div className="glass-card p-4 w-full box-border" style={{ overflow: "hidden" }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider select-none">
          Performance Score
        </h2>
      </div>

      {totalTrades === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <div className="flex flex-col gap-0">

          {/* ── Gauges row ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-x-3 w-full">

            {/* Win Rate */}
            <div className="flex flex-col items-center min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Win Rate</p>
              {/* SVG wrapper: overflow visible so labels show; width 100% */}
              <div className="w-full" style={{ overflow: "visible" }}>
                <SemiGauge value={winRate} max={100} segs={wrSegs} lbls={wrLbls} />
              </div>
              <p className={`text-2xl font-bold leading-none -mt-1 ${wLbl.c}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className={`text-[11px] font-semibold mt-0.5 ${wLbl.c}`}>{wLbl.t}</p>
            </div>

            {/* Profit Factor */}
            <div className="flex flex-col items-center min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Profit Factor</p>
              <div className="w-full" style={{ overflow: "visible" }}>
                <SemiGauge
                  value={Math.min(profitFactor, 4)}
                  max={4}
                  segs={pfSegs}
                  lbls={pfLbls}
                />
              </div>
              <p className={`text-2xl font-bold leading-none -mt-1 ${pLbl.c}`}>
                {profitFactor >= 4 ? "4+" : profitFactor.toFixed(2)}
              </p>
              <p className={`text-[11px] font-semibold mt-0.5 ${pLbl.c}`}>{pLbl.t}</p>
            </div>
          </div>

          {/* ── Divider ───────────────────────────────────────── */}
          <div className="border-t border-white/5 my-3" />

          {/* ── Bottom row: Drawdown + Consistency ────────────── */}
          <div className="grid grid-cols-2 gap-x-3 w-full">

            {/* Max Drawdown */}
            <div className="flex flex-col items-center gap-1.5 min-w-0 overflow-hidden">
              <p className="text-[11px] text-muted-foreground font-medium">Max Drawdown</p>
              {/* bar section */}
              <div className="w-full px-1">
                <div className="flex justify-between text-[8px] text-muted-foreground/60 mb-0.5">
                  <span>0%</span><span>15%</span><span>30%</span>
                </div>
                <DrawdownBar value={maxDD} max={30} />
              </div>
              <p className={`text-2xl font-bold leading-none ${dLbl.c}`}>
                {maxDD.toFixed(1)}%
              </p>
              <p className={`text-[11px] font-semibold ${dLbl.c}`}>{dLbl.t}</p>
            </div>

            {/* Consistency */}
            <div className="flex flex-col items-center gap-1.5 min-w-0 overflow-hidden">
              <p className="text-[11px] text-muted-foreground font-medium">Consistency</p>
              <div className="w-full flex items-center justify-center py-1">
                <ConsistencyDots score={conScore} />
              </div>
              <p className={`text-2xl font-bold leading-none ${cLbl.c}`}>
                {conScore} / 5
              </p>
              <p className={`text-[11px] font-semibold ${cLbl.c}`}>{cLbl.t}</p>
            </div>
          </div>

          {/* ── Overall footer ─────────────────────────────────── */}
          <div className="border-t border-white/5 mt-3 pt-2.5 flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${oLbl.c}`} />
            <span className="text-xs text-muted-foreground font-medium">Overall Performance:</span>
            <span className={`text-xs font-bold ${oLbl.c}`}>{oLbl.t}</span>
          </div>

        </div>
      )}
    </div>
  );
}
