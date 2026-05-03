import { useEffect, ReactNode } from "react";
import { useAuthStore, getSavedToken, apiMe } from "@/store/authStore";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setAuth, clearAuth, setReady } = useAuthStore();

  useEffect(() => {
    const token = getSavedToken();
    if (!token) {
      setReady();
      return;
    }
    apiMe(token).then((user) => {
      if (user) {
        setAuth(user, token);
      } else {
        clearAuth();
      }
    }).catch(() => clearAuth()).finally(() => setReady());
  }, []);

  return <>{children}</>;
}
