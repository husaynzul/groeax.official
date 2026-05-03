import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useAuthStore, apiMe } from "@/store/authStore";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

export default function PaymentVerification() {
  const [, setLocation] = useLocation();
  const { user, token, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const maxChecks = 120; // Check for up to 2 hours (every 60 seconds)

  useEffect(() => {
    if (!token || !user) {
      setLocation("/login");
      return;
    }

    // If user already has premium access, redirect immediately
    if (user.plan === "platinum" || user.plan === "premium") {
      setLocation("/dashboard");
      return;
    }

    // Set up polling interval to check if payment is approved
    const pollInterval = setInterval(async () => {
      setLoading(true);
      try {
        const updatedUser = await apiMe(token);
        if (updatedUser) {
          updateUser(updatedUser);
          // If user now has premium access, redirect to dashboard
          if (updatedUser.plan === "platinum" || updatedUser.plan === "premium") {
            clearInterval(pollInterval);
            setLocation("/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check payment status", err);
      } finally {
        setLoading(false);
      }

      setCheckCount((prev) => {
        const next = prev + 1;
        if (next >= maxChecks) {
          clearInterval(pollInterval);
        }
        return next;
      });
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(pollInterval);
  }, [token, user, updateUser, setLocation]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <img src={groeaxLogo} alt="Groeax" className="w-12 h-12 object-contain" />
          <span className="font-bold text-xl tracking-tight">Groeax</span>
        </div>

        {/* Status card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex justify-center mb-6"
          >
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
          </motion.div>

          <h1 className="text-2xl font-bold mb-2">Payment Under Review</h1>
          <p className="text-white/50 mb-6">
            Your payment screenshot has been received and sent to our admin team.
          </p>

          {/* Progress details */}
          <div className="space-y-4 mb-8 text-sm">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-white/70">Screenshot uploaded</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-white/70">Admin notified via email</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-white/70">Awaiting approval</span>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-xs text-blue-300/80 leading-relaxed">
              The admin team reviews payments and typically approves within a few hours. Once approved, your subscription will be activated immediately and you'll be able to access all premium features.
            </p>
          </div>

          {/* Check status button */}
          <button
            onClick={async () => {
              if (!token) return;
              setLoading(true);
              try {
                const updatedUser = await apiMe(token);
                if (updatedUser) {
                  updateUser(updatedUser);
                  if (updatedUser.plan === "platinum" || updatedUser.plan === "premium") {
                    setLocation("/dashboard");
                  }
                }
              } catch (err) {
                console.error("Failed to check status", err);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" /> Check Status Now
              </>
            )}
          </button>
        </div>

        {/* Auto-check info */}
        <p className="text-xs text-white/30">
          {checkCount > 0
            ? `Last checked: ${checkCount} minute${checkCount !== 1 ? "s" : ""} ago`
            : "Status checks automatically every minute"}
        </p>
      </motion.div>
    </div>
  );
}
