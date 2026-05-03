import { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Crown, Lock, Zap } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

interface PremiumGateProps {
  children: ReactNode;
  feature?: string;
}

export function PremiumGate({ children, feature }: PremiumGateProps) {
  const { isPremium, ready } = useAuthStore();

  if (!ready) return null;
  if (isPremium) return <>{children}</>;

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(139,92,246,0.15)]">
          <Lock className="w-7 h-7 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Premium Feature</h2>
        <p className="text-white/45 text-sm mb-2 leading-relaxed">
          {feature
            ? `${feature} is available on the Premium plan.`
            : "This feature is available on the Premium plan."}
        </p>
        <p className="text-white/30 text-sm mb-8">
          Upgrade starting at just <span className="text-violet-400 font-semibold">$7 / month</span> or{" "}
          <span className="text-emerald-400 font-semibold">$95 / year</span>.
        </p>
        <Link href="/pricing">
          <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25">
            <Crown className="w-4 h-4" />
            Upgrade to Premium
          </button>
        </Link>
        <div className="mt-4">
          <Link href="/pricing" className="text-xs text-white/25 hover:text-white/50 transition-colors">
            View all plans →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 uppercase tracking-wider">
      <Crown className="w-2.5 h-2.5" /> Pro
    </span>
  );
}

export function UpgradeBanner() {
  const { isPremium } = useAuthStore();
  if (isPremium) return null;
  return (
    <Link href="/pricing">
      <div className="mx-2 mb-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/15 to-violet-500/10 border border-violet-500/20 hover:border-violet-500/35 transition-colors cursor-pointer group">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-violet-300 truncate">Upgrade to Premium</p>
            <p className="text-[10px] text-violet-400/60 truncate">From $7/mo · AI, signals & more</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
