import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { db, usersTable, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyTronPayment, PLAN_AMOUNTS_USDT, PLAN_AMOUNT_DISPLAY, getTargetWallet } from "../services/tronVerification.js";
import { sendPaymentWhatsApp } from "../services/whatsappNotification.js";
import { sendPaymentEmail } from "../services/emailNotification.js";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";
const JWT_EXPIRES = "30d";

const VALID_PLANS = ["platinum_monthly", "platinum_yearly", "premium_monthly", "premium_yearly"] as const;
type SubscribePlan = (typeof VALID_PLANS)[number];

// Directory to store payment screenshots
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "payment-screenshots");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function signToken(userId: number) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    planExpiresAt: u.planExpiresAt,
    createdAt: u.createdAt,
  };
}

function planTierName(subscribePlan: SubscribePlan): string {
  return subscribePlan.startsWith("platinum") ? "platinum" : "premium";
}

function calcExpiry(subscribePlan: SubscribePlan): Date {
  const now = new Date();
  return subscribePlan.endsWith("yearly")
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function getPublicBaseUrl(req: import("express").Request): string {
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    return `https://${replitDomains.split(",")[0]}`;
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}`;
  return `${req.protocol}://${req.get("host")}`;
}

/** Save base64 screenshot to disk, return filename */
function saveScreenshot(base64Data: string, userId: number): string {
  const match = base64Data.match(/^data:image\/(png|jpg|jpeg|webp|gif);base64,(.+)$/);
  const ext = match?.[1] ?? "png";
  const raw = match ? match[2] : base64Data;
  const filename = `payment_${userId}_${Date.now()}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(raw, "base64"));
  return filename;
}

router.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      plan: "silver",
    }).returning();

    const token = signToken(user.id);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    req.log.error(err, "signup error");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signToken(user.id);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    req.log.error(err, "login error");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found." });
      return;
    }
    res.json({ user: safeUser(user) });
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

/**
 * POST /api/auth/subscribe
 * Body: {
 *   plan: "platinum_monthly" | "platinum_yearly" | "premium_monthly" | "premium_yearly"
 *   screenshotBase64?: string   — base64 encoded payment screenshot (strongly recommended)
 *   txHash?: string             — optional TRC20 transaction hash for auto-verification
 *   email?: string              — optional contact email
 * }
 *
 * Flow:
 *  1. Screenshot saved to disk → URL generated
 *  2. If txHash provided → blockchain verification attempted
 *  3. If verified → subscription auto-activated
 *  4. If not → payment queued as "pending" for admin review
 *  5. Admin WhatsApp numbers notified either way
 */
router.post("/auth/subscribe", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: number };

    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).limit(1);
    if (!currentUser) {
      res.status(401).json({ error: "User not found." });
      return;
    }

    const { plan, email, txHash, screenshotBase64 } = req.body as {
      plan?: string;
      email?: string;
      txHash?: string;
      screenshotBase64?: string;
    };

    if (!plan || !VALID_PLANS.includes(plan as SubscribePlan)) {
      res.status(400).json({
        error: `Plan must be one of: ${VALID_PLANS.join(", ")}`,
        valid_plans: VALID_PLANS,
      });
      return;
    }

    if (!screenshotBase64 && !txHash?.trim()) {
      res.status(400).json({
        error: "Please upload a screenshot of your payment or provide a transaction hash.",
      });
      return;
    }

    const subscribePlan = plan as SubscribePlan;
    const amountDisplay = PLAN_AMOUNT_DISPLAY[subscribePlan];
    const wallet = getTargetWallet();
    const baseUrl = getPublicBaseUrl(req);

    // 1. Save screenshot if provided
    let screenshotPath: string | null = null;
    let screenshotUrl: string | undefined;
    if (screenshotBase64) {
      try {
        screenshotPath = saveScreenshot(screenshotBase64, payload.sub);
        screenshotUrl = `${baseUrl}/api/payment/screenshot/${screenshotPath}`;
        req.log.info({ userId: payload.sub, screenshotPath }, "Payment screenshot saved");
      } catch (err) {
        req.log.error({ err }, "Failed to save screenshot");
      }
    }

    // 2. Try blockchain verification if txHash provided
    let autoVerified = false;
    let verificationError: string | undefined;

    if (txHash?.trim()) {
      const expectedAmount = PLAN_AMOUNTS_USDT[subscribePlan];
      req.log.info({ userId: payload.sub, plan, txHash }, "Attempting TRON payment verification");
      const result = await verifyTronPayment(txHash.trim(), expectedAmount);
      autoVerified = result.valid;
      verificationError = result.error;
    }

    const paymentStatus = autoVerified ? "verified" : "pending";

    // 3. Record payment in audit table
    const [payment] = await db.insert(paymentsTable).values({
      userId: payload.sub,
      plan: subscribePlan,
      amount: amountDisplay,
      txHash: txHash?.trim().toLowerCase() ?? null,
      walletAddress: wallet,
      screenshotPath,
      status: paymentStatus,
      verified: autoVerified,
      verificationError: verificationError ?? null,
      userEmail: email ?? currentUser.email,
      userName: currentUser.name,
    }).returning();

    // 4. If auto-verified, activate subscription immediately
    let updatedUser = currentUser;
    if (autoVerified) {
      req.log.info({ userId: payload.sub, plan }, "Payment verified — activating subscription");
      const [u] = await db.update(usersTable)
        .set({ plan: planTierName(subscribePlan), planExpiresAt: calcExpiry(subscribePlan) })
        .where(eq(usersTable.id, payload.sub))
        .returning();
      updatedUser = u;

      await db.update(paymentsTable)
        .set({ verified: true, verifiedAt: new Date() })
        .where(eq(paymentsTable.id, payment.id));
    } else {
      req.log.info({ userId: payload.sub, plan, paymentStatus }, "Payment queued for admin review");
    }

    // 5. Always notify admin via WhatsApp + Email (fire and forget)
    void sendPaymentWhatsApp({
      userName: currentUser.name,
      userEmail: email ?? currentUser.email,
      plan: `${subscribePlan.replace("_", " ").toUpperCase()} — ${amountDisplay} USDT`,
      amount: amountDisplay,
      txHash: txHash?.trim(),
      screenshotUrl,
      status: paymentStatus,
    });

    const adminEmail = process.env.ADMIN_EMAIL ?? currentUser.email;
    void sendPaymentEmail({
      userName: currentUser.name,
      userEmail: email ?? currentUser.email,
      plan: `${subscribePlan.replace("_", " ").toUpperCase()} — ${amountDisplay} USDT`,
      amount: amountDisplay,
      txHash: txHash?.trim(),
      screenshotUrl,
      status: paymentStatus,
    }, adminEmail);

    if (autoVerified) {
      res.json({ user: safeUser(updatedUser), status: "activated" });
    } else {
      res.json({
        user: safeUser(updatedUser),
        status: "pending",
        message: "Your payment screenshot has been received. Our team has been notified via WhatsApp and will activate your subscription shortly.",
      });
    }
  } catch (err) {
    req.log.error(err, "subscribe error");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
