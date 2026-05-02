import { Trade } from "../types";

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTradesToCSV(trades: Trade[]): void {
  const headers = [
    "Date", "Pair", "Direction", "Entry Price", "Stop Loss", "Take Profit",
    "Lot Size", "Outcome", "Net Profit", "Net Loss", "R:R", "Strategy",
    "Patterns", "Notes",
  ];

  const rows = trades.map((t) => [
    escapeCsv(t.date),
    escapeCsv(t.pair),
    escapeCsv(t.direction),
    escapeCsv(t.entryPrice),
    escapeCsv(t.stopLoss),
    escapeCsv(t.takeProfit),
    escapeCsv(t.lotSize),
    escapeCsv(t.outcome ?? ""),
    escapeCsv(t.netProfit),
    escapeCsv(t.netLoss),
    escapeCsv(t.rr),
    escapeCsv(t.strategy ?? ""),
    escapeCsv((t.patterns ?? []).join("; ")),
    escapeCsv(t.notes ?? ""),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tradelog_export_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
