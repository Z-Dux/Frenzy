import { type Client, type Interaction } from "discord.js";
import { config } from "@config/app";
import { portfolioCommand, executePortfolioCommand } from "./portfolio";

const botCommandHandlers = new Map([
  [portfolioCommand.name, executePortfolioCommand],
] as const);

export const botCommands = [portfolioCommand];

export async function registerBotCommands(client: Client<true>) {
  const commandData = botCommands.map((command) => command.toJSON());
  const registeredGuilds = [] as string[];

  for (const guildId of config.hostServers) {
    try {
      const guild = await client.guilds.fetch(guildId);
      await guild.commands.set(commandData);
      registeredGuilds.push(guildId);
    } catch (error) {
      console.error(`Failed to register slash commands in guild ${guildId}:`, error);
    }
  }

  console.log(
    `✓ Registered ${botCommands.length} slash command(s) in ${registeredGuilds.length} guild(s)`,
  );
}

export async function handleBotInteraction(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const handler = botCommandHandlers.get(interaction.commandName);
  if (!handler) {
    return;
  }

  await handler(interaction);
}