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
import { calcNetProfit, calcNetLoss, calcRR } from "@/engine/riskEngine";
import { useMemo, useState } from "react";
import { Trade, PRIMARY_STRATEGIES, PATTERN_TYPES, TRADING_SESSIONS, TradingSession, SESSION_LABELS, detectSession } from "@/types";

const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "US30", "NAS100",
];

const schema = z.object({
  pair: z.string().min(1, "Required"),
  direction: z.enum(["BUY", "SELL"]),
  entryPrice: z.coerce.number().positive("Must be positive"),
  stopLoss: z.coerce.number().positive("Must be positive"),
  takeProfit: z.coerce.number().positive("Must be positive"),
  lotSize: z.coerce.number().positive("Must be positive"),
  date: z.string().min(1, "Required"),
  outcome: z.enum(["WIN", "LOSS", "BE"]).optional(),
  notes: z.string().optional(),
  strategy: z.string().min(1, "Select a strategy"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editTrade?: Trade;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function AddTradeModal({ open, onClose, editTrade }: Props) {
  const addTrade = useTradeStore((s) => s.addTrade);
  const updateTrade = useTradeStore((s) => s.updateTrade);

  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(
    editTrade?.patterns ?? []
  );
  const [selectedSession, setSelectedSession] = useState<TradingSession | undefined>(
    editTrade?.session ?? detectSession()
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editTrade
      ? {
          pair: editTrade.pair,
          direction: editTrade.direction,
          entryPrice: editTrade.entryPrice,
          stopLoss: editTrade.stopLoss,
          takeProfit: editTrade.takeProfit,
          lotSize: editTrade.lotSize,
          date: editTrade.date.split("T")[0],
          outcome: editTrade.outcome,
          notes: editTrade.notes ?? "",
          strategy: editTrade.strategy ?? "",
        }
      : {
          pair: "EUR/USD",
          direction: "BUY",
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          lotSize: 0.1,
          date: new Date().toISOString().split("T")[0],
          notes: "",
          strategy: "",
        },
  });

  const watched = form.watch();
  const preview = useMemo(() => {
    const e = watched.entryPrice ?? 0;
    const sl = watched.stopLoss ?? 0;
    const tp = watched.takeProfit ?? 0;
    const lot = watched.lotSize ?? 0;
    if (!e || !sl || !tp || !lot) return null;
    return {
      np: calcNetProfit(e, tp, lot),
      nl: calcNetLoss(e, sl, lot),
      rr: calcRR(calcNetProfit(e, tp, lot), calcNetLoss(e, sl, lot)),
    };
  }, [watched.entryPrice, watched.stopLoss, watched.takeProfit, watched.lotSize]);

  function togglePattern(p: string) {
    setSelectedPatterns((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function onSubmit(values: FormValues) {
    const np = calcNetProfit(values.entryPrice, values.takeProfit, values.lotSize);
    const nl = calcNetLoss(values.entryPrice, values.stopLoss, values.lotSize);
    const rr = calcRR(np, nl);

    if (editTrade) {
      updateTrade(editTrade.id, { ...values, netProfit: np, netLoss: nl, rr, patterns: selectedPatterns, session: selectedSession });
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
            {/* ── Core fields ── */}
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
                      <Input type="number" step="0.00001" placeholder="1.08500" data-testid="input-entry-price" {...field} />
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
                      <Input type="number" step="0.00001" placeholder="1.08200" data-testid="input-stop-loss" {...field} />
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
                      <Input type="number" step="0.00001" placeholder="1.09100" data-testid="input-take-profit" {...field} />
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

            {/* ── Strategy (mandatory) ── */}
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

            {/* ── Patterns (multi-select) ── */}
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

            {/* ── Session ── */}
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

            {/* ── Notes ── */}
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

            {/* ── Risk preview ── */}
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
