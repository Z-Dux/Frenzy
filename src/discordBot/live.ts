import {
  codeBlock,
  ComponentType,
  ContainerBuilder,
  MessageFlags,
} from "discord.js";
import { botClient } from ".";
import { config } from "../../config";
import { trader, type Trade } from "../trader";
import { orm } from "../database";
import { TradeSchema } from "../schema/trade";
import { binance } from "../binance";
import { sleep } from "bun";

export async function listenLive() {
  const liveChannel = await botClient.channels.fetch(config.liveTrade);
  if (!liveChannel?.isTextBased()) {
    console.log(`✗ Live trade channel not found or is not text-based`);
    return;
  }
  if (!liveChannel?.isSendable) {
    console.log(`✗ Cannot send messages to the live trade channel`);
    return;
  }

  const msgs = await liveChannel?.messages.fetch({ limit: 10 });
  const msg = msgs.find(
    (x) =>
      x.components.length > 0 &&
      x.components[0]?.type === ComponentType.Container,
  );
  const em = orm.em.fork();
  const trades = (
    await em.find(TradeSchema, {
      status: { $in: ["active"] },
    })
  ).sort((a, b) => String(a.asset).localeCompare(String(b.asset))) as Trade[];
  const cumulative: [number, number] = trades.reduce(
    (acc, trade) => {
      const price = Number(binance.coinPrices.get(trade.asset || "") || 0);
      const isLong = trade.direction === "long" ? -1 : 1;
      trade.enteredPrice = trade.enteredPrice || trade.entry;
      const profit =
        (trade.enteredPrice - price) *
        isLong *
        trade.leverage *
        (trade.margin / trade.entry);
      acc[0] += profit;
      acc[1] += trade.margin;
      return acc;
    },
    [0, 0],
  );
  console.log(cumulative);
  const txts = trades.map((trade) => {
    const price = Number(binance.coinPrices.get(trade.asset || "") || 0);
    const formattedPrice = formatPrice(price);
    const isLong = trade.direction === "long" ? -1 : 1;
    trade.enteredPrice = trade.enteredPrice || trade.entry;
    const profit =
      (trade.enteredPrice - price) *
      isLong *
      trade.leverage *
      (trade.margin / trade.entry);
    const pnl = (profit / (trade.margin || 1)) * 100;
    return [
      `${trade.leverage.toFixed(1)}x`.padStart(5, " ").magenta,
      `${colorize(`[${trade.direction.toUpperCase()}]`.padEnd(7, " "), trade.direction)}`,
      `${trade.asset.padStart(8, " ")}`,
      `${formattedPrice.padStart(8, " ")}`,
      `${formatPrice(trade.entry).padStart(8, " ")} `,
      `${colorize(profit.toFixed(4).padStart(8, " "), isLong)}` +
        ` (`.black +
        `${colorize(((pnl > 0 ? `+` : ``) + pnl.toFixed(2)).padStart(6, " "), isLong)}` +
        `%)`.black,
    ].join(" ");
  });
  const headers = [
    `Lev`.padEnd(5, " "),
    `Type`.padEnd(7, " "),
    `Asset`.padStart(8, " "),
    `M.Price`.padStart(8, " "),
    `Entry`.padStart(8, " "),
    `PnL`.padStart(10, " ").padEnd(17, " "),
  ];
  const cumPrefix = cumulative[0] >= 0 ? "+" : "";
  const total = [
    ` `.repeat(38) + 
      colorize(cumPrefix+formatPrice(cumulative[0]), cumulative[0] >= 0 ? 1 : -1) +
      ` USDT`.gray +
      ` ` +
      colorize(
        `(${cumPrefix+((cumulative[0] / (cumulative[1] || 1)) * 100).toFixed(2)}%)`,
        cumulative[0] >= 0 ? 1 : -1,
      ),
  ].join(" ");
  console.log(txts.join("\n"));
  const container = new ContainerBuilder()
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        "### Open Positions" + ` - <t:${Math.floor(Date.now() / 1000)}:R>`,
      ),
    )
    .setAccentColor(0x2f3136)
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(codeBlock(`ansi`, headers.join(" "))),
    )
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        txts.length > 0
          ? codeBlock(`ansi`, txts.join("\n"))
          : "- No open positions",
      ),
    )
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(codeBlock(`ansi`, total)),
    );

  if (msg?.editable) {
    await msg.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`✓ Live trade message updated with id ${msg.id}`);
  } else {
    //@ts-ignore
    const sentMessage = await liveChannel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`✓ Live trade message sent with id ${sentMessage.id}`);
  }
  await sleep(10_000); // 10s
  listenLive();
}

function colorize(text: string, value: "long" | "short" | 1 | -1) {
  if (value === 1 || value === "long") return text.green;
  if (value === -1 || value === "short") return text.red;
  return text.gray;
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(4).replace(/\.?0+$/, "");
}
