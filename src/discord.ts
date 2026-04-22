import { Client, Message } from "discord.js-selfbot-v13";
import { config } from "../config";
import { sleep } from "bun";
import { isTradingBased } from "./groq";
import { extractChart } from "./chartParser";
import { processMessage } from "./openrouter";
import { sendTrade } from "./discordBot/utils";
import { binance } from "./binance";
import { orm } from "./database";
import { TradeAnalysisSchema } from "./schema/tradeAnalysis";

export const client = new Client();

client.on("ready", async () => {
  console.log(`✓ Logged in as ${client.user?.tag}`);
  client.user?.setStatus(`dnd`);
});

client.on("messageCreate", async (message) => {
  1461803739013976138;
  if (message.author.bot || message.content.toLowerCase().split(" ")[0] == "fc")
    return;
  if (!(message.guildId && config.discordServers.includes(message.guildId)))
    return;
  if (!message.inGuild()) return;

  const isTradingRelated = await isTradingBased(message.content);

  const attachmentWithImaes = message.attachments.filter((att) =>
    att.contentType?.startsWith("image"),
  );
  if (!isTradingRelated && attachmentWithImaes.size === 0) return;
  console.log(`✓ Processing message: ${message.id} from ${message.author.tag}`);
  const scrapedContent = await scrapeMessages(message);

  console.log(
    `→ Scraped content:`,
    scrapedContent,
    scrapedContent.m[0]?.attachments,
  );
  const analysedTrade = await processMessage(scrapedContent.m);

  console.log(`→ Analysed trade from ${message.author.tag}:`, analysedTrade);

  analysedTrade.asset = analysedTrade.asset
    ? (await binance.searchCoin(analysedTrade.asset || ""))[0]?.symbol ||
      analysedTrade.asset
    : null;
  if(analysedTrade.confidence < 0.5) return;
  sendTrade(analysedTrade as any, message);
  if (
    !(
      analysedTrade.has_trade &&
      (analysedTrade.entry || analysedTrade.order_type == `market`) &&
      analysedTrade.stop_loss
    )
  )
    return;
  const em = orm.em.fork();
  const trade = em.create(TradeAnalysisSchema, analysedTrade);
  await em.flush();
  console.log(`✓ Trade analysis saved to database with id ${trade._id}`);
});

async function getMessage(msgId: string, channelId: string) {
  try {
    await client.channels.fetch(channelId);
    const channel = client.channels.cache.get(channelId);
    if (!channel?.isText()) return;
    const message = await channel.messages.fetch(msgId);
    return message;
  } catch (error) {
    console.log(`✗ Error fetching message: ${error}`, "error");
    return null;
  }
}

export type CompactMsg = {
  id: string; // id
  user: string; // user
  time: number; // timestamp
  content: string; // content
  attachments: Awaited<ReturnType<typeof extractChart>>[]; // attachments
  reference?: string; // reply_to
};

const USER_MAP = new Map<string, string>();
let uid = 0;

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function encodeBaseN(num: number): string {
  const base = CHARSET.length;
  let result = "";

  do {
    result = CHARSET[num % base] + result;
    num = Math.floor(num / base);
  } while (num > 0);

  return result;
}

function mapUser(userId: string): string {
  // ⚠️ use user.id instead of username (more stable)
  if (!USER_MAP.has(userId)) {
    USER_MAP.set(userId, encodeBaseN(uid++));
  }
  return USER_MAP.get(userId)!;
}

function normalize(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 300); // hard cap (important)
}
async function buildReplyChain(
  message: Message,
  maxDepth = 3,
): Promise<Message[]> {
  const chain: Message[] = [];
  const seen = new Set<string>();

  let current: Message | null = message;
  let depth = 0;

  while (current && depth < maxDepth) {
    if (seen.has(current.id)) break;

    chain.push(current);
    seen.add(current.id);

    if (!current.reference?.messageId) break;

    try {
      current = await current.channel.messages.fetch(
        current.reference.messageId,
      );
    } catch {
      break;
    }

    depth++;
  }

  return chain.reverse(); // oldest → newest
}

export async function scrapeMessages(message: Message) {
  const msgs = await buildReplyChain(message);

  const seen = new Set<string>();
  const result: CompactMsg[] = [];

  for (const msg of msgs) {
    if (seen.has(msg.id)) continue;
    seen.add(msg.id);

    if (!msg.content && msg.attachments.size === 0) continue;

    let content = normalize(msg.content || "");

    if (msg.attachments.size > 0) {
      content += " [img]";
    }
    console.log(`Extracting chart...`);
    result.push({
      id: msg.id.slice(-5),
      user: mapUser(msg.author.username),
      time: Math.floor(msg.createdTimestamp / 1000),
      content: content.trim(),
      attachments: await Promise.all(
        msg.attachments
          .map(async (attachment) => await extractChart(attachment.url))
          .filter(Boolean),
      ),
      reference: msg.reference?.messageId?.slice(-4),
    });
    console.log(
      `Extracted chart for message ${msg.id}, attachments: ${msg.attachments.size}`,
    );
  }

  result.sort((a, b) => a.time - b.time);

  return { m: result };
}

client.login(config.token);
