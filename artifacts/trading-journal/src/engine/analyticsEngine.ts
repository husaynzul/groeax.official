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

export interface DrawdownStats {
  peak: number;
  currentEquity: number;
  drawdownAmount: number;
  drawdownPercent: number;
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
  drawdownStats: DrawdownStats;
  rrScatter: { rr: number; profit: number; pair: string }[];
  tradesByDate: Record<string, Trade[]>;
  avgWin: number;
  avgLoss: number;
  avgRR: number;
  expectancy: number;
  recoveryFactor: number;
  profitFactor: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  sharpeRatio: number;
  sortinoRatio: number;
  strategyStats: StrategyStats[];
  weeklyPnL: { week: string; pnl: number }[];
  monthlyPnL: { month: string; pnl: number }[];
}

function safeDateKey(raw: string): string | null {
  if (!raw) return null;
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

export function computeAnalytics(trades: Trade[], startingBalance = 0): Analytics {
  const emptyDrawdown: DrawdownStats = { peak: 0, currentEquity: 0, drawdownAmount: 0, drawdownPercent: 0 };
  const empty: Analytics = {
    totalTrades: 0, totalProfit: 0, totalLoss: 0, netBalance: 0,
    winRate: 0, bestTrade: null, worstTrade: null, biggestProfit: 0,
    biggestLoss: 0, equityCurve: [], dailyPnL: [], drawdownCurve: [],
    drawdownStats: emptyDrawdown,
    rrScatter: [], tradesByDate: {}, avgWin: 0, avgLoss: 0,
    avgRR: 0, expectancy: 0, recoveryFactor: 0, profitFactor: 0,
    maxConsecWins: 0, maxConsecLosses: 0, sharpeRatio: 0, sortinoRatio: 0,
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

  // Consecutive win/loss tracking
  let maxConsecWins = 0, maxConsecLosses = 0, consecWins = 0, consecLosses = 0;

  // Average RR
  const rrValues: number[] = [];

  sorted.forEach(trade => {
    const pnl = trade.outcome === 'WIN' ? trade.netProfit
               : trade.outcome === 'LOSS' ? -trade.netLoss : 0;

    if (trade.outcome === 'WIN') {
      totalProfit += trade.netProfit;
      wins++;
      consecWins++;
      consecLosses = 0;
      maxConsecWins = Math.max(maxConsecWins, consecWins);
      if (!bestTrade || trade.netProfit > biggestProfit) {
        bestTrade = trade;
        biggestProfit = trade.netProfit;
      }
    } else if (trade.outcome === 'LOSS') {
      totalLoss += trade.netLoss;
      consecLosses++;
      consecWins = 0;
      maxConsecLosses = Math.max(maxConsecLosses, consecLosses);
      if (!worstTrade || trade.netLoss > biggestLoss) {
        worstTrade = trade;
        biggestLoss = trade.netLoss;
      }
    } else {
      consecWins = 0;
      consecLosses = 0;
    }

    if ((trade.rr ?? 0) > 0 && (trade.outcome === 'WIN' || trade.outcome === 'LOSS')) {
      rrValues.push(trade.rr);
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
  const total = sorted.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const losses = sorted.filter(t => t.outcome === 'LOSS').length;
  const avgWin = wins > 0 ? totalProfit / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;

  // Avg RR
  const avgRR = rrValues.length > 0 ? rrValues.reduce((s, r) => s + r, 0) / rrValues.length : 0;

  // Profit Factor
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

  // Expectancy = (WinRate × AvgWin) - (LossRate × AvgLoss)
  const winRateFrac = winRate / 100;
  const lossRateFrac = 1 - winRateFrac;
  const expectancy = (winRateFrac * avgWin) - (lossRateFrac * avgLoss);

  const dailyPnL = Object.keys(dailyPnLMap).sort().map(date => ({ date, pnl: parseFloat(dailyPnLMap[date].toFixed(2)) }));
  const weeklyPnL = Object.keys(weeklyMap).sort().map(week => ({ week, pnl: weeklyMap[week] }));
  const monthlyPnL = Object.keys(monthlyMap).sort().map(month => ({ month, pnl: monthlyMap[month] }));

  // Per-trade equity & peak tracking
  let currentEquity    = startingBalance;
  let runningPeak      = startingBalance;
  let maxDrawdownAmt   = 0;
  let maxDrawdownPeak  = startingBalance;

  const equityByDay: Record<string, number>    = {};
  const drawdownByDay: Record<string, number>  = {};

  sorted.forEach(trade => {
    const pnl = trade.outcome === 'WIN'  ? trade.netProfit
               : trade.outcome === 'LOSS' ? -trade.netLoss : 0;

    currentEquity = parseFloat((currentEquity + pnl).toFixed(10));
    if (currentEquity > runningPeak) runningPeak = currentEquity;
    const dd = Math.max(runningPeak - currentEquity, 0);
    if (dd > maxDrawdownAmt) {
      maxDrawdownAmt  = dd;
      maxDrawdownPeak = runningPeak;
    }
    const dateKey = safeDateKey(trade.date)!;
    equityByDay[dateKey]   = parseFloat(currentEquity.toFixed(2));
    drawdownByDay[dateKey] = parseFloat(dd.toFixed(2));
  });

  const equityCurve = Object.keys(equityByDay).sort()
    .map(date => ({ date, equity: equityByDay[date] }));

  const drawdownCurve = Object.keys(drawdownByDay).sort()
    .map(date => ({ date, drawdown: drawdownByDay[date] }));

  const finalDrawdownAmount  = parseFloat(maxDrawdownAmt.toFixed(2));
  const finalDrawdownPercent = maxDrawdownPeak > 0
    ? parseFloat(((maxDrawdownAmt / maxDrawdownPeak) * 100).toFixed(2))
    : 0;

  const drawdownStats: DrawdownStats = {
    peak:            parseFloat(runningPeak.toFixed(2)),
    currentEquity:   parseFloat(currentEquity.toFixed(2)),
    drawdownAmount:  finalDrawdownAmount,
    drawdownPercent: finalDrawdownPercent,
  };

  // Recovery Factor = Net Profit / Max Drawdown Amount
  const recoveryFactor = finalDrawdownAmount > 0
    ? parseFloat((netBalance / finalDrawdownAmount).toFixed(2))
    : netBalance > 0 ? 999 : 0;

  // Sharpe & Sortino (annualised, using daily returns vs 0 risk-free)
  const dailyReturns = dailyPnL.map(d => startingBalance > 0 ? d.pnl / startingBalance : 0);
  let sharpeRatio = 0, sortinoRatio = 0;
  if (dailyReturns.length > 1) {
    const meanRet = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - meanRet, 2), 0) / (dailyReturns.length - 1);
    const stdDev   = Math.sqrt(variance);
    const downsideVariance = dailyReturns.reduce((s, r) => s + Math.pow(Math.min(r, 0), 2), 0) / (dailyReturns.length - 1);
    const downsideDev = Math.sqrt(downsideVariance);
    const annFactor = Math.sqrt(252);
    sharpeRatio  = stdDev > 0 ? parseFloat(((meanRet / stdDev) * annFactor).toFixed(2)) : 0;
    sortinoRatio = downsideDev > 0 ? parseFloat(((meanRet / downsideDev) * annFactor).toFixed(2)) : 0;
  }

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
    equityCurve, dailyPnL, drawdownCurve, drawdownStats,
    rrScatter, tradesByDate,
    avgWin, avgLoss, avgRR,
    expectancy, recoveryFactor, profitFactor,
    maxConsecWins, maxConsecLosses,
    sharpeRatio, sortinoRatio,
    strategyStats, weeklyPnL, monthlyPnL,
  };
}
