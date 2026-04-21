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
import "colors"

export async function sendTrade(trade: TradeAnalysis, message: Message<true>) {
  if (!(trade.has_trade && (trade.entry || trade.order_type==`market`) && trade.stop_loss)) return false;

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
      textDisplay.setContent(codeBlock("ansi",texts || "- No insights or warnings")),
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
