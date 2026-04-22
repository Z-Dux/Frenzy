import { defineEntity, type InferEntity, p } from "@mikro-orm/core";
import { BaseSchema } from "./base";

export const TradeSchema = defineEntity({
  name: "Trade",
  properties: {
    asset: p.string(),
    entry: p.float(),
    stop_loss: p.float(),
    take_profit: p.float().nullable(),

    author: p.string(),
    messageUrl: p.string(),
    status: p.enum(() => ["pending", "active", "closed"]).default("pending"),

    closedAt: p.datetime().nullable(),
    closedPrice: p.float().nullable(),
  },
  extends: BaseSchema,
});

export type ITrade = InferEntity<typeof TradeSchema>;