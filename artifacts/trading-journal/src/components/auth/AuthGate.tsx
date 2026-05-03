import { ReactNode, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mail, UserPlus, LogIn, ShieldCheck, Loader2 } from "lucide-react";
import groeaxLogo from "@assets/image_1777793677793_1777793731333.jpeg";

const AUTH_KEY = "tradelog_auth_user";

type AuthUser = {
  name: string;
  email: string;
};

export function useAuthState() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {}
    setReady(true);
  }, []);

  const auth = useMemo(() => ({
    user,
    ready,
    signIn: (next: AuthUser) => {
      setUser(next);
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(next));
      } catch {}
    },
    signOut: () => {
      setUser(null);
      try {
        localStorage.removeItem(AUTH_KEY);
      } catch {}
    },
  }), [user, ready]);

  return auth;
}

export function AuthGate({
  user,
  onSignIn,
  children,
}: {
  user: AuthUser | null;
  onSignIn: (user: AuthUser) => void;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingDelay, setLoadingDelay] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setLoadingDelay(false), 700);
    return () => clearTimeout(id);
  }, []);

  const submit = () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) return setError("Enter a valid email.");
    if (mode === "signup" && cleanName.length < 2) return setError("Enter your full name.");
    onSignIn({ name: cleanName || cleanEmail.split("@")[0], email: cleanEmail });
  };

  if (user) return <>{children}</>;

  if (loadingDelay) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading Groeax…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.10),transparent_18%)] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b0f18]/95 backdrop-blur-xl shadow-[0_28px_120px_rgba(0,0,0,0.55)] p-6">
        <div className="flex items-center gap-3 mb-6">
          <img src={groeaxLogo} alt="Groeax logo" className="w-11 h-11 object-contain rounded-2xl border border-white/10 bg-black/10" style={{ filter: "drop-shadow(0 0 12px rgba(16,185,129,0.8))" }} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Groeax</h1>
            <p className="text-xs text-muted-foreground">Sign up or log in to continue</p>
          </div>
        </div>

        <div className="flex gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/8 mb-5">
          <button onClick={() => setMode("signup")} className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><UserPlus className="w-4 h-4" /> Sign up</button>
          <button onClick={() => setMode("login")} className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LogIn className="w-4 h-4" /> Log in</button>
        </div>

        <div className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.22em] text-white/35">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-primary/40" placeholder="Your name" />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.22em] text-white/35">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-white/25 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-primary/40" placeholder="you@domain.com" />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button onClick={submit} className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-primary/90 transition-colors">
            {mode === "signup" ? "Create account" : "Continue"}
          </button>
          <p className="text-[10px] text-white/30 text-center">By continuing, you agree to use Groeax responsibly.</p>
        </div>
      </motion.div>
    </div>
  );
}
