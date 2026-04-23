import { OpenRouter } from "@openrouter/sdk";
import { config } from "./config";

const openRouter = new OpenRouter({
	apiKey: config.OPENROUTER_API_KEY,
});

type ChartCheckResult = {
	isStockChart: boolean;
	confidence: number;
};

function extractJSON(text: string): string | null {
	const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (codeBlockMatch) return codeBlockMatch[1] || null;

	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (jsonMatch) return jsonMatch[0];

	return null;
}

function safeParseResult(text: string): ChartCheckResult {
	const fallback: ChartCheckResult = {
		isStockChart: false,
		confidence: 0,
	};

	const extracted = extractJSON(text);
	if (!extracted) return fallback;

	try {
		const parsed = JSON.parse(extracted) as Partial<ChartCheckResult>;
		return {
			isStockChart: Boolean(parsed.isStockChart),
			confidence:
				typeof parsed.confidence === "number"
					? Math.max(0, Math.min(1, parsed.confidence))
					: 0,
		};
	} catch {
		return fallback;
	}
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
	return safeParseResult(raw);
}

// Example run:
async function main() {
	const imageUrl = `https://cdn.discordapp.com/attachments/1249330346126872647/1496559067488063689/IMG_0947.png?ex=69ea52be&is=69e9013e&hm=36665ce3a0496e0b1330a095faa0f4faa1db93f42a448248bb7cb8c1d75ff19c`
	if (!imageUrl) {
		console.error("Usage: bun run test.ts <image-url>");
		process.exit(1);
	}

	const result = await isStockChartImage(imageUrl);
	console.log(result);
}

main().catch((err) => {
	console.error("Error checking chart image:", err);
	process.exit(1);
});
