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
import { color, sleep } from "bun";

export async function listenLive(): Promise<void> {
  const channel = await botClient.channels.fetch(config.liveTrade);

  if (!channel?.isTextBased()) {
    console.log(`✗ Live trade channel not found or is not text-based`);
    return;
  }

  if (!channel.isSendable) {
    console.log(`✗ Cannot send messages to the live trade channel`);
    return;
  }

  const messages = await channel.messages.fetch({ limit: 10 });

  const existingMessage = messages.find(
    (m) =>
      m.components.length > 0 &&
      m.components[0]?.type === ComponentType.Container,
  );

  const em = orm.em.fork();

  const allTrades = await em.find(TradeSchema, {});

  const activeTrades = allTrades
    .filter((t) => t.status === "active")
    .sort((a, b) => String(a.asset).localeCompare(String(b.asset))) as Trade[];

  const pendingTrades = allTrades
    .filter((t) => t.status === "pending")
    .sort((a, b) => String(a.asset).localeCompare(String(b.asset))) as Trade[];

  const getPrice = (asset: string) =>
    Number(binance.coinPrices.get(asset) || 0);

  const computeProfit = (trade: Trade, price: number) => {
    const factor = trade.direction === "long" ? -1 : 1;
    const entry = trade.enteredPrice ?? trade.entry;

    return (
      (entry - price) * factor * trade.leverage * (trade.margin / trade.entry)
    );
  };

  const cumulative = activeTrades.reduce<[number, number]>(
    (acc, trade) => {
      const price = getPrice(trade.asset || "");
      const profit = computeProfit(trade, price);

      acc[0] += profit;
      acc[1] += trade.margin;

      return acc;
    },
    [0, 0],
  );

  const activeRows = activeTrades.map((trade) => {
    const price = getPrice(trade.asset || "");
    const profit = computeProfit(trade, price);
    const pnl = (profit / (trade.margin || 1)) * 100;

    const factor = trade.direction === "long" ? -1 : 1;

    return [
      `${trade.leverage.toFixed(1)}x`.padStart(5).magenta,
      colorize(`[${trade.direction.toUpperCase()}]`.padEnd(7), trade.direction),
      trade.asset.padStart(8),
      formatPrice(price).padStart(8),
      formatPrice(trade.entry).padStart(8),
      `${colorize(profit.toFixed(4).padStart(8), factor)}` +
        ` (`.black +
        `${colorize(
          ((pnl > 0 ? "+" : "") + pnl.toFixed(2)).padStart(6),
          factor,
        )}` +
        `%)`.black,
    ].join(" ");
  });

  const pendingRows = pendingTrades.map((trade) => {
    const price = getPrice(trade.asset || "");
    return [
      `${trade.leverage.toFixed(1)}x`.padStart(5).magenta,
      colorize(`[${trade.direction.toUpperCase()}]`.padEnd(7), trade.direction),
      trade.asset.padStart(8),
      formatPrice(price).padStart(10),
      formatPrice(trade.entry).padStart(10),
      formatPrice(trade.stop_loss).padStart(10),
      //formatPrice(trade.take_profit || 0).padStart(10),
    ].join(" ");
  });

  const activeHeaders = [
    `Lev`.padEnd(5),
    `Type`.padEnd(7),
    `Asset`.padStart(8),
    `M.Price`.padStart(8),
    `Entry`.padStart(8),
    `PnL`.padStart(10).padEnd(17),
  ].join(" ");

  const pendingHeaders = [
    `Lev`.padEnd(5),
    `Type`.padEnd(7),
    `Asset`.padStart(8),
    `M.Price`.padStart(10),
    `Entry`.padStart(10),
    `SL`.padStart(10),
    //`TP`.padStart(10),
  ].join(" ");

  const portfolio = await trader.getPortfolio();

  const todayPnL = portfolio.pnlHistory
    .filter((p) => p.date >= new Date(Date.now() - 86_400_000))
    .reduce((sum, p) => sum + p.pnl, 0);

  const totalProfit = cumulative[0];
  const totalMargin = cumulative[1];
  const prefix = totalProfit >= 0 ? "+" : "";

  const totalLine =
    padAnsiEnd(
      `Port: $${(portfolio.balance + totalMargin).toFixed(2)}`.cyan +
        ` (${colorize(
          `${todayPnL + totalProfit >= 0 ? "+" : "-"}$${Math.abs(
            todayPnL + totalProfit,
          ).toFixed(2)}`,
          todayPnL + totalProfit >= 0,
        )})`,
      30,
    ) +
    padAnsiStart(
      colorize(prefix + formatPrice(totalProfit), totalProfit >= 0) +
        ` USDT`.gray +
        ` ` +
        colorize(
          `(${prefix}${((totalProfit / (totalMargin || 1)) * 100).toFixed(
            2,
          )}%)`,
          totalProfit >= 0,
        ),
      30,
    );

  const pendingContainer = new ContainerBuilder()
    .addTextDisplayComponents((c) =>
      c.setContent(`### Limit Orders - <t:${Math.floor(Date.now() / 1000)}:R>`),
    )
    .setAccentColor(0x2f3136)
    .addSeparatorComponents((s) => s)
    .addTextDisplayComponents((c) =>
      c.setContent(codeBlock("ansi", pendingHeaders)),
    )
    .addSeparatorComponents((s) => s)
    .addTextDisplayComponents((c) =>
      c.setContent(
        pendingRows.length > 0
          ? codeBlock("ansi", pendingRows.join("\n"))
          : "- No pending orders",
      ),
    );

  const activeContainer = new ContainerBuilder()
    .addTextDisplayComponents((c) =>
      c.setContent(
        `### Open Positions - <t:${Math.floor(Date.now() / 1000)}:R>`,
      ),
    )
    .setAccentColor(0x2f3136)
    .addSeparatorComponents((s) => s)
    .addTextDisplayComponents((c) =>
      c.setContent(codeBlock("ansi", activeHeaders)),
    )
    .addSeparatorComponents((s) => s)
    .addTextDisplayComponents((c) =>
      c.setContent(
        activeRows.length > 0
          ? codeBlock("ansi", activeRows.join("\n"))
          : "- No open positions",
      ),
    )
    .addSeparatorComponents((s) => s)
    .addTextDisplayComponents((c) =>
      c.setContent(codeBlock("ansi", totalLine)),
    );

  const components = [pendingContainer, activeContainer];

  if (existingMessage?.editable) {
    await existingMessage.edit({
      components,
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`✓ Live trade message updated with id ${existingMessage.id}`);
  } else {
    //@ts-ignore
    const sent = await channel.send({
      components,
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`✓ Live trade message sent with id ${sent.id}`);
  }

  await sleep(10_000);
  listenLive();
}

function colorize(text: string, value: "long" | "short" | 1 | -1 | boolean) {
  if (value === 1 || value === "long" || value === true) return text.green;
  if (value === -1 || value === "short" || value === false) return text.red;
  return text.gray;
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function stripAnsi(value: string) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function padAnsiEnd(text: string, target: number, pad = " ") {
  const len = stripAnsi(text).length;
  return len >= target ? text : text + pad.repeat(target - len);
}

function padAnsiStart(text: string, target: number, pad = " ") {
  const len = stripAnsi(text).length;
  return len >= target ? text : pad.repeat(target - len) + text;
}
