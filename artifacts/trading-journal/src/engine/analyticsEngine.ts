import { Trade } from '../types';

export interface StrategyStats {
  name: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netPnL: number;
  avgRR: number;
}

export interface Analytics {
  totalTrades: number;
  totalProfit: number;
  totalLoss: number;
  netBalance: number;
  winRate: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  biggestProfit: number;
  biggestLoss: number;
  equityCurve: { date: string; equity: number }[];
  dailyPnL: { date: string; pnl: number }[];
  drawdownCurve: { date: string; drawdown: number }[];
  rrScatter: { rr: number; profit: number; pair: string }[];
  tradesByDate: Record<string, Trade[]>;
  avgWin: number;
  avgLoss: number;
  strategyStats: StrategyStats[];
  weeklyPnL: { week: string; pnl: number }[];
  monthlyPnL: { month: string; pnl: number }[];
}

/**
 * Extract a timezone-safe YYYY-MM-DD key from any date string.
 * Uses noon local time to avoid day boundaries.
 */
function safeDateKey(raw: string): string | null {
  if (!raw) return null;
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

export function computeAnalytics(trades: Trade[]): Analytics {
  const empty: Analytics = {
    totalTrades: 0, totalProfit: 0, totalLoss: 0, netBalance: 0,
    winRate: 0, bestTrade: null, worstTrade: null, biggestProfit: 0,
    biggestLoss: 0, equityCurve: [], dailyPnL: [], drawdownCurve: [],
    rrScatter: [], tradesByDate: {}, avgWin: 0, avgLoss: 0,
    strategyStats: [], weeklyPnL: [], monthlyPnL: [],
  };
  if (!trades || trades.length === 0) return empty;

  const sorted = [...trades]
    .filter(t => safeDateKey(t.date) !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length === 0) return empty;

  let totalProfit = 0, totalLoss = 0, wins = 0, biggestProfit = 0, biggestLoss = 0;
  let bestTrade: Trade | null = null, worstTrade: Trade | null = null;
  const tradesByDate: Record<string, Trade[]> = {};
  const dailyPnLMap: Record<string, number> = {};
  const weeklyMap: Record<string, number> = {};
  const monthlyMap: Record<string, number> = {};
  const stratMap: Record<string, { wins: number; losses: number; count: number; profit: number; loss: number; rrSum: number }> = {};

  sorted.forEach(trade => {
    const pnl = trade.outcome === 'WIN' ? trade.netProfit
               : trade.outcome === 'LOSS' ? -trade.netLoss : 0;

    if (trade.outcome === 'WIN') {
      totalProfit += trade.netProfit;
      wins++;
      if (!bestTrade || trade.netProfit > biggestProfit) {
        bestTrade = trade;
        biggestProfit = trade.netProfit;
      }
    } else if (trade.outcome === 'LOSS') {
      totalLoss += trade.netLoss;
      if (!worstTrade || trade.netLoss > biggestLoss) {
        worstTrade = trade;
        biggestLoss = trade.netLoss;
      }
    }

    const dateKey = safeDateKey(trade.date)!;
    if (!tradesByDate[dateKey]) tradesByDate[dateKey] = [];
    tradesByDate[dateKey].push(trade);
    dailyPnLMap[dateKey] = (dailyPnLMap[dateKey] ?? 0) + pnl;

    const d = new Date(dateKey + 'T12:00:00');
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    weeklyMap[weekKey] = (weeklyMap[weekKey] ?? 0) + pnl;

    const monthKey = dateKey.slice(0, 7);
    monthlyMap[monthKey] = (monthlyMap[monthKey] ?? 0) + pnl;

    if (trade.strategy) {
      if (!stratMap[trade.strategy]) {
        stratMap[trade.strategy] = { wins: 0, losses: 0, count: 0, profit: 0, loss: 0, rrSum: 0 };
      }
      const s = stratMap[trade.strategy];
      s.count++;
      s.rrSum += trade.rr;
      if (trade.outcome === 'WIN') { s.wins++; s.profit += trade.netProfit; }
      else if (trade.outcome === 'LOSS') { s.losses++; s.loss += trade.netLoss; }
    }
  });

  const netBalance = totalProfit - totalLoss;
  const winRate = sorted.length > 0 ? (wins / sorted.length) * 100 : 0;
  const losses = sorted.filter(t => t.outcome === 'LOSS').length;
  const avgWin = wins > 0 ? totalProfit / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;

  const dailyPnL = Object.keys(dailyPnLMap).sort().map(date => ({ date, pnl: parseFloat(dailyPnLMap[date].toFixed(2)) }));
  const weeklyPnL = Object.keys(weeklyMap).sort().map(week => ({ week, pnl: weeklyMap[week] }));
  const monthlyPnL = Object.keys(monthlyMap).sort().map(month => ({ month, pnl: monthlyMap[month] }));

  let currentEquity = 0, maxEquity = 0;
  const equityCurve: { date: string; equity: number }[] = [];
  const drawdownCurve: { date: string; drawdown: number }[] = [];
  dailyPnL.forEach(day => {
    currentEquity += day.pnl;
    if (currentEquity > maxEquity) maxEquity = currentEquity;
    equityCurve.push({ date: day.date, equity: parseFloat(currentEquity.toFixed(2)) });
    drawdownCurve.push({ date: day.date, drawdown: parseFloat((maxEquity - currentEquity).toFixed(2)) });
  });

  const rrScatter = sorted.map(t => ({
    rr: t.rr,
    profit: t.outcome === 'WIN' ? t.netProfit : t.outcome === 'LOSS' ? -t.netLoss : 0,
    pair: t.pair,
  }));

  const strategyStats: StrategyStats[] = Object.entries(stratMap).map(([name, v]) => ({
    name,
    count: v.count,
    wins: v.wins,
    losses: v.losses,
    winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
    totalProfit: v.profit,
    totalLoss: v.loss,
    netPnL: parseFloat((v.profit - v.loss).toFixed(2)),
    avgRR: v.count > 0 ? parseFloat((v.rrSum / v.count).toFixed(2)) : 0,
  })).sort((a, b) => b.netPnL - a.netPnL);

  return {
    totalTrades: sorted.length, totalProfit, totalLoss, netBalance, winRate,
    bestTrade, worstTrade, biggestProfit, biggestLoss,
    equityCurve, dailyPnL, drawdownCurve, rrScatter, tradesByDate,
    avgWin, avgLoss, strategyStats, weeklyPnL, monthlyPnL,
  };
}
