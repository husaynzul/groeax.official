import { create } from "zustand";

export type BrokerType =
  | "mt5" | "alpaca" | "oanda" | "ibkr" | "tradovate" | "ctrader"
  | "binance" | "coinbase" | "kraken" | "bybit" | "okx" | "kucoin"
  | "custom";

export type BrokerStatus = "idle" | "testing" | "connected" | "error";

export interface BrokerConnection {
  id: string;
  type: BrokerType;
  label: string;
  apiKey: string;
  apiSecret: string;
  accountId: string;
  serverUrl: string;
  paper: boolean;
  status: BrokerStatus;
  lastSync: number | null;
  tradesImported: number;
  errorMsg: string;
  accountEquity?: string;
  accountCurrency?: string;
}

interface BrokerStore {
  brokers: BrokerConnection[];
  addBroker: (b: Omit<BrokerConnection, "id" | "status" | "lastSync" | "tradesImported" | "errorMsg">) => string;
  updateBroker: (id: string, updates: Partial<BrokerConnection>) => void;
  removeBroker: (id: string) => void;
}

const STORAGE_KEY = "tradelog_brokers";

function load(): BrokerConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BrokerConnection[];
  } catch { /* ignore */ }
  return [];
}

function save(brokers: BrokerConnection[]) {
  try {
    const safe = brokers.map(b => ({
      ...b,
      apiKey: b.apiKey ? "***" : "",
      apiSecret: b.apiSecret ? "***" : "",
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch { /* ignore */ }
}

export const useBrokerStore = create<BrokerStore>((set, get) => ({
  brokers: load(),

  addBroker: (b) => {
    const id = `broker_${Date.now()}`;
    const conn: BrokerConnection = {
      ...b, id, status: "idle", lastSync: null, tradesImported: 0, errorMsg: "",
    };
    const next = [...get().brokers, conn];
    set({ brokers: next });
    save(next);
    return id;
  },

  updateBroker: (id, updates) => {
    const next = get().brokers.map(b => b.id === id ? { ...b, ...updates } : b);
    set({ brokers: next });
    save(next);
  },

  removeBroker: (id) => {
    const next = get().brokers.filter(b => b.id !== id);
    set({ brokers: next });
    save(next);
  },
}));
