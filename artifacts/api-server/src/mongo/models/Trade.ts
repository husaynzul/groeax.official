import mongoose, { Document, Schema, Types } from "mongoose";

export interface ITrade extends Document {
  userId: Types.ObjectId;
  symbol: string;
  entryPrice: number;
  exitPrice?: number;
  profit?: number;
  loss?: number;
  strategy?: string;
  createdAt: Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    entryPrice: {
      type: Number,
      required: true,
    },
    exitPrice: {
      type: Number,
    },
    profit: {
      type: Number,
    },
    loss: {
      type: Number,
    },
    strategy: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const MongoTrade = mongoose.model<ITrade>("Trade", TradeSchema);
