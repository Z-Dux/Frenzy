import { defineConfig } from "@mikro-orm/mongodb";
import { UserSchema, PortfolioSchema, TradeAnalysisSchema, TradeSchema } from "./src/db/schema";
import { config } from "./config/app";

export default defineConfig({
  entities: [UserSchema, PortfolioSchema, TradeAnalysisSchema, TradeSchema],
  dbName: "frenzy",
  clientUrl: config.MONGODB_URI,
});
