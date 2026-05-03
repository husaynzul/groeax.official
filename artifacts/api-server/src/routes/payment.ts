import { Router } from "express";
import path from "path";
import fs from "fs";
import { getTargetWallet, PLAN_AMOUNTS_USDT, PLAN_AMOUNT_DISPLAY } from "../services/tronVerification.js";

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "payment-screenshots");

/**
 * GET /api/payment/config
 * Returns public payment configuration.
 * Credentials come from env vars — never hardcoded in frontend.
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

/**
 * GET /api/payment/screenshot/:filename
 * Serves saved payment screenshot images.
 * Only accessible to users who know the filename (effectively private).
 */
router.get("/payment/screenshot/:filename", (req, res) => {
  const { filename } = req.params;

  // Security: prevent directory traversal
  if (!filename || filename.includes("..") || filename.includes("/")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "Screenshot not found" });
    return;
  }

  // Set appropriate content type based on extension
  const ext = path.extname(filename).toLowerCase().slice(1);
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  const contentType = mimeTypes[ext] ?? "image/png";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000");
  fs.createReadStream(filepath).pipe(res);
});

export default router;
