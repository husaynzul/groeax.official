import { Router } from "express";
import { db, usersTable, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthorizationUrl, exchangeCodeForToken } from "../services/gmailSetup.js";
import { sendPaymentEmail } from "../services/emailNotification.js";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // Send confirmation email to admin
    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@groeax.com";
    void sendPaymentEmail({
      userName: user.name,
      userEmail: user.email,
      plan: `${payment.plan.replace(/_/g, " ").toUpperCase()} — ${payment.amount} USDT`,
      amount: payment.amount,
      txHash: payment.txHash ?? undefined,
      screenshotUrl: payment.screenshotPath ? `/api/payment/screenshot/${payment.screenshotPath}` : undefined,
      status: "verified",
      paymentId: payment.id,
    }, adminEmail);

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
 * Serves HTML dashboard with pending payments (or JSON if ?json=1)
 */
router.get("/admin/pending-payments", async (req, res) => {
  try {
    const { adminToken, json } = req.query as { adminToken?: string; json?: string };

    if (!verifyAdminToken(adminToken)) {
      if (json) {
        res.status(401).json({ error: "Unauthorized" });
      } else {
        res.status(401).send("<h1>Error: Invalid admin token</h1>");
      }
      return;
    }

    const pending = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"));

    if (json) {
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
      return;
    }

    // Generate HTML dashboard
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Groeax Admin - Pending Payments</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          h1 { color: #333; }
          .badge { background: #2196F3; color: white; padding: 8px 12px; border-radius: 20px; font-weight: bold; }
          .payment-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .payment-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
          .user-name { font-size: 16px; font-weight: bold; color: #333; }
          .user-email { color: #666; font-size: 14px; }
          .timestamp { color: #999; font-size: 12px; }
          .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
          .detail { }
          .detail-label { color: #666; font-weight: 600; font-size: 12px; margin-bottom: 5px; }
          .detail-value { color: #333; font-size: 14px; }
          .screenshot { max-width: 100%; margin-top: 15px; border: 1px solid #ddd; border-radius: 4px; }
          .actions { display: flex; gap: 10px; margin-top: 20px; }
          .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.2s; }
          .btn-approve { background: #4CAF50; color: white; }
          .btn-approve:hover { background: #45a049; }
          .btn-approve:active { transform: scale(0.98); }
          .empty { text-align: center; padding: 80px 20px; color: #999; }
          .empty h2 { margin-bottom: 10px; }
          code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Groeax Admin Dashboard</h1>
            <div class="badge">${pending.length} Pending</div>
          </div>

          ${pending.length === 0 ? `
            <div class="empty">
              <h2>✓ No Pending Payments</h2>
              <p>All payments have been processed.</p>
            </div>
          ` : `
            ${pending.map(p => `
              <div class="payment-card">
                <div class="payment-header">
                  <div>
                    <div class="user-name">${p.userName}</div>
                    <div class="user-email">${p.userEmail}</div>
                    <div class="timestamp">Submitted: ${new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                <div class="details">
                  <div class="detail">
                    <div class="detail-label">PLAN</div>
                    <div class="detail-value"><strong>${p.plan.replace(/_/g, ' ').toUpperCase()}</strong></div>
                  </div>
                  <div class="detail">
                    <div class="detail-label">AMOUNT</div>
                    <div class="detail-value"><strong>${p.amount} USDT</strong></div>
                  </div>
                  ${p.txHash ? `
                    <div class="detail" style="grid-column: span 2;">
                      <div class="detail-label">TX HASH</div>
                      <div class="detail-value"><code>${p.txHash}</code></div>
                    </div>
                  ` : ''}
                </div>

                ${p.screenshotPath ? `
                  <div style="margin-top: 15px;">
                    <div class="detail-label">PAYMENT SCREENSHOT</div>
                    <img src="/api/payment/screenshot/${p.screenshotPath}" alt="Payment proof" class="screenshot">
                  </div>
                ` : ''}

                <div class="actions">
                  <button class="btn btn-approve" onclick="approve(${p.id}, '${p.userName}')">✓ Approve & Activate</button>
                </div>
              </div>
            `).join('')}
          `}
        </div>

        <script>
          const token = '${adminToken}';

          function approve(id, userName) {
            if (!confirm(\`Approve payment for \${userName}?\`)) return;

            fetch(\`/api/admin/approve-payment/\${id}\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adminToken: token })
            })
            .then(r => r.json())
            .then(d => {
              if (d.success) {
                alert('✓ Payment approved!\\n' + d.message + '\\n\\nEmail confirmation sent to ' + d.user.email);
                location.reload();
              } else {
                alert('Error: ' + (d.error || 'Failed'));
              }
            })
            .catch(e => alert('Error: ' + e.message));
          }
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    req.log.error(err, "pending payments fetch error");
    res.status(500).send("<h1>Error</h1><p>Failed to load pending payments</p>");
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
