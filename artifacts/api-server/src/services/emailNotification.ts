import { logger } from "../lib/logger.js";

export interface PaymentNotification {
  userName: string;
  userEmail: string;
  plan: string;
  amount: string;
  txHash?: string;
  screenshotUrl?: string;
  status: "pending" | "verified";
  paymentId?: number;
  userPassword?: string;
}

export async function sendPaymentEmail(info: PaymentNotification, adminEmail: string): Promise<void> {
  const statusEmoji = info.status === "verified" ? "✅" : "⏳";
  const statusLabel = info.status === "verified" ? "AUTO-VERIFIED" : "PENDING REVIEW";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">
          ${statusEmoji} Groeax Payment ${statusLabel}
        </h2>
        
        <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin-bottom: 20px;">
          <p style="margin: 8px 0;"><strong>User:</strong> ${info.userName}</p>
          <p style="margin: 8px 0;"><strong>Email:</strong> ${info.userEmail}</p>
          <p style="margin: 8px 0;"><strong>Plan:</strong> ${info.plan}</p>
          <p style="margin: 8px 0;"><strong>Amount:</strong> ${info.amount} USDT</p>
          ${info.txHash ? `<p style="margin: 8px 0;"><strong>TX Hash:</strong> <code>${info.txHash}</code></p>` : ""}
        </div>

        <div style="background: #e8f4f8; padding: 15px; border-left: 4px solid #17a2b8; margin-bottom: 20px;">
          <p style="color: #155724; font-weight: bold; margin-bottom: 10px;">📧 Account Details</p>
          <p style="margin: 5px 0;"><strong>Username/Email:</strong> ${info.userEmail}</p>
          ${info.userPassword ? `<p style="margin: 5px 0;"><strong>Password:</strong> <code style="background: white; padding: 3px 6px; border-radius: 3px; font-family: monospace;">${info.userPassword}</code></p>` : `<p style="margin: 5px 0; color: #666; font-size: 13px;">Use your password from registration. <a href="https://groeax.com/reset-password" style="color: #007bff;">Reset password</a> if needed.</p>`}
          <p style="margin: 5px 0; color: #666; font-size: 13px;">Login: <a href="https://groeax.com/login" style="color: #007bff;">https://groeax.com/login</a></p>
        </div>

        ${info.screenshotUrl ? `
          <div style="margin-bottom: 20px;">
            <p style="color: #666; margin-bottom: 10px;"><strong>Payment Screenshot:</strong></p>
            <a href="${info.screenshotUrl}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none;">View Screenshot</a>
          </div>
        ` : ""}

        ${info.status === "pending" && info.paymentId ? `
          <div style="margin-bottom: 20px; padding: 15px; background: #f0f7ff; border-radius: 4px; border: 1px solid #b3d9ff;">
            <p style="color: #0066cc; margin-bottom: 10px; font-weight: bold;">Quick Approval</p>
            <p style="color: #333; margin: 0 0 10px 0; font-size: 13px;">Use your admin API token to approve this payment:</p>
            <code style="display: block; background: white; padding: 10px; border-radius: 3px; margin-bottom: 10px; font-size: 11px; color: #333; border: 1px solid #ddd; word-break: break-all;">curl -X POST https://[YOUR-DOMAIN]/api/admin/approve-payment/${info.paymentId} \\
  -H "Content-Type: application/json" \\
  -d '{"adminToken":"YOUR_ADMIN_API_TOKEN"}'</code>
            <p style="color: #666; margin: 0; font-size: 12px;">Or check pending payments: GET /api/admin/pending-payments?adminToken=YOUR_TOKEN</p>
          </div>
        ` : ""}

        <div style="background: ${info.status === "verified" ? "#d4edda" : "#fff3cd"}; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          ${info.status === "verified"
            ? `<p style="color: #155724; margin: 0;"><strong>✓ Status:</strong> Subscription activated automatically</p>`
            : `<p style="color: #856404; margin: 0;"><strong>⚠ Status:</strong> Requires manual verification. Activate via admin panel.</p>`
          }
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated notification from Groeax Payment System
        </p>
      </div>
    </div>
  `;

  try {
    // Using nodemailer with SMTP config from env vars
    const transporter = createEmailTransport();
    if (!transporter) {
      logger.warn("Email notification skipped — SMTP not configured. Set EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD env vars.");
      return;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? "noreply@groeax.com",
      to: adminEmail,
      subject: `[Groeax] Payment ${statusLabel} - ${info.userName} - ${info.amount} USDT`,
      html: htmlBody,
    });

    logger.info({ adminEmail }, "Payment notification email sent");
  } catch (err) {
    logger.error({ err, adminEmail }, "Failed to send payment notification email");
  }
}

function createEmailTransport(): any {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASSWORD;

  if (!host || !port || !user || !pass) {
    return null;
  }

  // Lazy import to avoid requiring nodemailer if not used
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: port === "465",
    auth: { user, pass },
  });
}
