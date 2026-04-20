import { config as EnvConfig } from "dotenv";

EnvConfig();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  discordServers: [
    "1474861205460881481",
    "1042855255089623100",
    "1024605347895320576",
    "1353023779051147427",
    "1420710289858363392",
    "1340402376493891614",
    "1461803739013976138"
  ],
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",
  tradeLog: "1495776991490605106"
};
