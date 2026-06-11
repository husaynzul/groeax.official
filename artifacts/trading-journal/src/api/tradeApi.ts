/**
 * Server-side trade sync API.
 * Handles cross-device sync — same data on PC, mobile, tablet.
 */
import { Trade } from "../types";

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Load all trades from the server for the logged-in user */
export async function fetchServerTrades(token: string): Promise<Trade[]> {
  const res = await fetch(`${BASE()}/api/trades/sync`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch trades from server.");
  return res.json();
}

/** Push a single trade to the server (create or update) */
export async function syncTrade(token: string, trade: Trade): Promise<void> {
  const res = await fetch(`${BASE()}/api/trades/sync`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error("Failed to sync trade.");
}

/** Delete a trade from the server */
export async function deleteServerTrade(token: string, clientId: string): Promise<void> {
  const res = await fetch(`${BASE()}/api/trades/sync/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete trade from server.");
}

/** Bulk push local trades to server — used on first login to upload offline trades */
export async function bulkSyncTrades(token: string, trades: Trade[]): Promise<void> {
  if (trades.length === 0) return;
  const res = await fetch(`${BASE()}/api/trades/sync/bulk`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(trades),
  });
  if (!res.ok) throw new Error("Failed to bulk sync trades.");
}
