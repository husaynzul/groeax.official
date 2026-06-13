import { useEffect, useRef, useState } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import type { Analytics } from "@/engine/analyticsEngine";

interface Props { analytics: Analytics }

// ─── Exact HTML Gauge ─────────────────────────────────────────────────────────
// Dimensions match the provided HTML exactly:
//   .gauge  { width:250px; height:125px; border:25px solid #2f3747; border-radius:250px 250px 0 0 }
//   .needle { width:4px; height:90px }
//   .center { width:18px; height:18px }
//
// On narrow screens the whole gauge block is CSS-scaled down (scale transform)
// so proportions NEVER change — only the overall size shrinks.

const G_IW  = 250;   // content width  (matches HTML width:250px)
const G_IH  = 125;   // content height (matches HTML height:125px)
const G_BW  = 25;    // border width   (matches HTML border:25px)
const G_BR  = 150;   // border-radius  (matches HTML border-radius:250px 250px 0 0 → outer = G_IW/2 + G_BW)
const G_TOT = G_IW + G_BW * 2;   // 300 — full outer width including both borders
const N_H   = 90;    // needle height
const C_D   = 18;    // center dot diameter
const LTOP  = 18;    // space reserved ABOVE the ring for the top arc label

// Arc-center within the inner-block coordinate system:
//   ring's margin-top = LTOP = 18
//   ring's top border = G_BW = 25  → ring content top  = LTOP + G_BW = 43
//   ring content height = G_IH = 125 → ring content bottom = 168
const ARC_CX = G_TOT / 2;                        // 150
const ARC_CY = LTOP + G_BW + G_IH;               // 168

// Radius to arc-label centres (just outside the outer border edge)
const LR = G_BR + 14;                             // 164

// Inner-block natural height: top label space + ring rendered height + centre-dot bleed
const NATURAL_H = ARC_CY + Math.ceil(C_D / 2) + 2; // 168 + 9 + 2 = 179

function CSSGauge({
  value, max,
  topColor, rightColor, leftColor = "transparent",
  labels,          // [far-left, quarter-left, top, quarter-right, far-right]
}: {
  value: number; max: number;
  topColor: string; rightColor: string; leftColor?: string;
  labels: string[];
}) {
  const outerRef   = useRef<HTMLDivElement>(null);
  const [scale,    setScale]   = useState(1);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScale(Math.min(1, w / G_TOT));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Trigger sweep animation after first paint (50 ms lets the browser render at −90° first)
  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(id);
  }, []);

  // Needle: −90° = left (0 %), 0° = straight up (50 %), +90° = right (100 %)
  const ratio      = Math.min(Math.max(value / max, 0), 1);
  const targetRot  = ratio * 180 - 90;
  const rotate     = animated ? targetRot : -90;

  // Arc labels at 135° / 90° / 45°  →  left / top / right
  // Use only the 3 middle labels from the 5-item array (indices 1, 2, 3)
  const midAngles  = [135, 90, 45] as const;
  const midAnchors = ["end", "middle", "start"] as const;
  const midLabels  = [labels[1], labels[2], labels[3]];

  const midPos = midAngles.map(deg => {
    const rad = (deg * Math.PI) / 180;
    // Position in inner-block coordinates (0,0 = top-left of inner block)
    return {
      x: ARC_CX + LR * Math.cos(rad),
      y: ARC_CY - LR * Math.sin(rad),   // subtract because y grows downward
    };
  });

  return (
    // Outer div: measured for available column width
    <div ref={outerRef} style={{ width: "100%", height: NATURAL_H * scale, position: "relative" }}>

      {/* Inner block: fixed G_TOT × NATURAL_H, centred, scaled */}
      <div
        style={{
          position:        "absolute",
          top:             0,
          left:            "50%",
          width:           G_TOT,
          height:          NATURAL_H,
          transform:       `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {/* ── Arc labels (3 middle positions) ── */}
        {midLabels.map((txt, i) => (
          <span
            key={i}
            style={{
              position:   "absolute",
              fontSize:   11,
              lineHeight: 1,
              color:      "#64748b",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              left:       midPos[i].x,
              top:        midPos[i].y,
              transform:
                midAnchors[i] === "end"    ? "translate(-100%,-50%)"
                : midAnchors[i] === "start" ? "translate(0,-50%)"
                : "translate(-50%,-50%)",
            }}
          >
            {txt}
          </span>
        ))}

        {/* ── Gauge ring (exact copy of HTML .gauge) ── */}
        <div
          style={{
            width:         G_IW,
            height:        G_IH,
            borderTop:     `${G_BW}px solid #2f3747`,
            borderLeft:    `${G_BW}px solid #2f3747`,
            borderRight:   `${G_BW}px solid #2f3747`,
            borderBottom:  "none",
            borderRadius:  `${G_BR}px ${G_BR}px 0 0`,
            position:      "relative",
            margin:        `${LTOP}px auto 0`,
            boxSizing:     "content-box",
          }}
        >
          {/* Colour overlay — equivalent to HTML .gauge::before */}
          <div
            style={{
              position:      "absolute",
              top:           -G_BW,
              left:          -G_BW,
              width:         G_IW,
              height:        G_IH,
              borderTop:     `${G_BW}px solid ${topColor}`,
              borderRight:   `${G_BW}px solid ${rightColor}`,
              borderLeft:    `${G_BW}px solid ${leftColor}`,
              borderBottom:  "none",
              borderRadius:  `${G_BR}px ${G_BR}px 0 0`,
              boxSizing:     "content-box",
              pointerEvents: "none",
            }}
          />

          {/* Needle — matches HTML .needle (width:4; height:90) */}
          <div
            style={{
              position:        "absolute",
              width:           4,
              height:          N_H,
              background:      "white",
              bottom:          0,
              left:            "50%",
              transform:       `translateX(-50%) rotate(${rotate}deg)`,
              transformOrigin: "bottom center",
              borderRadius:    "2px 2px 0 0",
              transition:      "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
            }}
          />

          {/* Centre dot — matches HTML .center (width:18; height:18) */}
          <div
            style={{
              position:     "absolute",
              width:        C_D,
              height:       C_D,
              background:   "#6b7280",
              borderRadius: "50%",
              bottom:       -(C_D / 2),
              left:         "50%",
              transform:    "translateX(-50%)",
              border:       "2px solid #111c2a",
              zIndex:       1,
            }}
          />
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
          width:      `${Math.max(pct, 3)}%`,
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
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}
          className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
            i < score ? "bg-emerald-500 border-emerald-400" : "bg-transparent border-[#2a3a52]"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Rating helpers ───────────────────────────────────────────────────────────
const rateWR  = (v: number) => v >= 70 ? {t:"Excellent",c:"text-emerald-400"} : v >= 55 ? {t:"Good",c:"text-emerald-400"} : v >= 45 ? {t:"Average",c:"text-yellow-400"} : {t:"Weak",c:"text-red-400"};
const ratePF  = (v: number) => v >= 3  ? {t:"Excellent",c:"text-emerald-400"} : v >= 2  ? {t:"Good",c:"text-emerald-400"} : v >= 1  ? {t:"Average",c:"text-yellow-400"} : {t:"Poor",c:"text-red-400"};
const rateDD  = (v: number) => v <= 15 ? {t:"Low",c:"text-emerald-400"}       : v <= 25 ? {t:"Moderate",c:"text-yellow-400"} : {t:"High",c:"text-red-400"};
const rateCon = (s: number) => s >= 5  ? {t:"Excellent",c:"text-emerald-400"} : s >= 4  ? {t:"High",c:"text-emerald-400"}   : s >= 3  ? {t:"Average",c:"text-yellow-400"} : {t:"Low",c:"text-red-400"};
const rateOv  = (s: number) => s >= 4.5? {t:"Excellent",c:"text-emerald-400"} : s >= 3.5? {t:"Strong",c:"text-emerald-400"} : s >= 2.5? {t:"Good",c:"text-yellow-400"}    : s >= 1.5? {t:"Fair",c:"text-orange-400"} : {t:"Weak",c:"text-red-400"};

// ─── Main component ───────────────────────────────────────────────────────────
export default function PerformanceScoreCard({ analytics }: Props) {
  const { winRate, totalProfit, totalLoss, drawdownStats, totalTrades, avgWin, avgLoss } = analytics;
  const pf       = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 4 : 0;
  const maxDD    = drawdownStats.drawdownPercent;
  const conScore = [winRate >= 50, pf >= 1.5, maxDD <= 15, avgWin >= avgLoss, totalTrades >= 5].filter(Boolean).length;
  const overall  = (winRate / 100) * 1.5 + (Math.min(pf, 4) / 4) * 1.5 + Math.max(0, 1 - maxDD / 30) + (conScore / 5);

  const wLbl = rateWR(winRate);
  const pLbl = ratePF(pf);
  const dLbl = rateDD(maxDD);
  const cLbl = rateCon(conScore);
  const oLbl = rateOv(overall);

  return (
    <div className="glass-card p-3 sm:p-4 w-full">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Performance Score
        </h2>
      </div>

      {totalTrades === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Add trades to see your performance score
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Two gauges side by side ────────────── */}
          <div className="grid grid-cols-2 gap-2">

            {/* Win Rate */}
            <div className="flex flex-col items-center min-w-0 overflow-hidden">
              <p className="text-[11px] text-muted-foreground font-medium mb-1 tracking-wide">Win Rate</p>
              <CSSGauge
                value={winRate} max={100}
                topColor="#f0b84b" rightColor="#66c04f" leftColor="transparent"
                labels={["0%", "25%", "50%", "75%", "100%"]}
              />
              <p className={`text-2xl font-bold leading-tight mt-2 ${wLbl.c}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${wLbl.c}`}>{wLbl.t}</p>
            </div>

            {/* Profit Factor */}
            <div className="flex flex-col items-center min-w-0 overflow-hidden">
              <p className="text-[11px] text-muted-foreground font-medium mb-1 tracking-wide">Profit Factor</p>
              <CSSGauge
                value={Math.min(pf, 4)} max={4}
                topColor="#e74c3c" rightColor="#f1c40f" leftColor="#2ecc71"
                labels={["0", "1", "2", "3", "4+"]}
              />
              <p className={`text-2xl font-bold leading-tight mt-2 ${pLbl.c}`}>
                {pf >= 4 ? "4+" : pf.toFixed(2)}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${pLbl.c}`}>{pLbl.t}</p>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* ── Drawdown + Consistency ─────────────── */}
          <div className="grid grid-cols-2 gap-3">

            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] text-muted-foreground font-medium">Max Drawdown</p>
              <div className="flex justify-between text-[9px] text-muted-foreground/50">
                <span>0%</span><span>15%</span><span>30%</span>
              </div>
              <DrawdownBar value={maxDD} max={30} />
              <p className={`text-xl font-bold leading-tight mt-0.5 ${dLbl.c}`}>{maxDD.toFixed(1)}%</p>
              <p className={`text-xs font-semibold ${dLbl.c}`}>{dLbl.t}</p>
            </div>

            <div className="flex flex-col gap-1.5 items-center">
              <p className="text-[11px] text-muted-foreground font-medium">Consistency</p>
              <ConsistencyDots score={conScore} />
              <p className={`text-xl font-bold leading-tight mt-0.5 ${cLbl.c}`}>{conScore} / 5</p>
              <p className={`text-xs font-semibold ${cLbl.c}`}>{cLbl.t}</p>
            </div>
          </div>

          {/* ── Overall Performance ────────────────── */}
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
