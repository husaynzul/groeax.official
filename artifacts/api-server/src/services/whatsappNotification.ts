import { logger } from "../lib/logger.js";

const CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php";

const ADMIN_NUMBERS = [
  { phone: "923478618727", apikey: process.env.CALLMEBOT_APIKEY_1 ?? "" },
  { phone: "923278659748", apikey: process.env.CALLMEBOT_APIKEY_2 ?? "" },
];

export interface PaymentNotification {
  userName: string;
  userEmail: string;
  plan: string;
  amount: string;
  txHash?: string;
  screenshotUrl?: string;
  status: "pending" | "verified";
}

export async function sendPaymentWhatsApp(info: PaymentNotification): Promise<void> {
  const statusEmoji = info.status === "verified" ? "✅" : "⏳";
  const statusLabel = info.status === "verified" ? "AUTO-VERIFIED" : "PENDING REVIEW";

  const lines = [
    `${statusEmoji} *GROEAX PAYMENT ${statusLabel}*`,
    ``,
    `👤 *User:* ${info.userName}`,
    `📧 *Email:* ${info.userEmail}`,
    `📦 *Plan:* ${info.plan}`,
    `💰 *Amount:* ${info.amount} USDT`,
    info.txHash ? `🔗 *TX Hash:* ${info.txHash}` : `🔗 *TX Hash:* Not provided`,
    info.screenshotUrl ? `🖼 *Screenshot:* ${info.screenshotUrl}` : `🖼 *Screenshot:* Not uploaded`,
    ``,
    info.status === "pending"
      ? `⚠️ Requires manual verification. Activate via admin panel.`
      : `✅ Subscription activated automatically.`,
  ];

  const message = lines.join("\n");

  for (const { phone, apikey } of ADMIN_NUMBERS) {
    if (!apikey) {
      logger.warn({ phone }, "CallMeBot API key not set — skipping WhatsApp notification. Set CALLMEBOT_APIKEY_1 and CALLMEBOT_APIKEY_2 env vars.");
      continue;
    }
    try {
      const params = new URLSearchParams({
        phone,
        text: message,
        apikey,
      });
      const res = await fetch(`${CALLMEBOT_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        logger.info({ phone }, "WhatsApp payment notification sent");
      } else {
        logger.warn({ phone, status: res.status }, "WhatsApp notification failed");
      }
    } catch (err) {
      logger.error({ err, phone }, "WhatsApp notification error");
    }
  }
}
