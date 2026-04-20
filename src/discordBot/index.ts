import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "../../config";

export const botClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});


botClient.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag} as a bot`);
});

botClient.login(config.DISCORD_BOT_TOKEN);