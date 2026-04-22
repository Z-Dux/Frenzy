import { defineConfig } from "@mikro-orm/mongodb";
import { UserSchema } from "./src/schema/user";
import { PortfolioSchema } from "./src/schema/portfolio";
import { TradeAnalysisSchema } from "./src/schema/tradeAnalysis";
import { TradeSchema } from "./src/schema/trade";
import { config } from "./config";

export default defineConfig({
  entities: [UserSchema, PortfolioSchema, TradeAnalysisSchema, TradeSchema],
  dbName: "frenzy",
  clientUrl: config.MONGODB_URI,
});
