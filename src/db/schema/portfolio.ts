import { defineEntity, type InferEntity, p } from '@mikro-orm/core';
import { BaseSchema } from './base';
type PnLHistoryItem = {
  date: Date;
  pnl: number;
};
export const PortfolioSchema = defineEntity({
  name: 'Portfolio',
  properties: {
    //id: p.integer().primary(),
    balance: p.float().default(100), // in USDT
    pnl: p.float().default(0),
    pnlHistory: p.json<PnLHistoryItem[]>().default([]), // Array of { date: Date, pnl: number }
  },
  extends: BaseSchema
});

export type IPortfolio = InferEntity<typeof PortfolioSchema>;
