import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Crown, Calendar, Mail, User as UserIcon, Copy, CheckCircle, Clock, Zap } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, clearAuth } = useAuthStore();
  const [copied, setCopied] = React.useState(false);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const planLabel = {
    free: "Free",
    monthly: "Premium (Monthly)",
    yearly: "Premium (Yearly)",
  }[user.plan];

  const planColor = {
    free: "text-white/50",
    monthly: "text-violet-400",
    yearly: "text-violet-400",
  }[user.plan];

  const planBgColor = {
    free: "bg-white/5",
    monthly: "bg-violet-500/10",
    yearly: "bg-violet-500/10",
  }[user.plan];

  const planBorder = {
    free: "border-white/10",
    monthly: "border-violet-500/25",
    yearly: "border-violet-500/25",
  }[user.plan];

  const expiryDate = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={groeaxLogo} alt="Groeax" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg tracking-tight">Groeax</span>
        </Link>
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-black tracking-tight mb-8">Account Settings</h1>

          {/* User Info */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 mb-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-white/50" />
              Profile
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-white/40 font-semibold">Name</label>
                <p className="text-lg text-white mt-1">{user.name}</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40 font-semibold">Email</label>
                <p className="text-lg text-white mt-1">{user.email}</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40 font-semibold">Member Since</label>
                <p className="text-lg text-white mt-1">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Plan Status */}
          <div
            className={`rounded-2xl border ${planBorder} ${planBgColor} p-8 mb-8`}
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Crown className="w-5 h-5" /> Your Plan
            </h2>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${planBgColor} border ${planBorder} flex items-center justify-center`}>
                  {user.plan === "free" ? (
                    <UserIcon className="w-6 h-6 text-white/40" />
                  ) : (
                    <Crown className="w-6 h-6 text-violet-400" />
                  )}
                </div>
                <div>
                  <p className={`text-2xl font-bold ${planColor}`}>{planLabel}</p>
                  {user.plan === "free" && <p className="text-sm text-white/40 mt-1">Upgrade anytime</p>}
                </div>
              </div>

              {user.plan !== "free" && expiryDate && (
                <div className="bg-white/[0.03] border border-white/8 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Expires on
                    </span>
                    <span className="font-semibold text-white">
                      {expiryDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {daysLeft !== null && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/8">
                      <span className="text-sm text-white/50 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time remaining
                      </span>
                      <span className="font-semibold text-emerald-400">{daysLeft} days</span>
                    </div>
                  )}
                </div>
              )}

              {user.plan === "free" && (
                <Link href="/pricing">
                  <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25">
                    <Zap className="w-4 h-4" />
                    Upgrade to Premium
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={clearAuth}
              className="w-full py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
            >
              Sign out
            </button>
          </div>

          <p className="text-xs text-white/18 text-center mt-8">
            © 2026 Groeax · Professional trading tools for serious traders
          </p>
        </motion.div>
      </div>
    </div>
  );
}

import React from "react";
