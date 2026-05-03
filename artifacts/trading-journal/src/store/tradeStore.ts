import { create } from 'zustand';
import { Trade } from '../types';
import { saveToStorage, loadFromStorage, clearStorage } from '../storage/tradeStorage';

const GOAL_KEY = 'groeax_monthly_goal';

interface TradeStore {
  trades: Trade[];
  isHydrated: boolean;
  monthlyGoal: number;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, trade: Partial<Trade>) => void;
  bulkUpdateTrades: (updates: { id: string; changes: Partial<Trade> }[]) => void;
  deleteTrade: (id: string) => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
  setMonthlyGoal: (goal: number) => void;
}

function loadGoal(): number {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (raw) return parseFloat(raw);
  } catch {}
  return 0;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  isHydrated: false,
  monthlyGoal: loadGoal(),

  addTrade: (trade) => {
    const next = [...get().trades, trade];
    set({ trades: next });
    saveToStorage(next);
  },

  updateTrade: (id, updates) => {
    const next = get().trades.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ trades: next });
    saveToStorage(next);
  },

  bulkUpdateTrades: (updates) => {
    const map = new Map(updates.map(u => [u.id, u.changes]));
    const next = get().trades.map(t => {
      const changes = map.get(t.id);
      return changes ? { ...t, ...changes } : t;
    });
    set({ trades: next });
    saveToStorage(next);
  },

  deleteTrade: (id) => {
    const next = get().trades.filter((t) => t.id !== id);
    set({ trades: next });
    saveToStorage(next);
  },

  clearAll: () => {
    set({ trades: [] });
    clearStorage();
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    const trades = await loadFromStorage();
    set({ trades, isHydrated: true, monthlyGoal: loadGoal() });
  },

  setMonthlyGoal: (goal) => {
    set({ monthlyGoal: goal });
    try { localStorage.setItem(GOAL_KEY, String(goal)); } catch {}
  },
}));
