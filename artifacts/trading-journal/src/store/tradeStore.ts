import { create } from 'zustand';
import { Trade } from '../types';
import { saveToStorage, loadFromStorage, clearStorage } from '../storage/tradeStorage';
import { fetchServerTrades, syncTrade, deleteServerTrade, bulkSyncTrades } from '../api/tradeApi';
import { getSavedToken } from './authStore';

const GOAL_KEY         = 'groeax_monthly_goal';
const BALANCE_KEY      = 'groeax_starting_balance';
const GOAL_PCT_KEY     = 'groeax_monthly_goal_pct';
const TRADING_DAYS_KEY = 'groeax_trading_days';

interface TradeStore {
  trades: Trade[];
  isHydrated: boolean;
  monthlyGoal: number;
  monthlyGoalPct: number;
  tradingDaysPerMonth: number;
  startingBalance: number;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, trade: Partial<Trade>) => void;
  bulkUpdateTrades: (updates: { id: string; changes: Partial<Trade> }[]) => void;
  deleteTrade: (id: string) => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
  setMonthlyGoal: (goal: number) => void;
  setMonthlyGoalPct: (pct: number) => void;
  setTradingDaysPerMonth: (days: number) => void;
  setStartingBalance: (balance: number) => void;
}

function loadGoal(): number {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (raw) return parseFloat(raw);
  } catch {}
  return 0;
}

function loadGoalPct(): number {
  try {
    const raw = localStorage.getItem(GOAL_PCT_KEY);
    if (raw) return parseFloat(raw);
  } catch {}
  return 0;
}

function loadTradingDays(): number {
  try {
    const raw = localStorage.getItem(TRADING_DAYS_KEY);
    if (raw) return parseInt(raw, 10);
  } catch {}
  return 22;
}

function loadStartingBalance(): number {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw) return parseFloat(raw);
  } catch {}
  return 0;
}

function loadAll() {
  return {
    monthlyGoal: loadGoal(),
    monthlyGoalPct: loadGoalPct(),
    tradingDaysPerMonth: loadTradingDays(),
    startingBalance: loadStartingBalance(),
  };
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  isHydrated: false,
  ...loadAll(),

  addTrade: (trade) => {
    const next = [...get().trades, trade];
    set({ trades: next });
    saveToStorage(next);
    const token = getSavedToken();
    if (token) syncTrade(token, trade).catch(console.error);
  },

  updateTrade: (id, updates) => {
    const next = get().trades.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ trades: next });
    saveToStorage(next);
    const token = getSavedToken();
    if (token) {
      const updated = next.find((t) => t.id === id);
      if (updated) syncTrade(token, updated).catch(console.error);
    }
  },

  bulkUpdateTrades: (updates) => {
    const map = new Map(updates.map(u => [u.id, u.changes]));
    const next = get().trades.map(t => {
      const changes = map.get(t.id);
      return changes ? { ...t, ...changes } : t;
    });
    set({ trades: next });
    saveToStorage(next);
    const token = getSavedToken();
    if (token) {
      const updatedIds = new Set(updates.map(u => u.id));
      const toSync = next.filter(t => updatedIds.has(t.id));
      bulkSyncTrades(token, toSync).catch(console.error);
    }
  },

  deleteTrade: (id) => {
    const next = get().trades.filter((t) => t.id !== id);
    set({ trades: next });
    saveToStorage(next);
    const token = getSavedToken();
    if (token) deleteServerTrade(token, id).catch(console.error);
  },

  clearAll: () => {
    set({ trades: [] });
    clearStorage();
  },

  hydrate: async () => {
    if (get().isHydrated) return;

    const token = getSavedToken();

    if (token) {
      try {
        const localTrades = await loadFromStorage();
        const serverTrades = await fetchServerTrades(token);

        if (serverTrades.length > 0) {
          set({ trades: serverTrades, isHydrated: true, ...loadAll() });
          saveToStorage(serverTrades);
        } else if (localTrades.length > 0) {
          set({ trades: localTrades, isHydrated: true, ...loadAll() });
          bulkSyncTrades(token, localTrades).catch(console.error);
        } else {
          set({ trades: [], isHydrated: true, ...loadAll() });
        }
        return;
      } catch (err) {
        console.warn('[TradeStore] Server sync failed, falling back to local storage:', err);
      }
    }

    const trades = await loadFromStorage();
    set({ trades, isHydrated: true, ...loadAll() });
  },

  setMonthlyGoal: (goal) => {
    set({ monthlyGoal: goal });
    try { localStorage.setItem(GOAL_KEY, String(goal)); } catch {}
  },

  setMonthlyGoalPct: (pct) => {
    set({ monthlyGoalPct: pct });
    try { localStorage.setItem(GOAL_PCT_KEY, String(pct)); } catch {}
  },

  setTradingDaysPerMonth: (days) => {
    set({ tradingDaysPerMonth: days });
    try { localStorage.setItem(TRADING_DAYS_KEY, String(days)); } catch {}
  },

  setStartingBalance: (balance) => {
    set({ startingBalance: balance });
    try { localStorage.setItem(BALANCE_KEY, String(balance)); } catch {}
  },
}));
