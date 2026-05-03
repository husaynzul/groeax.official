import { create } from "zustand";

export type MT5Status = "disconnected" | "connecting" | "connected" | "error";

interface MT5State {
  status: MT5Status;
  lastPair: string | null;
  lastAt: number | null;
  setStatus: (status: MT5Status) => void;
  setLastTrade: (pair: string) => void;
}

export const useMT5Store = create<MT5State>((set) => ({
  status: "disconnected",
  lastPair: null,
  lastAt: null,
  setStatus: (status) => set({ status }),
  setLastTrade: (pair) => set({ lastPair: pair, lastAt: Date.now() }),
}));
