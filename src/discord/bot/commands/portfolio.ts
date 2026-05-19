import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { trader } from "@core/trader";

const HISTORY_LIMIT = 10;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatUsdt(amount: number) {
  return `${amount >= 0 ? "+" : "-"}$${Math.abs(amount).toFixed(2)}`;
}

function formatHistoryEntry(date: Date | string | number, pnl: number) {
  return `- <t:${Math.floor(new Date(date).getTime()/1000)}:R> • ${formatUsdt(pnl)}`;
}

export const portfolioCommand = new SlashCommandBuilder()
  .setName("portfolio")
  .setDescription("Manage the tracked portfolio balance and PnL history")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-balance")
      .setDescription("Set a new tracked portfolio balance")
      .addNumberOption((option) =>
        option
          .setName("amount")
          .setDescription("New portfolio balance in USDT")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("balance")
      .setDescription("View the current tracked portfolio balance"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("pnl-history")
      .setDescription("View the recent realized PnL history"),
  );

export async function executePortfolioCommand(
  interaction: ChatInputCommandInteraction,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set-balance") {
      const amount = interaction.options.getNumber("amount", true);

      if (!Number.isFinite(amount) || amount < 0) {
        await interaction.editReply("Balance must be a finite value of 0 or more.");
        return;
      }

      const portfolio = await trader.setPortfolioBalance(amount);
      const embed = new EmbedBuilder()
        .setTitle("Portfolio balance updated")
        .setColor(0x2ecc71)
        .addFields(
          { name: "Balance", value: `$${portfolio.balance.toFixed(2)}`, inline: true },
          { name: "Realized PnL", value: formatUsdt(portfolio.pnl), inline: true },
          {
            name: "PnL History Entries",
            value: String(portfolio.pnlHistory.length),
            inline: true,
          },
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const portfolio = await trader.getPortfolio();

    if (subcommand === "balance") {
      const latestEntry = portfolio.pnlHistory.at(-1);
      const embed = new EmbedBuilder()
        .setTitle("Portfolio balance")
        .setColor(0x3498db)
        .addFields(
          { name: "Balance", value: `$${portfolio.balance.toFixed(2)}`, inline: true },
          { name: "Realized PnL", value: formatUsdt(portfolio.pnl), inline: true },
          {
            name: "History Entries",
            value: String(portfolio.pnlHistory.length),
            inline: true,
          },
        );

      if (latestEntry) {
        embed.addFields({
          name: "Latest PnL Update",
          value: `${formatHistoryEntry(latestEntry.date, latestEntry.pnl)}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const recentHistory = portfolio.pnlHistory.slice(-HISTORY_LIMIT).reverse();
    const embed = new EmbedBuilder()
      .setTitle("PnL history")
      .setColor(0x9b59b6)
      .setDescription(
        recentHistory.length > 0
          ? recentHistory
              .map((entry) => formatHistoryEntry(entry.date, entry.pnl))
              .join("\n")
          : "No realized PnL history yet.",
      )
      .setFooter({
        text: `Showing the latest ${Math.min(
          HISTORY_LIMIT,
          portfolio.pnlHistory.length,
        )} entries`,
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to handle /portfolio command:", error);
    await interaction.editReply(
      "Something went wrong while handling the portfolio command.",
    );
  }
}