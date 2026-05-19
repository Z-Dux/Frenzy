import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "@config/app";
import { listenLive } from "./handlers";

export const botClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

botClient.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag} as a bot`);
  listenLive();
});

botClient.on(Events.MessageCreate, async (message) => {
  
})

botClient.login(config.DISCORD_BOT_TOKEN);
