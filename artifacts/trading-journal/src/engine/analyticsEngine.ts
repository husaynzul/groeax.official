import { Trade } from '../types';

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
}

export function computeAnalytics(trades: Trade[]): Analytics {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netBalance: 0,
      winRate: 0,
      bestTrade: null,
      worstTrade: null,
      biggestProfit: 0,
      biggestLoss: 0,
      equityCurve: [],
      dailyPnL: [],
      drawdownCurve: [],
      rrScatter: [],
      tradesByDate: {},
      avgWin: 0,
      avgLoss: 0
    };
  }

  // Sort trades by date to calculate progressive metrics
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalProfit = 0;
  let totalLoss = 0;
  let wins = 0;
  let bestTrade: Trade | null = null;
  let worstTrade: Trade | null = null;
  let biggestProfit = 0;
  let biggestLoss = 0;

  const tradesByDate: Record<string, Trade[]> = {};
  const dailyPnLMap: Record<string, number> = {};

  sortedTrades.forEach(trade => {
    const tradePnL = trade.outcome === 'WIN' ? trade.netProfit : trade.outcome === 'LOSS' ? -trade.netLoss : 0;
    
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

    const dateKey = trade.date.split('T')[0];
    if (!tradesByDate[dateKey]) tradesByDate[dateKey] = [];
    tradesByDate[dateKey].push(trade);

    dailyPnLMap[dateKey] = (dailyPnLMap[dateKey] || 0) + tradePnL;
  });

  const netBalance = totalProfit - totalLoss;
  const winRate = sortedTrades.length > 0 ? (wins / sortedTrades.length) * 100 : 0;
  const avgWin = wins > 0 ? totalProfit / wins : 0;
  const losses = sortedTrades.filter(t => t.outcome === 'LOSS').length;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;

  const dailyPnL = Object.keys(dailyPnLMap).sort().map(date => ({
    date,
    pnl: dailyPnLMap[date]
  }));

  let currentEquity = 0;
  let maxEquity = 0;
  const equityCurve: { date: string; equity: number }[] = [];
  const drawdownCurve: { date: string; drawdown: number }[] = [];

  dailyPnL.forEach(day => {
    currentEquity += day.pnl;
    if (currentEquity > maxEquity) maxEquity = currentEquity;
    
    equityCurve.push({ date: day.date, equity: currentEquity });
    drawdownCurve.push({ date: day.date, drawdown: maxEquity - currentEquity });
  });

  const rrScatter = sortedTrades.map(t => ({
    rr: t.rr,
    profit: t.outcome === 'WIN' ? t.netProfit : t.outcome === 'LOSS' ? -t.netLoss : 0,
    pair: t.pair
  }));

  return {
    totalTrades: sortedTrades.length,
    totalProfit,
    totalLoss,
    netBalance,
    winRate,
    bestTrade,
    worstTrade,
    biggestProfit,
    biggestLoss,
    equityCurve,
    dailyPnL,
    drawdownCurve,
    rrScatter,
    tradesByDate,
    avgWin,
    avgLoss
  };
}
