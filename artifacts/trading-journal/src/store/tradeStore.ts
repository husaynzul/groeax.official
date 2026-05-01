import { create } from 'zustand';
import { Trade } from '../types';
import { saveToStorage, loadFromStorage, clearStorage } from '../storage/tradeStorage';

interface TradeStore {
  trades: Trade[];
  isHydrated: boolean;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, trade: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  isHydrated: false,
  
  addTrade: (trade) => {
    const current = get().trades;
    const next = [...current, trade];
    set({ trades: next });
    saveToStorage(next);
  },
  
  updateTrade: (id, updates) => {
    const current = get().trades;
    const next = current.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ trades: next });
    saveToStorage(next);
  },
  
  deleteTrade: (id) => {
    const current = get().trades;
    const next = current.filter((t) => t.id !== id);
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
    set({ trades, isHydrated: true });
  }
}));
