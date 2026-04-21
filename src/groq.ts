import Groq from "groq-sdk";
import { config } from "../config";
const groq = new Groq({ apiKey: config.GROQ_API_KEY});

export async function isTradingBased(content:string): Promise<boolean> {
    try {
        //console.log(`→ [Groq]: Checking if message is trade-related`);
        const response = await groq.chat.completions.create({
            model: `llama-3.1-8b-instant`,
            messages: [
                {
                    role: "system",
                    content: `You check if the given message content has any trading setups. Check if the content contains anything like stop loss (SL), take profit (TP), or other trading-related terms. Respond with a single word: "true" or "false". STRICTLY DO NOT provide any explanations.`,
                },
                {
                    role: "user",
                    content,
                },
            ],
            temperature: 0.05,
            max_tokens: 16,
        });
        const result = response.choices[0]?.message?.content?.trim().toLowerCase() === "true";
        //console.log(`✓ Groq API: Trading detection ${result ? 'positive' : 'negative'}`);
        return result;
    } catch (error: any) {
        if (error?.status === 429) {
            const retryAfter = error?.headers?.["retry-after"] || "unknown";
            console.log(`✗ [Groq]: Rate limit exceeded. Retry after ${retryAfter}s`);
        } else {
            console.log(`✗ [Groq]: Trading detection failed - ${error?.message || error}`);
        }
        return false;
    }
}