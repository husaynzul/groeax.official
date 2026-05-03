import { logger } from "../lib/logger.js";

const TRONSCAN_API = "https://apilist.tronscan.org/api";

export function getTargetWallet(): string {
  return process.env.USDT_TRC20_WALLET ?? "THrybvwth3eDpXVnZwBRohZ7AB3bY4Cqjs";
}

// USDT has 6 decimals on TRON
export const PLAN_AMOUNTS_USDT: Record<string, string> = {
  platinum_monthly: "10000000",    // $10
  platinum_yearly:  "105000000",   // $105
  premium_monthly:  "105000000",   // $105
  premium_yearly:   "1050000000",  // $1050
};

export const PLAN_AMOUNT_DISPLAY: Record<string, string> = {
  platinum_monthly: "10",
  platinum_yearly:  "105",
  premium_monthly:  "105",
  premium_yearly:   "1050",
};

interface TronTransaction {
  hash: string;
  timestamp: number;
  contractRet?: string;
  ret?: Array<{ contractRet: string }>;
}

interface TronTRC20Transfer {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info?: { tokenName?: string };
}

async function fetchTronTx(txHash: string): Promise<TronTransaction | null> {
  try {
    const res = await fetch(`${TRONSCAN_API}/transaction-info?hash=${txHash}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: TronTransaction };
    return data.data ?? null;
  } catch (err) {
    logger.error({ err, txHash }, "Failed to fetch TRON transaction");
    return null;
  }
}

async function fetchTRC20Transfers(txHash: string): Promise<TronTRC20Transfer[]> {
  try {
    const res = await fetch(`${TRONSCAN_API}/token_trc20_transfer?transaction_id=${txHash}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: TronTRC20Transfer[] };
    return data.data ?? [];
  } catch (err) {
    logger.error({ err, txHash }, "Failed to fetch TRC20 transfers");
    return [];
  }
}

export async function verifyTronPayment(
  txHash: string,
  expectedAmountRaw: string,
  timestampWindow: number = 30 * 60 * 1000,
): Promise<{ valid: boolean; error?: string }> {
  if (!txHash || !/^[a-f0-9]{64}$/i.test(txHash.trim())) {
    return { valid: false, error: "Invalid transaction hash format" };
  }

  const cleanHash = txHash.trim().toLowerCase();
  const targetWallet = getTargetWallet();
  const now = Date.now();

  const mainTx = await fetchTronTx(cleanHash);
  if (!mainTx) {
    return { valid: false, error: "Transaction not found on blockchain" };
  }

  const txTimestamp = mainTx.timestamp * 1000;
  const timeDiff = Math.abs(now - txTimestamp);
  if (timeDiff > timestampWindow) {
    return {
      valid: false,
      error: `Transaction timestamp outside ±30 minute window (${Math.round(timeDiff / 1000 / 60)} min ago)`,
    };
  }

  if (mainTx.ret && mainTx.ret[0]?.contractRet !== "SUCCESS") {
    return { valid: false, error: "Transaction failed or reverted on blockchain" };
  }

  const transfers = await fetchTRC20Transfers(cleanHash);
  if (transfers.length === 0) {
    return { valid: false, error: "No USDT TRC20 transfers found in this transaction" };
  }

  const validTransfer = transfers.find(
    (t) =>
      t.to === targetWallet &&
      t.value === expectedAmountRaw &&
      t.token_info?.tokenName?.includes("USDT"),
  );

  if (!validTransfer) {
    return {
      valid: false,
      error: `Payment mismatch. Check amount and destination wallet (${targetWallet})`,
    };
  }

  logger.info({ txHash: cleanHash, from: validTransfer.from }, "TRON payment verified");
  return { valid: true };
}
