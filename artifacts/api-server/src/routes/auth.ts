import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyTronPayment, PLAN_AMOUNTS_USDT, PLAN_AMOUNT_DISPLAY, getTargetWallet } from "../services/tronVerification.js";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";
const JWT_EXPIRES = "30d";

const VALID_PLANS = ["platinum_monthly", "platinum_yearly", "premium_monthly", "premium_yearly"] as const;
type SubscribePlan = (typeof VALID_PLANS)[number];

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

/** Resolve the stored plan name from a subscribe plan key */
function planTierName(subscribePlan: SubscribePlan): string {
  if (subscribePlan.startsWith("platinum")) return "platinum";
  return "premium";
}

/** Calculate expiry date based on plan period */
function calcExpiry(subscribePlan: SubscribePlan): Date {
  const now = new Date();
  if (subscribePlan.endsWith("yearly")) {
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
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
 * Body: { plan: "platinum_monthly" | "platinum_yearly" | "premium_monthly" | "premium_yearly", txHash: string, email?: string }
 * ALL paid plans require blockchain-verified USDT TRC20 payment.
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

    const { plan, email, txHash } = req.body as { plan?: string; email?: string; txHash?: string };

    if (!plan || !VALID_PLANS.includes(plan as SubscribePlan)) {
      res.status(400).json({
        error: `Plan must be one of: ${VALID_PLANS.join(", ")}`,
        valid_plans: VALID_PLANS,
      });
      return;
    }

    if (!txHash?.trim()) {
      res.status(400).json({ error: "Transaction hash is required for all paid plans." });
      return;
    }

    const subscribePlan = plan as SubscribePlan;
    const expectedAmount = PLAN_AMOUNTS_USDT[subscribePlan];
    const amountDisplay = PLAN_AMOUNT_DISPLAY[subscribePlan];
    const wallet = getTargetWallet();

    req.log.info({ userId: payload.sub, plan, txHash }, "Verifying TRON payment");

    const verification = await verifyTronPayment(txHash, expectedAmount);

    // Audit record regardless of outcome
    await db.insert(paymentsTable).values({
      userId: payload.sub,
      plan: subscribePlan,
      amount: amountDisplay,
      txHash: txHash.trim().toLowerCase(),
      walletAddress: wallet,
      verified: verification.valid,
      verificationError: verification.error ?? null,
    });

    if (!verification.valid) {
      req.log.warn({ userId: payload.sub, plan, txHash, error: verification.error }, "Payment verification failed");
      res.status(402).json({
        error: verification.error,
        code: "PAYMENT_VERIFICATION_FAILED",
        expected_amount: `${amountDisplay} USDT`,
        wallet,
      });
      return;
    }

    req.log.info({ userId: payload.sub, plan, txHash }, "Payment verified — activating subscription");

    const tierName = planTierName(subscribePlan);
    const planExpiresAt = calcExpiry(subscribePlan);

    const [user] = await db.update(usersTable)
      .set({ plan: tierName, planExpiresAt })
      .where(eq(usersTable.id, payload.sub))
      .returning();

    // Stamp payment record as verified
    await db.update(paymentsTable)
      .set({ verified: true, verifiedAt: new Date() })
      .where(eq(paymentsTable.txHash, txHash.trim().toLowerCase()));

    res.json({ user: safeUser(user) });
  } catch (err) {
    req.log.error(err, "subscribe error");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
