import { OpenRouter } from "@openrouter/sdk";
import type { parseChartData } from "./chartParser";
import { Constants } from "discord.js-selfbot-v13";
import { config } from "../config";
import type { CompactMsg } from "./discord";

const openRouter = new OpenRouter({
  apiKey: config.OPENROUTER_API_KEY,
});

type PromptData = {
  processedData: ReturnType<typeof parseChartData>;
  rawData: {
    texts: string[];
    boxes: number[][];
  };
};
export type TradeType = "long" | "short" | null;

export interface TradeAnalysis {
  has_trade: boolean;
  action: "pending" | "missed" | "active" | null;
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
}
export async function processChart(imageURL: string, data: PromptData) {
  const stringifiedData = JSON.stringify({
    imageURL,
    data: data,
  });
  const PROMPT = `Analyze the image and determine if a trading setup is present.

**CRITICAL REQUIREMENT:** A trade setup is ONLY defined by the presence of a TradingView Long or Short Position Tool (composed of two adjacent colored boxes, typically red and green or gray and orange). 

* **If NO position tool boxes are present:** * Set "has_trade": false. 
    * Return null for all price/action fields.
    * In "insights", state: "No standard Long/Short position tool detected on the chart."
    * **Do not** treat horizontal lines, arrows, or labels as a trade setup.

Focus specifically on detecting these position tools, price levels, and trade intent. Ignore generic chart descriptions unless necessary.

Return ONLY valid JSON. No explanations, no extra text.

Schema:
{
"has_trade": boolean,
"action": "pending" | "missed" | "active" | null,
"type": "long" | "short" | null,
"entry": number | null,
"stop_loss": number | null,
"take_profit": number | null,
"confidence": number,
"current_price": number | null,
"order_type": "limit" | "market" | null,
"timeframe": string | null,
"asset": string | null,
"insights": string[],
"warnings": string[]
}

Rules:
* "action" Logic:
  * "pending": The most recent (rightmost) candle is located to the left of the position tool's starting vertical edge, or has not yet touched the entry price line.
  * "pending": Also if few candles have touched the box.
  * "active": The most recent (rightmost) candle is horizontally aligned with the position tool and its price (wick or body) is currently inside either the green/red or gray/orange boxes.
  * "missed": The most recent (rightmost) candle is located entirely to the right of the position tool's shaded area without having been filled, OR the price has hit the TP/SL target area while the current candle is already past the tool's horizontal duration.
* "type" Logic:
  * If the RED (or SMALLER/DARKER) box is ABOVE the GREEN (or LARGER/LIGHTER) box, it is a SHORT.
  * If the GREEN (or LARGER/LIGHTER) box is ABOVE the RED (or SMALLER/DARKER) box, it is a LONG.
* "entry" is the price level where the two boxes are separated by color.
* "stop_loss" is the price level of the box furthest from the current price (top box for shorts, bottom box for longs).
* "take_profit" is the price level of the box closest to the current price (bottom box for shorts, top box for longs).
* Extract prices only if they are explicitly linked to the edges of the position tool. Otherwise return null.
* "asset" must be returned in Binance API/Standard format (e.g., BTCUSDT, XAUUSD). Remove slashes or spaces.
* "order_type" market if entry level touches current price and last candle touches box border, otherwise limit.
* "confidence" is between 0 and 1 based on clarity of the setup.
* "insights" should describe trade logic (e.g., "Price trading in profit zone," "Entry zone not yet reached").
* "warnings" should include uncertainty or missing data.
* Do NOT hallucinate price movement that has not happened.

Return JSON only.
`;
  const result = await openRouter.chat.send({
    chatRequest: {
      model: "qwen/qwen2.5-vl-72b-instruct",
      temperature: 0.1,
      maxTokens: 1000, // <--- ADD THIS LINE
      messages: [
        {
          role: "system",
          content: PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: stringifiedData,
            },
            {
              type: "image_url",
              imageUrl: { url: imageURL },
            },
          ],
        },
      ],
    },
  });
  //console.log(result.choices);
  try {
    return safeJSONParse(result.choices[0]?.message.content) as TradeAnalysis;
  } catch (error) {
    console.log(
      `✗ Error processing chart: ${error}`,
      result.choices[0]?.message.content,
    );
    return `No inference.`;
  }
}

function extractJSON(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1] as string | null;
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

function safeJSONParse(text: string) {
  const extracted = extractJSON(text);

  if (!extracted) {
    throw new Error("No JSON found in response");
  }

  try {
    return JSON.parse(extracted);
  } catch (err) {
    throw new Error("Invalid JSON format");
  }
}

export async function processMessage(msg: CompactMsg[]) {
  const mainMessage = msg[msg.length - 1] as CompactMsg;
  const references = msg.slice(0, -1);

  // Only build the context string if references actually exist
  const contextBlock =
    references.length > 0
      ? `\n[CONTEXT / REPLIES]\n${references.map((m) => `User_${m.user}: ${JSON.stringify(m)}`).join("\n")}`
      : "";
  const { attachments: mainChart, ...mainMsg } = mainMessage;
  const AGGREGATOR_PROMPT = `
    TASK: Aggregate trade data into a single verified JSON object.
    ${contextBlock}

    [PRIMARY MESSAGE]
    User_${mainMsg.user}: "${JSON.stringify(mainMsg)}"
    
    [CHART EXTRACTION DATA]
    ${mainChart ? JSON.stringify(mainChart) : "No chart data available."}

    RULES:
    1. BASE DATA: Start with the [CHART EXTRACTION DATA] as the structural foundation.
    2. OVERRIDE/PRIORITIZATION: If the [PRIMARY MESSAGE CONTENT] provides specific values (e.g., a specific Entry, SL, or TP), PRIORITIZE and use the message data over the chart data.
    3. FALLBACK: Only use [REFERENCE/REPLY HISTORY] if data is missing from both the chart and the primary message, or if a reference explicitly "changes" or "updates" a level mentioned previously.
    4. SANE DEFAULTS: 
       - "type": If Take Profit < Entry, it's a "short". If Take Profit > Entry, it's a "long". (Message overrides this if explicit).
       - "order_type": Default to "market" unless "limit" is mentioned in text.

    RULES FOR INTERPRETING THE TRADE SETUP:
    * "action" is "pending" if candle has not touched the box. "active" if last candle is inside the box. "missed" if last candle is outside, to right of the box.
    * "@ m" represents market entry, and action is "pending".
    * "asset" ticker for the asset, standard format.

    SCHEMA:
      {
        "has_trade": boolean,
        "action": "pending" | "missed" | "active" | null,
        "type": "long" | "short" | null,
        "entry": number | null,
        "stop_loss": number | null,
        "take_profit": number | null,
        "confidence": number,
        "current_price": number | null,
        "order_type": "limit" | "market" | null,
        "timeframe": string | null,
        "asset": string | null,
        "insights": string[],
        "warnings": string[]
      }

    Return ONLY valid JSON.
  `;

  const response = await openRouter.chat.send({
    chatRequest: {
      model: "qwen/qwen3-vl-32b-instruct",
      messages: [
        {
          role: "system",
          content:
            "You are a senior trade data aggregator. Response must be JSON only.",
        },
        { role: "user", content: AGGREGATOR_PROMPT },
      ],
      temperature: 0.1,
      //maxTokens: 6000
    },
  });

  return safeJSONParse(
    response.choices[0]?.message.content || "{}",
  ) as TradeAnalysis;
}
