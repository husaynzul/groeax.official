import { Router } from "express";
import { getTargetWallet, PLAN_AMOUNTS_USDT, PLAN_AMOUNT_DISPLAY } from "../services/tronVerification.js";

const router = Router();

/**
 * GET /api/payment/config
 * Returns public payment configuration (wallet, Binance ID).
 * Credentials are read from env vars — never hardcoded in frontend.
 */
router.get("/payment/config", (_req, res) => {
  res.json({
    wallet: getTargetWallet(),
    binanceMerchantId: process.env.BINANCE_MERCHANT_ID ?? "520572397",
    plans: {
      platinum_monthly: { amount: PLAN_AMOUNT_DISPLAY.platinum_monthly, currency: "USDT", label: "Platinum Monthly" },
      platinum_yearly:  { amount: PLAN_AMOUNT_DISPLAY.platinum_yearly,  currency: "USDT", label: "Platinum Yearly"  },
      premium_monthly:  { amount: PLAN_AMOUNT_DISPLAY.premium_monthly,  currency: "USDT", label: "Premium Monthly"  },
      premium_yearly:   { amount: PLAN_AMOUNT_DISPLAY.premium_yearly,   currency: "USDT", label: "Premium Yearly"   },
    },
  });
});

export default router;
