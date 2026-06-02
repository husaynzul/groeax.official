import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, paymentsTable } from "@workspace/db";
import { eq, desc, count, and, or, ilike } from "drizzle-orm";
import { getAuthorizationUrl, exchangeCodeForToken } from "../services/gmailSetup.js";
import { sendPaymentEmail } from "../services/emailNotification.js";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN ?? "groeax-admin-secret-2026";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "arbinslom@gmail.com";
const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";

/** Verify a raw API token (legacy fallback) */
function verifyAdminToken(token?: string): boolean {
  if (!ADMIN_TOKEN || !token) return false;
  return token === ADMIN_TOKEN;
}

/** Verify admin JWT from Authorization: Bearer <token> header */
function verifyAdminJwt(req: any): boolean {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return false;
    const payload = jwt.verify(token, JWT_SECRET) as { admin?: boolean };
    return payload.admin === true;
  } catch {
    return false;
  }
}

/** Middleware: accepts JWT Bearer header OR legacy adminToken body param */
function requireAdmin(req: any, res: any): boolean {
  if (verifyAdminJwt(req)) return true;
  // Legacy body token fallback (for backward compat)
  const bodyToken = req.body?.adminToken;
  if (verifyAdminToken(bodyToken)) return true;
  res.status(401).json({ error: "Unauthorized. Invalid or missing admin token." });
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/login
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  if (email !== ADMIN_EMAIL || password !== ADMIN_TOKEN) {
    req.log.warn({ email }, "Failed admin login attempt");
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }
  const token = jwt.sign({ sub: "admin", admin: true, email }, JWT_SECRET, { expiresIn: "24h" });
  req.log.info({ email }, "Admin login successful");
  res.json({ token, email });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/stats", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
    const [premiumResult] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(or(eq(usersTable.plan, "premium"), eq(usersTable.plan, "platinum")));
    const [pendingResult] = await db
      .select({ count: count() })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"));
    const [approvedResult] = await db
      .select({ count: count() })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "verified"));
    const [rejectedResult] = await db
      .select({ count: count() })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "rejected"));

    const recentUsers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        plan: usersTable.plan,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(5);

    const recentPayments = await db
      .select({
        id: paymentsTable.id,
        userName: paymentsTable.userName,
        plan: paymentsTable.plan,
        amount: paymentsTable.amount,
        status: paymentsTable.status,
        createdAt: paymentsTable.createdAt,
      })
      .from(paymentsTable)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(5);

    res.json({
      totalUsers: Number(totalUsersResult?.count ?? 0),
      premiumUsers: Number(premiumResult?.count ?? 0),
      pendingPayments: Number(pendingResult?.count ?? 0),
      approvedPayments: Number(approvedResult?.count ?? 0),
      rejectedPayments: Number(rejectedResult?.count ?? 0),
      recentUsers,
      recentPayments,
    });
  } catch (err) {
    req.log.error(err, "admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// Includes pending subscription request ID for each user (if any)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { search } = req.query as { search?: string };

    const users = search
      ? await db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            plan: usersTable.plan,
            planExpiresAt: usersTable.planExpiresAt,
            createdAt: usersTable.createdAt,
          })
          .from(usersTable)
          .where(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`)))
          .orderBy(desc(usersTable.createdAt))
      : await db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            plan: usersTable.plan,
            planExpiresAt: usersTable.planExpiresAt,
            createdAt: usersTable.createdAt,
          })
          .from(usersTable)
          .orderBy(desc(usersTable.createdAt));

    // Fetch one pending payment per user (most recent)
    const pendingPayments = await db
      .select({
        id: paymentsTable.id,
        userId: paymentsTable.userId,
        plan: paymentsTable.plan,
        amount: paymentsTable.amount,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"))
      .orderBy(desc(paymentsTable.createdAt));

    // Map userId → first pending payment
    const pendingMap = new Map<number, { id: number; plan: string; amount: string }>();
    for (const p of pendingPayments) {
      if (!pendingMap.has(p.userId)) {
        pendingMap.set(p.userId, { id: p.id, plan: p.plan, amount: p.amount });
      }
    }

    const usersWithPending = users.map((u) => ({
      ...u,
      pendingPayment: pendingMap.get(u.id) ?? null,
    }));

    res.json({ users: usersWithPending });
  } catch (err) {
    req.log.error(err, "admin users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/users/:userId/plan
// ─────────────────────────────────────────────────────────────────────────────
router.put("/admin/users/:userId/plan", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { userId } = req.params;
    const { plan } = req.body as { plan?: string };
    const VALID = ["silver", "platinum", "premium", "suspended", "free"];
    if (!plan || !VALID.includes(plan)) {
      res.status(400).json({ error: `Plan must be one of: ${VALID.join(", ")}` });
      return;
    }
    const id = parseInt(userId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const [updated] = await db
      .update(usersTable)
      .set({
        plan,
        planExpiresAt:
          plan === "suspended" || plan === "silver" || plan === "free" ? null : undefined,
      })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, name: usersTable.name, plan: usersTable.plan });

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    req.log.info({ userId: id, plan }, "Admin changed user plan");
    res.json({ success: true, user: updated });
  } catch (err) {
    req.log.error(err, "admin change plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/payments
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/payments", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { status } = req.query as { status?: string };

    const query = db
      .select({
        id: paymentsTable.id,
        userId: paymentsTable.userId,
        userName: paymentsTable.userName,
        userEmail: paymentsTable.userEmail,
        plan: paymentsTable.plan,
        amount: paymentsTable.amount,
        txHash: paymentsTable.txHash,
        screenshotPath: paymentsTable.screenshotPath,
        status: paymentsTable.status,
        verified: paymentsTable.verified,
        verifiedAt: paymentsTable.verifiedAt,
        createdAt: paymentsTable.createdAt,
      })
      .from(paymentsTable);

    const payments =
      status && status !== "all"
        ? await query.where(eq(paymentsTable.status, status)).orderBy(desc(paymentsTable.createdAt))
        : await query.orderBy(desc(paymentsTable.createdAt));

    res.json({ payments });
  } catch (err) {
    req.log.error(err, "admin payments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/payments/:paymentId/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/payments/:paymentId/reject", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.paymentId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid payment ID" }); return; }

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .limit(1);
    if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
    if (payment.status === "rejected") {
      res.status(400).json({ error: "Payment already rejected" });
      return;
    }

    await db
      .update(paymentsTable)
      .set({ status: "rejected", verificationError: "Rejected by admin" })
      .where(eq(paymentsTable.id, id));

    req.log.info({ paymentId: id }, "Admin rejected payment");
    res.json({ success: true, message: `Payment #${id} rejected` });
  } catch (err) {
    req.log.error(err, "admin reject payment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/approve-payment/:paymentId
// Activates subscription — requires admin JWT Bearer header
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/approve-payment/:paymentId", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const paymentIdNum = parseInt(req.params.paymentId, 10);
    if (isNaN(paymentIdNum)) {
      res.status(400).json({ error: "Invalid payment ID" });
      return;
    }

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentIdNum))
      .limit(1);
    if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
    if (payment.verified) {
      res.status(400).json({ error: "Payment already approved" });
      return;
    }
    if (payment.status === "rejected") {
      res.status(400).json({ error: "Cannot approve a rejected payment" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payment.userId))
      .limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const tierName = payment.plan.startsWith("platinum") ? "platinum" : "premium";
    const now = new Date();
    const expiresAt = payment.plan.endsWith("yearly")
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const [updatedUser] = await db
      .update(usersTable)
      .set({ plan: tierName, planExpiresAt: expiresAt })
      .where(eq(usersTable.id, payment.userId))
      .returning();

    await db
      .update(paymentsTable)
      .set({ verified: true, verifiedAt: new Date(), status: "verified" })
      .where(eq(paymentsTable.id, paymentIdNum));

    req.log.info(
      { paymentId: paymentIdNum, userId: user.id, plan: tierName },
      "Admin approved payment — subscription activated",
    );

    // Notify user via email (fire and forget)
    const adminEmail = process.env.ADMIN_EMAIL ?? ADMIN_EMAIL;
    void sendPaymentEmail(
      {
        userName: user.name,
        userEmail: user.email,
        plan: `${payment.plan.replace(/_/g, " ").toUpperCase()} — ${payment.amount} USDT`,
        amount: payment.amount,
        txHash: payment.txHash ?? undefined,
        screenshotUrl: payment.screenshotPath
          ? `/api/payment/screenshot/${payment.screenshotPath}`
          : undefined,
        status: "verified",
        paymentId: payment.id,
      },
      adminEmail,
    );

    res.json({
      success: true,
      message: `Subscription activated for ${user.name} (${tierName})`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        plan: updatedUser.plan,
        planExpiresAt: updatedUser.planExpiresAt,
      },
    });
  } catch (err) {
    req.log.error(err, "admin approval error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy redirect for old HTML dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/pending-payments", async (req, res) => {
  try {
    const { adminToken } = req.query as { adminToken?: string };
    if (!verifyAdminToken(adminToken)) {
      res.status(401).send("<h1>Error: Invalid admin token</h1>");
      return;
    }
    res.redirect(`/admin/subscriptions`);
  } catch (err) {
    req.log.error(err, "pending payments redirect error");
    res.status(500).send("<h1>Error</h1>");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Gmail OAuth (setup only)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/gmail-auth-url", (_req, res) => {
  const authUrl = getAuthorizationUrl();
  res.json({ message: "Visit this URL to authorize Gmail access:", authUrl });
});

router.get("/admin/gmail-callback", async (req, res) => {
  try {
    const { code, error } = req.query as { code?: string; error?: string };
    if (error) { res.status(400).json({ error: `OAuth failed: ${error}` }); return; }
    if (!code) { res.status(400).json({ error: "Missing authorization code" }); return; }
    const tokens = await exchangeCodeForToken(code);
    res.json({
      success: true,
      refreshToken: tokens.refresh_token,
      message: "Add GOOGLE_REFRESH_TOKEN to your env vars then restart the server.",
    });
  } catch (err) {
    req.log.error(err, "Gmail OAuth callback error");
    res.status(500).json({ error: "OAuth flow failed" });
  }
});

export default router;
