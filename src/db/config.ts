import { defineConfig } from "@mikro-orm/mongodb";
import { UserSchema } from "./schema/user";
import { PortfolioSchema } from "./schema/portfolio";
import { TradeAnalysisSchema } from "./schema/tradeAnalysis";
import { TradeSchema } from "./schema/trade";
import { config } from "@config/app";

export default defineConfig({
  entities: [UserSchema, PortfolioSchema, TradeAnalysisSchema, TradeSchema],
  dbName: "frenzy",
  clientUrl: config.MONGODB_URI,
});
