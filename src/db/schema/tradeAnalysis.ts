import { defineEntity, type InferEntity, p } from '@mikro-orm/core';
import { BaseSchema } from './base';




export const TradeAnalysisSchema = defineEntity({
  name: 'TradeAnalysis',
  extends: BaseSchema,
  properties: {
    has_trade: p.boolean().default(false),

    action: p.enum(() => ["pending", "missed", "active"]).nullable(),

    type: p.enum(() => ["long", "short"]).nullable(),

    entry: p.float().nullable(),
    stop_loss: p.float().nullable(),
    take_profit: p.float().nullable(),

    confidence: p.float(),

    current_price: p.float().nullable(),

    order_type: p.enum(() => ["limit", "market"]).nullable(),

    timeframe: p.string().nullable(),
    asset: p.string().nullable(),

    insights: p.json(),
    warnings: p.json(),
  },
});

export type ITradeAnalysis = InferEntity<typeof TradeAnalysisSchema>;
