import { useState, useCallback } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { matchRoundTrips, buildSummary, PnLSummary } from "@/engine/pnlEngine";

export interface RecalcResult {
  summary: PnLSummary;
  error?: string;
}

export function usePnLRecalculator() {
  const trades = useTradeStore(s => s.trades);
  const bulkUpdateTrades = useTradeStore(s => s.bulkUpdateTrades);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<RecalcResult | null>(null);

  const recalculate = useCallback(async (): Promise<RecalcResult> => {
    setRunning(true);
    setLastResult(null);
    try {
      const updates = matchRoundTrips(trades);
      const summary = buildSummary(updates);

      if (updates.length > 0) {
        bulkUpdateTrades(
          updates.map(u => ({
            id: u.id,
            changes: {
              outcome:   u.outcome,
              netProfit: u.netProfit,
              netLoss:   u.netLoss,
              rr:        u.rr,
              entryPrice: u.entryPrice,
              notes:     u.notes,
            },
          }))
        );
      }

      const result: RecalcResult = { summary };
      setLastResult(result);
      return result;
    } catch (err) {
      const result: RecalcResult = {
        summary: { matchedPositions: 0, totalPnL: 0, wins: 0, losses: 0, breakeven: 0 },
        error: String(err),
      };
      setLastResult(result);
      return result;
    } finally {
      setRunning(false);
    }
  }, [trades, bulkUpdateTrades]);

  return { recalculate, running, lastResult };
}
