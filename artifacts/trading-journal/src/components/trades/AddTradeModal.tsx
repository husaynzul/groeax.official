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
import {
  calcNetProfit,
  calcNetLoss,
  calcRR,
} from "@/engine/riskEngine";
import { useMemo } from "react";
import { Trade } from "@/types";

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
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editTrade?: Trade;
}

export default function AddTradeModal({ open, onClose, editTrade }: Props) {
  const addTrade = useTradeStore((s) => s.addTrade);
  const updateTrade = useTradeStore((s) => s.updateTrade);

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
        },
  });

  const watched = form.watch();
  const preview = useMemo(() => {
    const e = watched.entryPrice ?? 0;
    const sl = watched.stopLoss ?? 0;
    const tp = watched.takeProfit ?? 0;
    const lot = watched.lotSize ?? 0;
    if (!e || !sl || !tp || !lot) return null;
    const np = calcNetProfit(e, tp, lot);
    const nl = calcNetLoss(e, sl, lot);
    const rr = calcRR(np, nl);
    return { np, nl, rr };
  }, [watched.entryPrice, watched.stopLoss, watched.takeProfit, watched.lotSize]);

  function onSubmit(values: FormValues) {
    const e = values.entryPrice;
    const sl = values.stopLoss;
    const tp = values.takeProfit;
    const lot = values.lotSize;
    const np = calcNetProfit(e, tp, lot);
    const nl = calcNetLoss(e, sl, lot);
    const rr = calcRR(np, nl);

    if (editTrade) {
      updateTrade(editTrade.id, {
        ...values,
        netProfit: np,
        netLoss: nl,
        rr,
      });
    } else {
      const trade: Trade = {
        id: crypto.randomUUID(),
        ...values,
        netProfit: np,
        netLoss: nl,
        rr,
      };
      addTrade(trade);
    }
    form.reset();
    onClose();
  }

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-card-border">
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
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="1.08500"
                        data-testid="input-entry-price"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.10"
                        data-testid="input-lot-size"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="1.08200"
                        data-testid="input-stop-loss"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="1.09100"
                        data-testid="input-take-profit"
                        {...field}
                      />
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
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                data-testid="button-cancel-trade"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                data-testid="button-submit-trade"
              >
                {editTrade ? "Update Trade" : "Add Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
