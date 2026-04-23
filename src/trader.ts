import { tradeConfig } from "../config";
import { binance, type Binance } from "./binance";
import { orm } from "./database";
import { closeTrade, openTrade } from "./discordBot/utils";
import { PortfolioSchema } from "./schema/portfolio";
import { TradeSchema } from "./schema/trade";

export type Trade = {
  asset: string;
  entry: number;
  stop_loss: number;
  take_profit: number | null;
  direction: "long" | "short";
  enteredPrice: number | null;

  leverage: number;
  margin: number;

  author: string;
  messageUrl: string;
  status: "pending" | "active" | "closed";
  order_type?: "limit" | "market";

  closedAt: Date | null;
  closedPrice: number | null;
};
type Portfolio = {
  balance: number; // in USDT
  trades: Trade[];
  pnl: number;
};
export class Trader {
  binance: Binance = binance;
  portfolio: Portfolio = {
    balance: 100, // in USDT
    trades: [],
    pnl: 0,
  };
  constructor() {
    this.init();
    this.watchTrades();
  }
  async init() {
    const em = orm.em.fork();

    const portfolio = await this.getPortfolio();
    this.portfolio.balance = portfolio?.balance || 500;

    const trades = await em.find(TradeSchema, {
      status: { $ne: "closed" },
    });
    for (const trade of trades) {
      this.addTrade({
        asset: trade.asset,
        entry: trade.entry,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit || null,
        leverage: trade.leverage,
        margin: trade.margin,
        enteredPrice: trade.enteredPrice || null,
        direction: trade.direction as "long" | "short",
        order_type: (trade.order_type as "limit" | "market") || null,
        author: trade.author,
        messageUrl: trade.messageUrl,
        status: trade.status as "pending" | "active" | "closed",
        closedAt: trade.closedAt || null,
        closedPrice: trade.closedPrice || null,
      });
    }
  }
  async addPnL(amount: number) {
    console.log(`Adding PnL: ${amount.toFixed(4)} USDT`);
    const portfolio = await this.getPortfolio();
    if (!portfolio) {
      console.log(`✗ Portfolio not found when adding PnL`);
      return;
    }
    portfolio.balance += amount;
    portfolio.pnl += amount;
    portfolio.pnlHistory.push({ date: new Date(), pnl: portfolio.pnl });
    const em = orm.em.fork();
    em.persist(portfolio);
    await em.flush();
  }
  async getPortfolio() {
    const em = orm.em.fork();

    let [portfolio] = await em.find(PortfolioSchema, {}, { limit: 1 });
    if (!portfolio) {
      const newPortfolio = em.create(PortfolioSchema, {
        balance: 500,
        pnl: 0,
        pnlHistory: [],
      });
      em.persist(newPortfolio);
      await em.flush();
      console.log(`✓ Portfolio created with id ${newPortfolio._id}`);
      portfolio = newPortfolio;
      //return newPortfolio;
    }
    this.portfolio.balance = portfolio.balance;
    this.portfolio.pnl = portfolio.pnl;
    return portfolio;
  }
  async addTrade(trade: Trade, create = false) {
    if (trade.status !== "closed") this.binance.subscribe(trade.asset);
    if (create) {
      const em = orm.em.fork();
      const tradeInstance = em.create(TradeSchema, trade);
      em.persist(tradeInstance);
      await em.flush();
    }
    this.portfolio.trades.push(trade);
  }
  async removeTrade(trade: Trade) {
    console.log(`Removing trade for ${trade.asset}`);
    const exists = this.portfolio.trades.find(
      (t) => t.messageUrl === trade.messageUrl,
    );
    if (!exists)
      return console.log(
        `✗ Trade not found in portfolio for messageUrl ${trade.messageUrl}`,
      );
    this.portfolio.trades = this.portfolio.trades.filter(
      (t) => t.messageUrl !== trade.messageUrl,
    );
    let assetExists = this.portfolio.trades.filter(
      (t) => t.asset === trade.asset && t.status !== "closed",
    );
    if (assetExists.length === 0) this.binance.unsubscribe(trade.asset);
    else console.log(assetExists);
  }
  watchTrades() {
    binance.on("price", async (price) => {
      const trades = this.portfolio.trades.filter(
        (t) =>
          t.asset.toLowerCase() === price.symbol.toLowerCase() &&
          t.status !== "closed",
      );
      for (const trade of trades) {
        const errorMarginPct = 0.0003; // 0.03% error margin
        const entryMargin = trade.entry * errorMarginPct;
        let updated = false;
        if (
          trade.status === "pending" &&
          ((trade.entry - entryMargin <= price.price &&
            price.price <= trade.entry + entryMargin) ||
            trade.order_type === "market")
        ) {
          trade.status = "active";
          trade.enteredPrice = price.price;

          const riskAmount =
            this.portfolio.balance * (tradeConfig.riskPerTrade || 0.01);
          const priceDiff = Math.abs(trade.enteredPrice - trade.stop_loss);

          if (priceDiff === 0) {
            throw new Error("Invalid trade: entry == stop_loss");
          }

          const percentMove = priceDiff / trade.enteredPrice;
          const positionSize = riskAmount / percentMove;
          let leverage = positionSize / riskAmount;

          const maxLeverage = 50;
          if (leverage > maxLeverage) {
            leverage = maxLeverage;
          }

          const margin = positionSize / leverage;

          trade.leverage = leverage > 0 ? leverage : 1;
          trade.margin = margin;

          console.log(
            `${trade.direction.toLocaleUpperCase()} Trade for ${trade.asset} is now active at price ${price.price}`,
          );
          updated = true;
          openTrade(trade);
        } else if (trade.status === "active") {
          if (
            trade.take_profit !== null &&
            ((trade.direction === "long" &&
              price.price >=
                trade.take_profit - trade.take_profit * errorMarginPct) ||
              (trade.direction === "short" &&
                price.price <=
                  trade.take_profit + trade.take_profit * errorMarginPct))
          ) {
            trade.status = "closed";
            this.removeTrade(trade);
            trade.closedAt = new Date();
            trade.closedPrice = price.price;
            console.log(
              `${trade.direction.toLocaleUpperCase()} Trade for ${trade.asset} is closed (took profit) at price ${trade.take_profit}`,
            );
            updated = true;
            this.addPnL(
              trade.direction === "long"
                ? (trade.closedPrice! - trade.enteredPrice!) *
                    trade.leverage *
                    trade.margin
                : (trade.enteredPrice! - trade.closedPrice!) *
                    trade.leverage *
                    trade.margin,
            );
            closeTrade(trade);
          } else if (
            trade.stop_loss !== null &&
            ((trade.direction === "long" &&
              price.price <=
                trade.stop_loss + trade.stop_loss * errorMarginPct) ||
              (trade.direction === "short" &&
                price.price >=
                  trade.stop_loss - trade.stop_loss * errorMarginPct))
          ) {
            this.removeTrade(trade);
            trade.status = "closed";
            trade.closedAt = new Date();
            trade.closedPrice = price.price;
            console.log(
              `${trade.direction.toLocaleUpperCase()} Trade for ${trade.asset} is closed (stop lossed) at price ${trade.stop_loss}`,
            );
            updated = true;
            this.addPnL(
              trade.direction === "long"
                ? (trade.closedPrice! - trade.enteredPrice!) *
                    trade.leverage *
                    trade.margin
                : (trade.enteredPrice! - trade.closedPrice!) *
                    trade.leverage *
                    trade.margin,
            );
            closeTrade(trade);
          }
        }
        if (updated) {
          const em = orm.em.fork();
          const tradeInstance = await em.findOne(TradeSchema, {
            messageUrl: trade.messageUrl,
          });
          if (!tradeInstance) {
            console.log(
              `✗ Trade not found in database for messageUrl ${trade.messageUrl}`,
            );
            continue;
          }
          Object.assign(tradeInstance, trade);
          await em.flush();
        }
      }
    });
  }
}

export const trader = new Trader();
