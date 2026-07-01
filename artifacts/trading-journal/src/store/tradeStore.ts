import { create } from 'zustand';
import { Trade } from '../types';
import { saveToStorage, loadFromStorage, clearStorage } from '../storage/tradeStorage';
import { fetchServerTrades, syncTrade, deleteServerTrade, bulkSyncTrades } from '../api/tradeApi';
import { getSavedToken } from './authStore';

const GOAL_KEY          = 'groeax_monthly_goal';
const BALANCE_KEY       = 'groeax_starting_balance';
const GOAL_PCT_KEY      = 'groeax_monthly_goal_pct';
const TRADING_DAYS_KEY  = 'groeax_trading_days';
const DAILY_LOSS_KEY    = 'groeax_daily_loss_limit';
const MAX_LOSS_KEY      = 'groeax_max_loss_limit';
const PROFIT_TGT_KEY    = 'groeax_profit_target_pct';
const MIN_DAYS_KEY      = 'groeax_min_trading_days';
const CONSISTENCY_KEY   = 'groeax_consistency_rule';

interface TradeStore {
  trades: Trade[];
  isHydrated: boolean;
  monthlyGoal: number;
  monthlyGoalPct: number;
  tradingDaysPerMonth: number;
  startingBalance: number;
  dailyLossLimit: number;
  maxLossLimit: number;
  profitTargetPct: number;
  minTradingDays: number;
  consistencyRule: boolean;
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
  setDailyLossLimit: (v: number) => void;
  setMaxLossLimit: (v: number) => void;
  setProfitTargetPct: (v: number) => void;
  setMinTradingDays: (v: number) => void;
  setConsistencyRule: (v: boolean) => void;
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

function loadNum(key: string, fallback: number): number {
  try { const r = localStorage.getItem(key); if (r !== null) return parseFloat(r); } catch {}
  return fallback;
}
function loadBool(key: string, fallback: boolean): boolean {
  try { const r = localStorage.getItem(key); if (r !== null) return r === 'true'; } catch {}
  return fallback;
}

function loadAll() {
  return {
    monthlyGoal: loadGoal(),
    monthlyGoalPct: loadGoalPct(),
    tradingDaysPerMonth: loadTradingDays(),
    startingBalance: loadStartingBalance(),
    dailyLossLimit: loadNum(DAILY_LOSS_KEY, 0),
    maxLossLimit: loadNum(MAX_LOSS_KEY, 0),
    profitTargetPct: loadNum(PROFIT_TGT_KEY, 0),
    minTradingDays: loadNum(MIN_DAYS_KEY, 0),
    consistencyRule: loadBool(CONSISTENCY_KEY, false),
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

  setDailyLossLimit: (v) => {
    set({ dailyLossLimit: v });
    try { localStorage.setItem(DAILY_LOSS_KEY, String(v)); } catch {}
  },

  setMaxLossLimit: (v) => {
    set({ maxLossLimit: v });
    try { localStorage.setItem(MAX_LOSS_KEY, String(v)); } catch {}
  },

  setProfitTargetPct: (v) => {
    set({ profitTargetPct: v });
    try { localStorage.setItem(PROFIT_TGT_KEY, String(v)); } catch {}
  },

  setMinTradingDays: (v) => {
    set({ minTradingDays: v });
    try { localStorage.setItem(MIN_DAYS_KEY, String(v)); } catch {}
  },

  setConsistencyRule: (v) => {
    set({ consistencyRule: v });
    try { localStorage.setItem(CONSISTENCY_KEY, String(v)); } catch {}
  },
}));
