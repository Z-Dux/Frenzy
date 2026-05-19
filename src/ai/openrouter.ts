import { OpenRouter } from "@openrouter/sdk";
import type { parseChartData } from "@analysis/chartParser";
import { config } from "@config/app";
import type { CompactMsg } from "@discord/index";

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

type ChartCheckResult = {
	isStockChart: boolean;
	confidence: number;
	reason: string;
};


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
  const PROMPT = `Analyze the image and detect a TradingView Long/Short Position Tool (two adjacent colored boxes).

If NONE found:
{
  "has_trade": false,
  "action": null,
  "type": null,
  "entry": null,
  "stop_loss": null,
  "take_profit": null,
  "confidence": 0,
  "current_price": null,
  "order_type": null,
  "timeframe": null,
  "asset": null,
  "setup": "NO_SETUP",
  "insights": ["No standard Long/Short position tool detected on the chart."],
  "warnings": []
}

---

If found, return JSON:

{
  "has_trade": true,
  "action": "pending" | "active" | "missed",
  "setup": "PENDING_SETUP" | "ACTIVE_ENTRY" | "MISSED_TRADE" | "MISSED_BUT_ACTIVE" | "INVALIDATED_SETUP",
  "type": "long" | "short",
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

---

RULES:

Detection:
- ONLY consider TradingView position tool boxes.
- Ignore lines, arrows, labels.

Type:
- Red above green → SHORT
- Green above red → LONG

Levels:
- Entry = boundary between boxes
- Stop_loss = farthest box edge from current price
- Take_profit = closest box edge to current price

Action:
- pending → price not reached entry OR candles not inside box
- active → current candle inside box
- missed → price moved past tool (right side) OR TP/SL hit after zone expired

Setup Mapping:
- pending → PENDING_SETUP
- active → ACTIVE_ENTRY
- missed:
    - if SL/structure invalidated → INVALIDATED_SETUP
    - if price moved without entry → MISSED_TRADE
    - if still valid (no SL hit) → MISSED_BUT_ACTIVE

Order Type:
- market → entry ≈ current price AND candle touching box
- else limit

Other:
- Extract prices ONLY from tool edges
- Asset format: BTCUSDT (no slashes)
- Confidence: 0–1
- No hallucination
- Strictly distinguish candles vs drawings

Return ONLY JSON.`;
  const result = await openRouter.chat.send({
    chatRequest: {
      model: "qwen/qwen2.5-vl-72b-instruct",
      temperature: 0.3,
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

function safeJSONParse<T>(text: string): T {
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
    * STRICTLY keep "action" as pending if no candles are touching the box, even if price has technically moved past the entry level.
    * "@ m" represents market entry, and action is "pending".
    * "asset" ticker for the asset, standard format.
    * "confidence" is between 0 and 1 defining how certain it is a trade setup.
    * "order_type" is "limit" if entry price is mentioned.
    

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
      temperature: 0.3,
      //maxTokens: 6000
    },
  });

  return safeJSONParse(
    response.choices[0]?.message.content || "{}",
  ) as TradeAnalysis;
}


export async function isStockChartImage(imageUrl: string) {
	const prompt = `You are an image classifier.
Decide if the image is a STOCK MARKET CHART/GRAPH (candlesticks/line chart with price-time axes or trading chart UI).

Return ONLY JSON with this exact schema:
{
	"isStockChart": boolean,
	"confidence": number,
}

Rules:
- confidence must be from 0 to 1.
- STRICTLY must identify price or time axes and candles!
- If uncertain, set isStockChart=false.
- No markdown, no extra text.`;

	const response = await openRouter.chat.send({
		chatRequest: {
			model: "qwen/qwen3.5-flash-02-23",
			temperature: 0.1,
			messages: [
				{ role: "system", content: prompt },
				{
					role: "user",
					content: [
						{ type: "image_url", imageUrl: { url: imageUrl } },
					],
				},
			],
		},
	});

	const raw = response.choices[0]?.message.content || "";
	return safeJSONParse<ChartCheckResult>(raw);
}


export async function getCreditsUsage() {
  const credits = await openRouter.credits.getCredits()
  console.log(credits.data);
}

getCreditsUsage()
