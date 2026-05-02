import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { generateHistory, getNextCandle } from "../services/candleGenerator.js";
import type { OHLCBar } from "../services/candleGenerator.js";
import { logger } from "../lib/logger.js";

interface ClientState {
  ws: WebSocket;
  pair: string;
  tf: string;
  mode: "live" | "replay";
  replayIndex: number;
  replayBars: OHLCBar[];
  replayTimer?: ReturnType<typeof setInterval>;
  latestBar?: OHLCBar;
  liveTimer?: ReturnType<typeof setInterval>;
}

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function startLive(state: ClientState) {
  if (state.liveTimer) clearInterval(state.liveTimer);
  const history = generateHistory(state.pair, state.tf, 300);
  state.latestBar = history[history.length - 1];
  send(state.ws, { type: "history", pair: state.pair, tf: state.tf, bars: history });

  const tfMs: Record<string, number> = {
    M1: 2000, M5: 3000, M15: 4000, M30: 5000,
    H1: 6000, H4: 8000, D1: 12000,
  };
  const interval = tfMs[state.tf] ?? 6000;

  state.liveTimer = setInterval(() => {
    if (!state.latestBar) return;
    const next = getNextCandle(state.latestBar, state.pair, state.tf);
    state.latestBar = next;
    send(state.ws, { type: "candle", pair: state.pair, tf: state.tf, bar: next });
  }, interval);
}

function stopLive(state: ClientState) {
  if (state.liveTimer) { clearInterval(state.liveTimer); state.liveTimer = undefined; }
}

function startReplay(state: ClientState, speed = 1) {
  if (state.replayTimer) clearInterval(state.replayTimer);
  if (state.replayBars.length === 0) {
    state.replayBars = generateHistory(state.pair, state.tf, 300);
    state.replayIndex = 0;
  }
  send(state.ws, { type: "replay_reset", total: state.replayBars.length, index: state.replayIndex });
  state.replayTimer = setInterval(() => {
    if (state.replayIndex >= state.replayBars.length) {
      if (state.replayTimer) clearInterval(state.replayTimer);
      send(state.ws, { type: "replay_end" });
      return;
    }
    const bar = state.replayBars[state.replayIndex];
    send(state.ws, { type: "replay_bar", bar, index: state.replayIndex, total: state.replayBars.length });
    state.replayIndex++;
  }, Math.max(100, 800 / speed));
}

function pauseReplay(state: ClientState) {
  if (state.replayTimer) { clearInterval(state.replayTimer); state.replayTimer = undefined; }
}

function stepReplay(state: ClientState, delta: number) {
  pauseReplay(state);
  state.replayIndex = Math.max(0, Math.min(state.replayIndex + delta, state.replayBars.length - 1));
  const bar = state.replayBars[state.replayIndex];
  send(state.ws, { type: "replay_bar", bar, index: state.replayIndex, total: state.replayBars.length });
}

function seekReplay(state: ClientState, index: number) {
  pauseReplay(state);
  state.replayIndex = Math.max(0, Math.min(index, state.replayBars.length - 1));
  const bars = state.replayBars.slice(0, state.replayIndex + 1);
  send(state.ws, { type: "replay_seek", bars, index: state.replayIndex, total: state.replayBars.length });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/candles" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url }, "WS client connected");

    const state: ClientState = {
      ws, pair: "EURUSD", tf: "H1", mode: "live",
      replayIndex: 0, replayBars: [],
    };

    startLive(state);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        switch (msg["type"]) {
          case "subscribe": {
            stopLive(state);
            pauseReplay(state);
            state.pair = String(msg["pair"] ?? "EURUSD");
            state.tf   = String(msg["tf"]   ?? "H1");
            state.mode = "live";
            state.replayBars = [];
            state.replayIndex = 0;
            startLive(state);
            break;
          }
          case "replay_init": {
            stopLive(state);
            pauseReplay(state);
            state.pair = String(msg["pair"] ?? state.pair);
            state.tf   = String(msg["tf"]   ?? state.tf);
            state.mode = "replay";
            state.replayBars = generateHistory(state.pair, state.tf, 300);
            state.replayIndex = 0;
            const snapshot = state.replayBars.slice(0, 50);
            send(ws, { type: "replay_ready", bars: snapshot, total: state.replayBars.length, index: 49 });
            state.replayIndex = 49;
            break;
          }
          case "replay_play":
            startReplay(state, Number(msg["speed"] ?? 1));
            break;
          case "replay_pause":
            pauseReplay(state);
            send(ws, { type: "replay_paused", index: state.replayIndex });
            break;
          case "replay_step":
            stepReplay(state, Number(msg["delta"] ?? 1));
            break;
          case "replay_seek":
            seekReplay(state, Number(msg["index"] ?? 0));
            break;
          case "live_mode": {
            pauseReplay(state);
            state.mode = "live";
            startLive(state);
            break;
          }
        }
      } catch (e) {
        logger.warn({ e }, "WS parse error");
      }
    });

    ws.on("close", () => {
      stopLive(state);
      pauseReplay(state);
      logger.info("WS client disconnected");
    });
  });

  // MT5 Bridge stub — a Python script can connect here and push ticks
  const mt5Wss = new WebSocketServer({ server, path: "/api/ws/mt5" });
  mt5Wss.on("connection", (ws: WebSocket) => {
    logger.info("MT5 bridge connected");
    ws.on("message", (raw) => {
      try {
        const tick = JSON.parse(raw.toString());
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "mt5_tick", ...tick }));
          }
        });
      } catch { /* ignore malformed ticks */ }
    });
    ws.on("close", () => logger.info("MT5 bridge disconnected"));
  });

  logger.info("WebSocket servers ready: /api/ws/candles  /api/ws/mt5");
  return wss;
}
