import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTradeStore } from "@/store/tradeStore";
import { calcNetProfit, calcNetLoss, calcExitPnL, calcRR } from "@/engine/riskEngine";
import { parseBrokerPrice } from "@/utils/priceParser";
import { useMemo, useState } from "react";
import { Trade, PRIMARY_STRATEGIES, PATTERN_TYPES, TRADING_SESSIONS, TradingSession, SESSION_LABELS, detectSession } from "@/types";

const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "US30", "NAS100",
];

function priceField(label: string) {
  return z
    .string()
    .min(1, "Required")
    .transform((v) => parseBrokerPrice(v))
    .refine((n) => n > 0, `${label} must be a positive number`);
}

const schema = z.object({
  pair: z.string().min(1, "Required"),
  direction: z.enum(["BUY", "SELL"]),
  entryPrice: priceField("Entry price"),
  exitPrice: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? parseBrokerPrice(v) : undefined))
    .refine((n) => n === undefined || n > 0, "Exit price must be positive"),
  stopLoss: priceField("Stop loss"),
  takeProfit: priceField("Take profit"),
  lotSize: z.coerce.number().positive("Must be positive"),
  date: z.string().min(1, "Required"),
  outcome: z.enum(["WIN", "LOSS", "BE"]).optional(),
  notes: z.string().optional(),
  strategy: z.string().min(1, "Select a strategy"),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export interface TradeFormPrefill {
  pair?: string;
  direction?: "BUY" | "SELL";
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lotSize?: number;
  date?: string;
  outcome?: "WIN" | "LOSS" | "BE";
  notes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editTrade?: Trade;
  prefill?: TradeFormPrefill;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function computePnL(values: Partial<FormInput>): { np: number; nl: number; rr: number } | null {
  const {
    pair = "EUR/USD",
    direction = "BUY",
    outcome,
  } = values;

  // Price fields are strings in the form state — parse them safely
  const e  = parseBrokerPrice(values.entryPrice);
  const sl = parseBrokerPrice(values.stopLoss);
  const tp = parseBrokerPrice(values.takeProfit);
  const ep = values.exitPrice ? parseBrokerPrice(values.exitPrice) : 0;
  const lot = typeof values.lotSize === "number" ? values.lotSize : parseBrokerPrice(String(values.lotSize ?? "0"));

  if (!e || !lot) return null;

  if (ep && ep > 0) {
    const pnl = calcExitPnL(e, ep, lot, direction, pair);
    const isWin = pnl >= 0;
    const np = isWin ? pnl : 0;
    const nl = isWin ? 0 : Math.abs(pnl);
    const nlForRR = sl > 0 ? calcNetLoss(e, sl, lot, pair) : nl;
    return { np, nl, rr: calcRR(np, nlForRR) };
  }

  if (!sl || !tp) return null;

  let np = calcNetProfit(e, tp, lot, pair);
  let nl = calcNetLoss(e, sl, lot, pair);

  if (outcome === "WIN" && np < 0) np = Math.abs(np);
  if (outcome === "LOSS" && nl < 0) nl = Math.abs(nl);

  return { np, nl, rr: calcRR(np, nl) };
}

export default function AddTradeModal({ open, onClose, editTrade, prefill }: Props) {
  const addTrade = useTradeStore((s) => s.addTrade);
  const updateTrade = useTradeStore((s) => s.updateTrade);

  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(
    editTrade?.patterns ?? []
  );
  const [selectedSession, setSelectedSession] = useState<TradingSession | undefined>(
    editTrade?.session ?? detectSession()
  );

  const defaultEmpty: FormInput = {
    pair: "EUR/USD",
    direction: "BUY",
    entryPrice: "",
    exitPrice: "",
    stopLoss: "",
    takeProfit: "",
    lotSize: 0.1,
    date: new Date().toISOString().split("T")[0],
    notes: "",
    strategy: "",
  };

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: editTrade
      ? {
          pair: editTrade.pair,
          direction: editTrade.direction,
          entryPrice: String(editTrade.entryPrice),
          exitPrice: editTrade.exitPrice != null ? String(editTrade.exitPrice) : "",
          stopLoss: String(editTrade.stopLoss),
          takeProfit: String(editTrade.takeProfit),
          lotSize: editTrade.lotSize,
          date: editTrade.date.split("T")[0],
          outcome: editTrade.outcome,
          notes: editTrade.notes ?? "",
          strategy: editTrade.strategy ?? "",
        }
      : prefill
      ? {
          ...defaultEmpty,
          ...(prefill.pair        && { pair: prefill.pair }),
          ...(prefill.direction   && { direction: prefill.direction }),
          ...(prefill.entryPrice  && { entryPrice: String(prefill.entryPrice) }),
          ...(prefill.exitPrice   && { exitPrice: String(prefill.exitPrice) }),
          ...(prefill.stopLoss    && { stopLoss: String(prefill.stopLoss) }),
          ...(prefill.takeProfit  && { takeProfit: String(prefill.takeProfit) }),
          ...(prefill.lotSize     && { lotSize: prefill.lotSize }),
          ...(prefill.date        && { date: prefill.date }),
          ...(prefill.outcome     && { outcome: prefill.outcome }),
          ...(prefill.notes       && { notes: prefill.notes }),
        }
      : defaultEmpty,
  });

  const watched = form.watch();
  const preview = useMemo(() => computePnL(watched), [
    watched.pair, watched.entryPrice, watched.exitPrice,
    watched.stopLoss, watched.takeProfit, watched.lotSize,
    watched.direction, watched.outcome,
  ]);

  function togglePattern(p: string) {
    setSelectedPatterns((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function onSubmit(values: FormValues) {
    // values.entryPrice / stopLoss / takeProfit / exitPrice are already
    // parsed numbers at this point — zod ran the transform on submit
    const pnl = computePnL({
      ...watched,
      entryPrice: String(values.entryPrice),
      stopLoss: String(values.stopLoss),
      takeProfit: String(values.takeProfit),
      exitPrice: values.exitPrice != null ? String(values.exitPrice) : "",
    });
    const np = pnl?.np ?? 0;
    const nl = pnl?.nl ?? 0;
    const rr = pnl?.rr ?? 0;

    if (editTrade) {
      updateTrade(editTrade.id, {
        ...values,
        netProfit: np,
        netLoss: nl,
        rr,
        patterns: selectedPatterns,
        session: selectedSession,
      });
    } else {
      const trade: Trade = {
        id: crypto.randomUUID(),
        ...values,
        netProfit: np,
        netLoss: nl,
        rr,
        patterns: selectedPatterns,
        session: selectedSession,
      };
      addTrade(trade);
    }
    form.reset();
    setSelectedPatterns([]);
    setSelectedSession(detectSession());
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-card-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {editTrade ? "Edit Trade" : "Add New Trade"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pair"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pair</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-pair">
                          <SelectValue placeholder="Select pair" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FOREX_PAIRS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <div className="flex gap-2">
                      {(["BUY", "SELL"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          data-testid={`button-direction-${d.toLowerCase()}`}
                          onClick={() => field.onChange(d)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            field.value === d
                              ? d === "BUY"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "bg-red-500/20 text-red-400 border-red-500/40"
                              : "border-border text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entryPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Price</FormLabel>
                    <FormControl>
                      <Input type="text" inputMode="decimal" placeholder="1.08500 or 27,267.9" data-testid="input-entry-price" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Exit Price <span className="text-muted-foreground text-xs">(optional — actual close)</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="text" inputMode="decimal" placeholder="Actual exit price" data-testid="input-exit-price" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lotSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot Size</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.10" data-testid="input-lot-size" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stopLoss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stop Loss</FormLabel>
                    <FormControl>
                      <Input type="text" inputMode="decimal" placeholder="1.08200 or 27,100.0" data-testid="input-stop-loss" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="takeProfit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Take Profit</FormLabel>
                    <FormControl>
                      <Input type="text" inputMode="decimal" placeholder="1.09100 or 27,500.0" data-testid="input-take-profit" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-outcome">
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="WIN">Win</SelectItem>
                        <SelectItem value="LOSS">Loss</SelectItem>
                        <SelectItem value="BE">Breakeven</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Strategy <span className="text-red-400 text-xs">*required</span>
                  </FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {PRIMARY_STRATEGIES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => field.onChange(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          field.value === s
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Patterns <span className="text-muted-foreground text-xs">(optional, multi-select)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PATTERN_TYPES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePattern(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      selectedPatterns.includes(p)
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/40"
                        : "border-border text-muted-foreground hover:border-violet-400/30 hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Session <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TRADING_SESSIONS.map((s) => {
                  const colors: Record<string, string> = {
                    ASIA: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
                    TOKYO: "bg-violet-500/20 text-violet-400 border-violet-500/40",
                    LONDON: "bg-blue-500/20 text-blue-400 border-blue-500/40",
                    NEW_YORK: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                  };
                  const flags: Record<string, string> = {
                    ASIA: "🌏", TOKYO: "🗼", LONDON: "🇬🇧", NEW_YORK: "🗽",
                  };
                  const active = selectedSession === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSession(active ? undefined : s)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        active ? colors[s] : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      <span>{flags[s]}</span>
                      {SESSION_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Trade notes, observations..."
                      className="resize-none h-20"
                      data-testid="textarea-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {preview && (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                  <p className="text-sm font-semibold text-emerald-400">{fmtMoney(preview.np)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Net Loss</p>
                  <p className="text-sm font-semibold text-red-400">{fmtMoney(preview.nl)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">R:R Ratio</p>
                  <p className="text-sm font-semibold text-foreground">{preview.rr.toFixed(2)}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-trade">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" data-testid="button-submit-trade">
                {editTrade ? "Update Trade" : "Add Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
