import { Router } from "express";
import { db, usersTable, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthorizationUrl, exchangeCodeForToken } from "../services/gmailSetup.js";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN ?? "";

function verifyAdminToken(token?: string): boolean {
  if (!ADMIN_TOKEN) {
    console.warn("ADMIN_API_TOKEN not set — admin endpoints disabled. Set it in env vars.");
    return false;
  }
  return token === ADMIN_TOKEN;
}

/**
 * POST /api/admin/approve-payment/:paymentId
 * Body: { adminToken: string }
 * Activates a pending payment and grants subscription access to the user.
 */
router.post("/admin/approve-payment/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { adminToken } = req.body as { adminToken?: string };

    if (!verifyAdminToken(adminToken)) {
      res.status(401).json({ error: "Unauthorized. Invalid or missing admin token." });
      return;
    }

    const paymentIdNum = parseInt(paymentId, 10);
    if (isNaN(paymentIdNum)) {
      res.status(400).json({ error: "Invalid payment ID" });
      return;
    }

    // Get payment record
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentIdNum))
      .limit(1);

    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (payment.verified) {
      res.status(400).json({ error: "Payment already approved" });
      return;
    }

    // Get user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payment.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Determine subscription tier and expiry from payment plan
    const tierName = payment.plan.startsWith("platinum") ? "platinum" : "premium";
    const now = new Date();
    const expiresAt = payment.plan.endsWith("yearly")
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Activate subscription
    const [updatedUser] = await db
      .update(usersTable)
      .set({ plan: tierName, planExpiresAt: expiresAt })
      .where(eq(usersTable.id, payment.userId))
      .returning();

    // Mark payment as verified
    await db
      .update(paymentsTable)
      .set({ verified: true, verifiedAt: new Date(), status: "verified" })
      .where(eq(paymentsTable.id, paymentIdNum));

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

/**
 * GET /api/admin/pending-payments
 * Query param: ?adminToken=xxx
 * Lists all pending payments awaiting approval.
 */
router.get("/admin/pending-payments", async (req, res) => {
  try {
    const { adminToken } = req.query as { adminToken?: string };

    if (!verifyAdminToken(adminToken)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const pending = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"));

    res.json({
      count: pending.length,
      payments: pending.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.userName,
        userEmail: p.userEmail,
        plan: p.plan,
        amount: p.amount,
        txHash: p.txHash,
        screenshotPath: p.screenshotPath,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    req.log.error(err, "pending payments fetch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/admin/gmail-auth-url
 * Returns the OAuth2 authorization URL for Gmail setup.
 * Visit this URL, authorize, then you'll be redirected to the callback.
 */
router.get("/admin/gmail-auth-url", (_req, res) => {
  const authUrl = getAuthorizationUrl();
  res.json({
    message: "Visit this URL to authorize Gmail access:",
    authUrl,
    instructions: [
      "1. Click the link above",
      "2. Sign in with arbinslom@gmail.com",
      "3. Allow Groeax to send emails",
      "4. You'll get redirected and see your GOOGLE_REFRESH_TOKEN",
      "5. Copy that token and add it as GOOGLE_REFRESH_TOKEN env var",
      "6. Restart the server",
      "7. Emails will now work!",
    ],
  });
});

/**
 * GET /api/admin/gmail-callback
 * OAuth2 callback from Google. Exchanges auth code for refresh token.
 */
router.get("/admin/gmail-callback", async (req, res) => {
  try {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error) {
      res.status(400).json({
        error: `OAuth authorization failed: ${error}`,
      });
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Missing authorization code" });
      return;
    }

    const tokens = await exchangeCodeForToken(code);

    res.json({
      success: true,
      message: "✅ Gmail OAuth authorization successful!",
      refreshToken: tokens.refresh_token,
      instructions: [
        "1. Copy the 'refreshToken' value above",
        "2. Go to your Replit Secrets tab",
        "3. Add new secret: GOOGLE_REFRESH_TOKEN = <paste token>",
        "4. Restart the API server",
        "5. Email notifications will now work!",
      ],
      nextSteps:
        "Add GOOGLE_REFRESH_TOKEN='your-token' to environment variables",
    });
  } catch (err) {
    req.log.error(err, "Gmail OAuth callback error");
    res.status(500).json({
      error: "Failed to complete OAuth flow",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
