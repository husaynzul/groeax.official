import { create } from "zustand";

const ADMIN_TOKEN_KEY = "groeax_admin_token";

interface AdminStore {
  token: string | null;
  ready: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
  init: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  token: null,
  ready: false,
  setToken: (token) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    set({ token });
  },
  clearToken: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    set({ token: null });
  },
  init: () => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    set({ token, ready: true });
  },
}));
