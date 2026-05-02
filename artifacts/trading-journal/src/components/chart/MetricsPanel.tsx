import { TrendingUp, TrendingDown, Target, BarChart2, Zap, AlertTriangle } from "lucide-react";

interface Metrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnLPips: number;
  totalPnLUSD: number;
  expectancy: number;
  maxDrawdownUSD: number;
  profitFactor: number;
  avgWinPips: number;
  avgLossPips: number;
}

interface Props {
  metrics: Metrics | null;
  strategyName?: string;
  pair?: string;
  tf?: string;
}

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

function MetricRow({ label, value, color, icon: Icon }: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className={`text-xs font-semibold ${color ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default function MetricsPanel({ metrics, strategyName, pair, tf }: Props) {
  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs text-center px-4">
        <Zap className="w-8 h-8 mb-2 opacity-20" />
        Run a backtest to see performance metrics
      </div>
    );
  }

  const wr = metrics.winRate;
  const wrColor = wr >= 0.6 ? "text-emerald-400" : wr >= 0.4 ? "text-yellow-400" : "text-red-400";
  const pnlColor = metrics.totalPnLUSD >= 0 ? "text-emerald-400" : "text-red-400";
  const pfColor = metrics.profitFactor >= 1.5 ? "text-emerald-400" : metrics.profitFactor >= 1 ? "text-yellow-400" : "text-red-400";
  const expColor = metrics.expectancy >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-3">
      {(strategyName || pair) && (
        <div className="pb-2 border-b border-border">
          {strategyName && <p className="text-xs font-semibold text-foreground truncate">{strategyName}</p>}
          {pair && <p className="text-[10px] text-muted-foreground">{pair} · {tf}</p>}
        </div>
      )}

      {/* Hero stat */}
      <div className="rounded-xl p-3 bg-secondary/30 border border-border space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net P&L</p>
        <p className={`text-2xl font-bold ${pnlColor}`}>
          {metrics.totalPnLUSD >= 0 ? "+" : ""}{fmtUSD(metrics.totalPnLUSD)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {metrics.totalPnLPips >= 0 ? "+" : ""}{metrics.totalPnLPips} pips
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Win Rate", val: fmtPct(metrics.winRate), color: wrColor },
          { label: "Trades", val: String(metrics.totalTrades), color: "text-foreground" },
          { label: "Wins", val: String(metrics.wins), color: "text-emerald-400" },
          { label: "Losses", val: String(metrics.losses), color: "text-red-400" },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-lg p-2.5 bg-secondary/20 border border-border">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Detail rows */}
      <div className="space-y-0">
        <MetricRow label="Profit Factor"  value={isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞"} color={pfColor} icon={TrendingUp} />
        <MetricRow label="Expectancy"     value={`${metrics.expectancy >= 0 ? "+" : ""}${metrics.expectancy.toFixed(1)} pips`} color={expColor} icon={Target} />
        <MetricRow label="Avg Win"        value={`+${metrics.avgWinPips} pips`} color="text-emerald-400" icon={TrendingUp} />
        <MetricRow label="Avg Loss"       value={`-${metrics.avgLossPips} pips`} color="text-red-400" icon={TrendingDown} />
        <MetricRow label="Max Drawdown"   value={fmtUSD(metrics.maxDrawdownUSD)} color="text-red-400" icon={AlertTriangle} />
        <MetricRow label="Signals"        value={String(metrics.totalTrades * 2)} icon={BarChart2} />
      </div>
    </div>
  );
}
