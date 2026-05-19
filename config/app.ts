import { config as EnvConfig } from "dotenv";

EnvConfig();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  hostServers: ["1461803739013976138"],
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  discordServers: [
    "1474861205460881481",
    "1042855255089623100",
    "1024605347895320576",
    "1353023779051147427",
    "1420710289858363392",
    "1340402376493891614",
    "1461803739013976138",
  ],
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",
  tradeLog: "1496571283930878092",
  liveTrade: "1496575116027498677",
  portfolioLog: {
    create: "1496571337295266102",
    open: "1496571303002374215",
    close: "1496571314369073154",
  },
  MONGODB_URI: process.env.MONGODB_URI || "",
};

export const tradeConfig = {
  leverage: 10,
  riskPerTrade: 0.05,
};
