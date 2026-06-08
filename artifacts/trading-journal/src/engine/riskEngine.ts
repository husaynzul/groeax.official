export interface PipConfig {
  pipSize: number;
  pipValue: number;
}

const PIP_MAP: Record<string, PipConfig> = {
  "XAUUSD":  { pipSize: 0.01,   pipValue: 1    },
  "XAU/USD": { pipSize: 0.01,   pipValue: 1    },
  "XAGUSD":  { pipSize: 0.001,  pipValue: 5    },
  "XAG/USD": { pipSize: 0.001,  pipValue: 5    },
  "US30":    { pipSize: 1,      pipValue: 1    },
  "NAS100":  { pipSize: 1,      pipValue: 1    },
  "USTEC":   { pipSize: 1,      pipValue: 1    },
  "UK100":   { pipSize: 1,      pipValue: 1    },
  "GER40":   { pipSize: 1,      pipValue: 1    },
  "SPX500":  { pipSize: 0.1,    pipValue: 1    },
  "BTCUSD":  { pipSize: 1,      pipValue: 0.001},
  "ETHUSD":  { pipSize: 0.1,    pipValue: 0.01 },
};

const DEFAULT_PIP: PipConfig = { pipSize: 0.0001, pipValue: 10 };

export function getPipConfig(pair: string): PipConfig {
  const key = pair.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mapKey = pair.toUpperCase().replace(/\s/g, "");
  return PIP_MAP[mapKey] ?? PIP_MAP[key] ?? DEFAULT_PIP;
}

export function calcNetProfit(entry: number, tp: number, lotSize: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  const pips = (tp - entry) / cfg.pipSize;
  return parseFloat((pips * cfg.pipValue * lotSize).toFixed(2));
}

export function calcNetLoss(entry: number, sl: number, lotSize: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  const pips = (entry - sl) / cfg.pipSize;
  return parseFloat((pips * cfg.pipValue * lotSize).toFixed(2));
}

export function calcExitPnL(
  entry: number,
  exitPrice: number,
  lotSize: number,
  direction: "BUY" | "SELL",
  pair = "EUR/USD",
): number {
  const cfg = getPipConfig(pair);
  const rawDiff = direction === "BUY" ? exitPrice - entry : entry - exitPrice;
  return parseFloat(((rawDiff / cfg.pipSize) * cfg.pipValue * lotSize).toFixed(2));
}

export function calcRR(netProfit: number, netLoss: number): number {
  return netLoss === 0 ? 0 : parseFloat((netProfit / netLoss).toFixed(2));
}

export const PIP_SIZE = 0.0001;
export const PIP_VALUE_PER_LOT = 10;

export function calcProfitPips(entry: number, tp: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  return parseFloat(((tp - entry) / cfg.pipSize).toFixed(1));
}

export function calcLossPips(entry: number, sl: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  return parseFloat(((entry - sl) / cfg.pipSize).toFixed(1));
}

export function calcPipValue(lotSize: number, pair = "EUR/USD"): number {
  const cfg = getPipConfig(pair);
  return parseFloat((cfg.pipValue * lotSize).toFixed(2));
}
