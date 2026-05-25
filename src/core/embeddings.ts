import { pipeline } from "@huggingface/transformers";

export type ClassificationResult = {
  isTradeSetup: boolean;
  signalScore: number;
  noiseScore: number;
  gap: number;
};

export class EmbeddingClassifier {
  private extractor: any = null;
  private anchorSignalVec: number[] = [];
  private anchorNoiseVec: number[] = [];
  private isInitialized = false;

  private readonly ANCHOR_SIGNAL =
    "classification: A specific technical trading setup, limit order, entry price, take profit target, stop loss level, or execution parameter for an asset.";
  private readonly ANCHOR_NOISE =
    "classification: Social media commentary, general market hype, questions about learning, news headlines, or casual chat without specific trade levels.";

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.extractor = await pipeline(
      "feature-extraction",
      "nomic-ai/nomic-embed-text-v1.5",
    );

    this.anchorSignalVec = await this.getEmbedding(this.ANCHOR_SIGNAL);
    this.anchorNoiseVec = await this.getEmbedding(this.ANCHOR_NOISE);

    this.isInitialized = true;
    console.log("🚀 Calibrated Production Engine Online");
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const output = await this.extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data as Float32Array).slice(0, 256);
  }

  private dotProduct(vecA: number[], vecB: number[]): number {
    let dot = 0;
    const len = vecA.length;
    for (let i = 0; i < len; i++) {
      //@ts-ignore
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }
  async classify(
    rawMessage: string,
    confidenceThreshold = 0.025,
  ): Promise<ClassificationResult> {
    if (!rawMessage || rawMessage.trim().length < 5) {
      return { isTradeSetup: false, signalScore: 0, noiseScore: 0, gap: 0 };
    }

    try {
      const prefixedText = `classification: ${rawMessage.trim()}`;
      const msgVec = await this.getEmbedding(prefixedText);

      const signalScore = this.dotProduct(msgVec, this.anchorSignalVec);
      const noiseScore = this.dotProduct(msgVec, this.anchorNoiseVec);
      const gap = signalScore - noiseScore;

      const isTradeSetup = gap >= confidenceThreshold;

      return { isTradeSetup, signalScore, noiseScore, gap };
    } catch (error) {
      return { isTradeSetup: false, signalScore: 0, noiseScore: 0, gap: 0 };
    }
  }
}

async function sim() {
  const classifier = new EmbeddingClassifier();
  await classifier.initialize();

  const mockStream = [
    "Entry long Sol at 142.50, target 155, stop 138",
    "Bro, Solana is pumping so hard right now wtf",
    "LIMIT BUY Order filled: 0.5 BTC @ 61200 USD",
    "I'm thinking about getting into trading, where should I start learning?",
    `i think you should long at 2000 and tp at 1200`,
  ];

  console.log("\n--- Processing Calibrated Live Stream ---");
  for (const message of mockStream) {
    const result = await classifier.classify(message);
    console.log(`\nMessage: "${message}"`);
    console.log(
      `➔ Actionable Trade Setup? [${result.isTradeSetup ? "YES" : "NO"}] (Gap: ${result.gap.toFixed(3)})`,
    );
  }
}

//sim();
