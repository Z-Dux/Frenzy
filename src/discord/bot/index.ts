import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "@config/app";
import { listenLive } from "./handlers";
import { handleBotInteraction, registerBotCommands } from "./commands";

export const botClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

botClient.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag} as a bot`);
  await registerBotCommands(readyClient);
  listenLive();
});

botClient.on(Events.InteractionCreate, async (interaction) => {
  await handleBotInteraction(interaction);
});

botClient.login(config.DISCORD_BOT_TOKEN);
