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
  const { isPlatinum, ready } = useAuthStore();

  if (!ready) return null;
  if (isPlatinum) return <>{children}</>;

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
          <Lock className="w-7 h-7 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Platinum Feature</h2>
        <p className="text-white/45 text-sm mb-2 leading-relaxed">
          {feature
            ? `${feature} requires a Platinum or Premium plan.`
            : "This feature requires a Platinum or Premium plan."}
        </p>
        <p className="text-white/30 text-sm mb-8">
          Start with Platinum from just{" "}
          <span className="text-blue-400 font-semibold">$10 / month</span> or{" "}
          <span className="text-emerald-400 font-semibold">$105 / year</span>.
        </p>
        <Link href="/pricing">
          <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/25">
            <Crown className="w-4 h-4" />
            Upgrade to Platinum
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
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 uppercase tracking-wider">
      <Crown className="w-2.5 h-2.5" /> Pro
    </span>
  );
}

export function UpgradeBanner() {
  const { isPlatinum } = useAuthStore();
  if (isPlatinum) return null;
  return (
    <Link href="/pricing">
      <div className="mx-2 mb-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/15 to-blue-500/10 border border-blue-500/20 hover:border-blue-500/35 transition-colors cursor-pointer group">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-blue-300 truncate">Upgrade to Platinum</p>
            <p className="text-[10px] text-blue-400/60 truncate">From $10/mo · AI, signals & more</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
