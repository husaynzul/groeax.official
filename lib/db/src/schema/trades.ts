import { pgTable, serial, integer, text, numeric, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  tradeData: jsonb("trade_data").notNull(),
  symbol: text("symbol"),
  entryPrice: numeric("entry_price", { precision: 18, scale: 8 }),
  exitPrice: numeric("exit_price", { precision: 18, scale: 8 }),
  profit: numeric("profit", { precision: 18, scale: 8 }),
  loss: numeric("loss", { precision: 18, scale: 8 }),
  strategy: text("strategy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("trades_user_client_unique").on(t.userId, t.clientId),
]);

export type TradeRow = typeof tradesTable.$inferSelect;

// Kept for backwards compatibility with /api/trades routes
export const insertTradeSchema = z.object({
  symbol: z.string().min(1),
  entryPrice: z.string(),
  exitPrice: z.string().optional(),
  profit: z.string().optional(),
  loss: z.string().optional(),
  strategy: z.string().optional(),
});
export const updateTradeSchema = insertTradeSchema.partial();
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type UpdateTrade = z.infer<typeof updateTradeSchema>;
