import { DerivativesTradingUsdsFutures } from "@binance/derivatives-trading-usds-futures";
import EventEmitter from "events";

type TickerStreamMessage = {
  e: "24hrTicker";
  E: number;
  s: string;
  p: string;
  P: string;
  w: string;
  c: string;
  Q: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
  O: number;
  C: number;
  F: number;
  L: number;
  n: number;
  ps: string;
};

interface BinanceEvents {
  price: (newPrice: {
    symbol: string;
    price: number;
    high: number;
    low: number;
    change: number;
  }) => void;
  nameChange: (newName: string) => void;
}

export class Binance extends EventEmitter {
  private client: DerivativesTradingUsdsFutures;
  private wsConnection: Awaited<
    ReturnType<DerivativesTradingUsdsFutures["websocketStreams"]["connect"]>
  > | null = null;

  private activeStreams: Set<string> = new Set();

  override on<K extends keyof BinanceEvents>(
    event: K,
    listener: BinanceEvents[K],
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof BinanceEvents>(
    event: K,
    ...args: Parameters<BinanceEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  constructor() {
    super();

    this.client = new DerivativesTradingUsdsFutures({
      configurationWebsocketStreams: {},
      configurationRestAPI: {
        apiKey: "",
        apiSecret: "",
      },
    });
  }

  public async subscribe(coin: string) {
    const symbol = coin.toLowerCase();

    if (!this.wsConnection) {
      this.wsConnection = await this.client.websocketStreams.connect();
    }

    if (this.activeStreams.has(symbol)) return;

    this.activeStreams.add(symbol);

    const stream = this.wsConnection.individualSymbolTickerStreams({ symbol });

    stream.on("message", (data: unknown) => {
      const ticker = data as TickerStreamMessage;

      this.emit("price", {
        symbol: ticker.s,
        price: Number(ticker.c),
        high: Number(ticker.h),
        low: Number(ticker.l),
        change: Number(ticker.P),
      });
    });
  }

  public unsubscribe(coin: string) {
    const symbol = coin.toLowerCase();

    if (!this.wsConnection || !this.activeStreams.has(symbol)) return;

    this.wsConnection.unsubscribe([`${symbol}@ticker`]);
    this.activeStreams.delete(symbol);
  }

  public async searchCoin(keyword: string) {
    if (keyword.toLowerCase().includes("gold")) return "XAUUSDT";
    else if (keyword.toLowerCase().includes("silver")) return "XAGUSDT";
    else if (keyword.toLowerCase().includes("oil")) return "CLUSDT";
    else if (
      keyword.toLowerCase().includes("bitcoin") ||
      keyword.toLowerCase().includes("btc")
    )
      return "BTCUSDT";
    else if (
      keyword.toLowerCase().includes("ethereum") ||
      keyword.toLowerCase().includes("eth")
    )
      return "ETHUSDT";
    const allCoins = await this.listCoins();
    const symbols = allCoins.map((c) => c.symbol);

    const query = keyword.toUpperCase().trim();

    const normalize = (q: string) => q.replace(/USDT$/, "").replace(/USD$/, "");

    const tryMatch = (q: string) => {
      const norm = normalize(q);

      return allCoins.filter((c) => {
        const symbol = c?.symbol ?? "";
        return symbol.includes(q) || symbol.includes(norm);
      });
    };

    let results = tryMatch(query);
    if (results.length > 0) return results;

    const tokens = query.split(/[^A-Z0-9]+/).filter(Boolean);

    const matched = new Map<string, any>();

    for (const token of tokens) {
      const res = tryMatch(token);

      for (const coin of res) {
        matched.set(coin.symbol || "", coin);
      }
    }

    return Array.from(matched.values()).map((c) => c.symbol);
  }

  public async listCoins() {
    const response = await this.client.restAPI.exchangeInformation();
    const data = await response.data();
    if (!data?.symbols) return [];

    return data.symbols;
  }
  public async getPrice(symbol: string) {
    const response = await this.client.restAPI.markPrice({ symbol });
    const data = await response.data();
    //@ts-ignore
    return Number(data.markPrice);
  }
}

export const binance = new Binance();

binance.on("price", (update) => {
  console.log(
    `[COIN-M] ${update.symbol} -> $${update.price} (${update.change}%)`,
  );
});

async function run() {
  const results = await binance.searchCoin("BTC");
  const results2 = await binance.searchCoin("ETH");

  console.log("Found:", results, results2);

  const first = results[0];
  if (first) {
    await binance.subscribe(first);
  }
}

//run();
