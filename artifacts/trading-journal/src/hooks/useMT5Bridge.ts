import { useEffect, useRef, useState, useCallback } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { usePnLRecalculator } from "@/hooks/usePnLRecalculator";
import type { Trade } from "@/types";

export type MT5Status = "disconnected" | "connecting" | "connected" | "error";

interface MT5TradeData {
  type: "trade_open" | "trade_close";
  ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  price: number;
  sl: number;
  tp: number;
  profit: number;
  time: string;
  comment?: string;
}

export interface MT5LastTrade {
  pair: string;
  direction: "BUY" | "SELL";
  type: "trade_open" | "trade_close";
  profit: number;
  at: number;
}

function buildTrade(ev: MT5TradeData): Trade {
  const date = ev.time.slice(0, 10);
  const profit = ev.profit ?? 0;
  return {
    id: crypto.randomUUID(),
    pair: ev.symbol,
    direction: ev.direction,
    entryPrice: ev.price,
    stopLoss: ev.sl ?? 0,
    takeProfit: ev.tp ?? 0,
    lotSize: ev.lots,
    date,
    notes: ev.comment
      ? `MT5 #${ev.ticket} — ${ev.comment}`
      : `MT5 ticket #${ev.ticket}`,
    outcome: profit > 0 ? "WIN" : profit < 0 ? "LOSS" : "BE",
    netProfit: profit > 0 ? profit : 0,
    netLoss: profit < 0 ? Math.abs(profit) : 0,
    rr: 0,
  };
}

export function useMT5Bridge() {
  const { addTrade } = useTradeStore();
  const { recalculate } = usePnLRecalculator();

  const [status, setStatus] = useState<MT5Status>("disconnected");
  const [lastTrade, setLastTrade] = useState<MT5LastTrade | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws/app`;

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setStatus("connected");
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus("error");
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("disconnected");
      reconnectRef.current = setTimeout(connect, 5_000);
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data as string) as { type: string; data: MT5TradeData };
        if (msg.type === "mt5_trade" && msg.data) {
          const trade = buildTrade(msg.data);
          addTrade(trade);
          setLastTrade({
            pair: trade.pair,
            direction: trade.direction,
            type: msg.data.type,
            profit: msg.data.profit,
            at: Date.now(),
          });
          void recalculate();
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, [addTrade, recalculate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastTrade };
}
