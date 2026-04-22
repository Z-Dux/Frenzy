import {
  ButtonStyle,
  codeBlock,
  ContainerBuilder,
  MessageFlags,
  UserSelectMenuBuilder,
} from "discord.js";
import type { TradeAnalysis } from "../openrouter";
import { botClient } from ".";
import { config } from "../../config";
import type { Message } from "discord.js-selfbot-v13";
import "colors";
import { trader, type Trade } from "../trader";

export async function sendTrade(trade: TradeAnalysis, message: Message<true>) {
  if (
    !(
      trade.has_trade &&
      (trade.entry || trade.order_type == `market`) &&
      trade.stop_loss
    )
  )
    return false;

  const tradePara = [
    `### [Trade from ${message.author.tag} in ${message.channel.guild?.name}](${message.url})`,
    `- **Entry:** \`$${trade.entry}\``,
    `- **Stop Loss:** \`$${trade.stop_loss}\``,
    `- **Take Profit:** \`$${trade.take_profit}\``,
  ].join("\n");
  const additionalPara = [
    `- **Current Price:** \`${trade.current_price}\``,
    `- **Action:** \`${trade.action}\``,
    `- **Asset:** \`${trade.asset}\``,
  ].join("\n");
  const texts = [
    ...trade.insights.map((i) => `- 💡 ${i}`.green),
    ...trade.warnings.map((w) => `- ⚠️ ${w}`.yellow),
  ].join("\n");

  const exampleContainer = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(tradePara),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId("trade")
            .setLabel(trade.type === "long" ? "Long" : "Short")
            .setDisabled(true)
            .setStyle(
              trade.type === "long"
                ? ButtonStyle.Success
                : trade.type === "short"
                  ? ButtonStyle.Danger
                  : ButtonStyle.Secondary,
            ),
        ),
    )
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(additionalPara),
    )
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        codeBlock("ansi", texts || "- No insights or warnings"),
      ),
    );

  const channel = await botClient.channels.fetch(config.tradeLog);
  if (!channel?.isTextBased()) {
    console.log(`✗ Trade log channel not found or is not text-based`);
    return false;
  }
  if (!channel?.isSendable) {
    console.log(`✗ Cannot send messages to the trade log channel`);
    return false;
  }
  //@ts-ignore
  await channel.send({
    components: [exampleContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function openTrade(trade: Trade) {
  if (trade.status !== "active") return;
  if (!trade.enteredPrice) trade.enteredPrice = trade.entry;
  const channel = await botClient.channels.fetch(config.portfolioLog.open);

  const texts = [
    `### Trade opened for \`${trade.asset}\``,
    `- Entry: \`$${trade.entry || "Market"}\``,
    `- Actual Entry: \`$${trade.enteredPrice}\``,
    `- Stop Loss: \`$${trade.stop_loss} (${trade.stop_loss ? `-` + (Math.abs((trade.stop_loss - trade.enteredPrice) / trade.enteredPrice) * 100).toFixed(2) : "N/A"}%)\``,
    `- Take Profit: \`$${trade.take_profit || "N/A"} (${trade.take_profit ? `+` + (Math.abs((trade.take_profit - trade.enteredPrice) / trade.enteredPrice) * 100).toFixed(2) : "N/A"}%)\``,
  ].join("\n");
  const texts2 = [
    `- Leverage: \`${trade.leverage}x\``,
    `- Margin: \`${trade.margin.toFixed(2)} USDT\``,
    `- Position Size: \`${(trade.margin * trade.leverage).toFixed(2)} USDT\``,
  ].join("\n");
  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(texts),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId("trade")
            .setLabel(trade.direction === "long" ? "Long" : "Short")
            .setDisabled(true)
            .setStyle(
              trade.direction === "long"
                ? ButtonStyle.Success
                : trade.direction === "short"
                  ? ButtonStyle.Danger
                  : ButtonStyle.Secondary,
            ),
        ),
    )
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent(texts2));
  if (!channel?.isTextBased()) {
    console.log(`✗ Portfolio log channel not found or is not text-based`);
    return false;
  }
  if (!channel?.isSendable) {
    console.log(`✗ Cannot send messages to the portfolio log channel`);
    return false;
  }
  //@ts-ignore
  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function closeTrade(trade: Trade) {
  if (trade.status !== "closed") return;

  if (!trade.enteredPrice || !trade.closedPrice || !trade.margin) {
    console.log("✗ Invalid trade data for closing:", trade);
    return;
  }
  const port = await trader.getPortfolio();
  const bal = port ? port.balance : 0;

  const channel = await botClient.channels.fetch(config.portfolioLog.close);

  const directionMultiplier = trade.direction === "long" ? 1 : -1;

  const priceChange =
    ((trade.closedPrice - trade.enteredPrice) / trade.enteredPrice) *
    100 *
    directionMultiplier;

  const profitAmount = trade.margin * trade.leverage * (priceChange / 100);

  const pnlPercent = (profitAmount / trade.margin) * 100;

  // --- UI text (matches your openTrade style) ---
  const texts = [
    `### Trade closed for \`${trade.asset}\``,
    `- Entry: \`$${trade.enteredPrice}\``,
    `- Exit: \`$${trade.closedPrice}\``,
    `- Price Change: \`${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%\``,
  ].join("\n");

  const texts2 = [
    `- Leverage: \`${trade.leverage.toFixed(2)}x\``,
    `- Margin: \`${trade.margin.toFixed(2)} USDT\``,
    `- PnL: \`${profitAmount >= 0 ? "+" : ""}${profitAmount.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)\``,
  ].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(profitAmount >= 0 ? 0x2ecc71 : 0xe74c3c) // green/red
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(texts),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId("trade")
            .setLabel(trade.direction === "long" ? "Long" : "Short")
            .setDisabled(true)
            .setStyle(
              trade.direction === "long"
                ? ButtonStyle.Success
                : ButtonStyle.Danger,
            ),
        ),
    )
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent(texts2))
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent(`-# Portfolio: \`${bal.toFixed(2)} USDT\``))

  if (!channel?.isTextBased()) {
    console.log(`✗ Portfolio log channel not found or is not text-based`);
    return false;
  }

  if (!channel?.isSendable) {
    console.log(`✗ Cannot send messages to the portfolio log channel`);
    return false;
  }

  //@ts-ignore
  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  return {
    priceChange,
    profitAmount,
    pnlPercent,
  };
}

/**
   has_trade: boolean;
   type: TradeType;
   entry: number | null;
   stop_loss: number | null;
   take_profit: number | null;
   confidence: number; // 0 → 1
   current_price: number | null;
   order_type: "limit" | "market" | null;
   timeframe: string | null;
   asset: string | null;
   insights: string[];
   warnings: string[];
 */
