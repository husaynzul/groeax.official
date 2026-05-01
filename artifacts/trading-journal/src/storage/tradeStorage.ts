import { openDB } from 'idb';
import { Trade } from '../types';

const DB_NAME = 'TradeLogDB';
const STORE_NAME = 'trades';
const DB_VERSION = 1;

async function getDB() {
  if (typeof window === 'undefined') return null;
  if (!('indexedDB' in window)) return null;

  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveToStorage(trades: Trade[]): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await store.clear();
      for (const trade of trades) {
        await store.put(trade);
      }
      await tx.done;
    } else {
      localStorage.setItem('tradelog_trades', JSON.stringify(trades));
    }
  } catch (e) {
    console.error('Failed to save trades to storage:', e);
    localStorage.setItem('tradelog_trades', JSON.stringify(trades));
  }
}

export async function loadFromStorage(): Promise<Trade[]> {
  if (typeof window === 'undefined') return [];

  try {
    const db = await getDB();
    if (db) {
      const trades = await db.getAll(STORE_NAME);
      if (trades.length > 0) return trades;
    }
  } catch (e) {
    console.error('Failed to load trades from IndexedDB:', e);
  }

  const localData = localStorage.getItem('tradelog_trades');
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch (e) {
      console.error('Failed to parse trades from localStorage:', e);
    }
  }

  return [];
}

export async function clearStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await tx.objectStore(STORE_NAME).clear();
      await tx.done;
    }
  } catch (e) {
    console.error('Failed to clear IndexedDB:', e);
  }

  localStorage.removeItem('tradelog_trades');
}
