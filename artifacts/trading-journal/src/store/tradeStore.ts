import { create } from 'zustand';
import { Trade } from '../types';
import { saveToStorage, loadFromStorage, clearStorage } from '../storage/tradeStorage';
import { fetchServerTrades, syncTrade, deleteServerTrade, bulkSyncTrades } from '../api/tradeApi';
import { getSavedToken } from './authStore';

const GOAL_KEY    = 'groeax_monthly_goal';
const BALANCE_KEY = 'groeax_starting_balance';

interface TradeStore {
  trades: Trade[];
  isHydrated: boolean;
  monthlyGoal: number;
  startingBalance: number;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, trade: Partial<Trade>) => void;
  bulkUpdateTrades: (updates: { id: string; changes: Partial<Trade> }[]) => void;
  deleteTrade: (id: string) => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
  setMonthlyGoal: (goal: number) => void;
  setStartingBalance: (balance: number) => void;
}

function loadGoal(): number {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (raw) return parseFloat(raw);
  } catch {}
  return 0;
}

function loadStartingBalance(): number {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw) return parseFloat(raw);
  } catch {}
  return 0;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  isHydrated: false,
  monthlyGoal: loadGoal(),
  startingBalance: loadStartingBalance(),

  addTrade: (trade) => {
    const next = [...get().trades, trade];
    set({ trades: next });
    saveToStorage(next);
    // Sync to server in background (fire and forget)
    const token = getSavedToken();
    if (token) syncTrade(token, trade).catch(console.error);
  },

  updateTrade: (id, updates) => {
    const next = get().trades.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ trades: next });
    saveToStorage(next);
    // Sync updated trade to server
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
    // Sync all updated trades to server
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
    // Delete from server
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
        // Load any locally saved trades first for instant display
        const localTrades = await loadFromStorage();

        // Fetch server trades (the source of truth when logged in)
        const serverTrades = await fetchServerTrades(token);

        if (serverTrades.length > 0) {
          // Server has data — use it as the source of truth
          set({ trades: serverTrades, isHydrated: true, monthlyGoal: loadGoal(), startingBalance: loadStartingBalance() });
          // Also save to local for offline use
          saveToStorage(serverTrades);
        } else if (localTrades.length > 0) {
          // Server is empty but we have local trades — push them up (first login on new account)
          set({ trades: localTrades, isHydrated: true, monthlyGoal: loadGoal(), startingBalance: loadStartingBalance() });
          bulkSyncTrades(token, localTrades).catch(console.error);
        } else {
          set({ trades: [], isHydrated: true, monthlyGoal: loadGoal(), startingBalance: loadStartingBalance() });
        }
        return;
      } catch (err) {
        console.warn('[TradeStore] Server sync failed, falling back to local storage:', err);
      }
    }

    // Not logged in or server unreachable — use local storage
    const trades = await loadFromStorage();
    set({ trades, isHydrated: true, monthlyGoal: loadGoal(), startingBalance: loadStartingBalance() });
  },

  setMonthlyGoal: (goal) => {
    set({ monthlyGoal: goal });
    try { localStorage.setItem(GOAL_KEY, String(goal)); } catch {}
  },

  setStartingBalance: (balance) => {
    set({ startingBalance: balance });
    try { localStorage.setItem(BALANCE_KEY, String(balance)); } catch {}
  },
}));
