import { create } from "zustand";

export type Plan = "free" | "monthly" | "yearly";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  plan: Plan;
  planExpiresAt: string | null;
  createdAt: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  isPremium: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setReady: () => void;
  updateUser: (user: AuthUser) => void;
}

const TOKEN_KEY = "groeax_token";

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  ready: false,
  isPremium: false,

  setAuth: (user, token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    set({ user, token, isPremium: user.plan !== "free" });
  },

  clearAuth: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    set({ user: null, token: null, isPremium: false });
  },

  setReady: () => set({ ready: true }),

  updateUser: (user) => set({ user, isPremium: user.plan !== "free" }),
}));

export function getSavedToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

export async function apiSignup(name: string, email: string, password: string) {
  const res = await fetch(`${BASE()}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Signup failed");
  return data as { token: string; user: AuthUser };
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as { token: string; user: AuthUser };
}

export async function apiMe(token: string) {
  const res = await fetch(`${BASE()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user as AuthUser;
}

export async function apiSubscribe(token: string, plan: "monthly" | "yearly") {
  const res = await fetch(`${BASE()}/api/auth/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Subscription failed");
  return data.user as AuthUser;
}
