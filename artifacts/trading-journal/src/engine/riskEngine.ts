export const PIP_SIZE = 0.0001;
export const PIP_VALUE_PER_LOT = 10;

export function calcProfitPips(entry: number, tp: number): number {
  return (tp - entry) / PIP_SIZE;
}
export function calcLossPips(entry: number, sl: number): number {
  return (entry - sl) / PIP_SIZE;
}
export function calcPipValue(lotSize: number): number {
  return PIP_VALUE_PER_LOT * lotSize;
}
export function calcNetProfit(entry: number, tp: number, lotSize: number): number {
  return calcProfitPips(entry, tp) * calcPipValue(lotSize);
}
export function calcNetLoss(entry: number, sl: number, lotSize: number): number {
  return calcLossPips(entry, sl) * calcPipValue(lotSize);
}
export function calcRR(netProfit: number, netLoss: number): number {
  return netLoss === 0 ? 0 : netProfit / netLoss;
}
