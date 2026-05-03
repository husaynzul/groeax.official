import { logger } from "../lib/logger.js";

const TRONSCAN_API = "https://apilist.tronscan.org/api";
const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TARGET_WALLET = "THrybvwth3eDpXVnZwBRohZ7AB3bY4Cqjs";
const EXPECTED_AMOUNT = "90000000"; // 90 USDT (6 decimals)

interface TronTransaction {
  hash: string;
  timestamp: number;
  from?: string;
  to?: string;
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
  expectedAmount: string = EXPECTED_AMOUNT,
  timestampWindow: number = 30 * 60 * 1000, // 30 minutes in ms
): Promise<{ valid: boolean; error?: string }> {
  // Validate TX hash format (TRON uses hex, typically 64 chars)
  if (!txHash || !/^[a-f0-9]{64}$/i.test(txHash.trim())) {
    return { valid: false, error: "Invalid transaction hash format" };
  }

  const cleanHash = txHash.trim().toLowerCase();
  const now = Date.now();

  // Fetch the main transaction
  const mainTx = await fetchTronTx(cleanHash);
  if (!mainTx) {
    return { valid: false, error: "Transaction not found on blockchain" };
  }

  // Check transaction timestamp is within window
  const txTimestamp = mainTx.timestamp * 1000;
  const timeDiff = Math.abs(now - txTimestamp);
  if (timeDiff > timestampWindow) {
    return {
      valid: false,
      error: `Transaction timestamp outside verification window (${Math.round(timeDiff / 1000 / 60)} minutes ago)`,
    };
  }

  // Check transaction status
  if (mainTx.ret && mainTx.ret[0]?.contractRet !== "SUCCESS") {
    return { valid: false, error: "Transaction failed or reverted" };
  }

  // Fetch TRC20 transfers
  const transfers = await fetchTRC20Transfers(cleanHash);
  if (transfers.length === 0) {
    return { valid: false, error: "No USDT transfers found in transaction" };
  }

  // Verify at least one transfer matches our criteria
  const validTransfer = transfers.find(
    (t) =>
      t.to === TARGET_WALLET &&
      t.value === expectedAmount &&
      t.token_info?.tokenName?.includes("USDT")
  );

  if (!validTransfer) {
    const details = transfers.map((t) => `${t.from} → ${t.to}: ${t.value} (${t.token_info?.tokenName})`).join("; ");
    return {
      valid: false,
      error: `Payment mismatch. Expected: 90 USDT to ${TARGET_WALLET}, Found: ${details}`,
    };
  }

  logger.info({ txHash: cleanHash, from: validTransfer.from }, "Payment verified");
  return { valid: true };
}
