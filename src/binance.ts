import {
  DerivativesTradingUsdsFutures,
  DerivativesTradingUsdsFuturesRestAPI,
} from "@binance/derivatives-trading-usds-futures";
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
export type KlineData = {
  openTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: Date;
  pairVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
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
  private wsConnectionPromise: Promise<
    Awaited<
      ReturnType<DerivativesTradingUsdsFutures["websocketStreams"]["connect"]>
    >
  > | null = null;

  private activeStreams: Set<string> = new Set();
  private streamHandles = new Map<string, { unsubscribe: () => void }>();
  coinPrices: Map<string, number> = new Map();
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
    console.log(`Subscribing to ${coin}`);
    const symbol = coin.toLowerCase();

    if (!this.wsConnection) {
      this.wsConnectionPromise ??= this.client.websocketStreams
        .connect()
        .then((connection) => {
          this.wsConnection = connection;
          this.wsConnectionPromise = null;
          return connection;
        });

      this.wsConnection = await this.wsConnectionPromise;
    }

    if (this.activeStreams.has(symbol) || this.streamHandles.has(symbol))
      return;

    this.activeStreams.add(symbol);

    const stream = this.wsConnection.individualSymbolTickerStreams({ symbol });
    this.streamHandles.set(symbol, stream);

    stream.on("message", (data: unknown) => {
      const ticker = data as TickerStreamMessage;

      this.emit("price", {
        symbol: ticker.s,
        price: Number(ticker.c),
        high: Number(ticker.h),
        low: Number(ticker.l),
        change: Number(ticker.P),
      });
      this.coinPrices.set(ticker.s, Number(ticker.c));
    });
  }

  public unsubscribe(coin: string) {
    console.log(`Unsubscribing from ${coin}`);
    const symbol = coin.toLowerCase();

    if (!this.activeStreams.has(symbol)) return;

    const stream = this.streamHandles.get(symbol);
    if (stream) {
      stream.unsubscribe();
      this.streamHandles.delete(symbol);
    }
    this.activeStreams.delete(symbol);

    if (this.activeStreams.size === 0) {
      void this.wsConnection?.disconnect().finally(() => {
        this.wsConnection = null;
        this.wsConnectionPromise = null;
      });
    }
  }
  async getPriceHistory(
    symbol: string,
    interval: DerivativesTradingUsdsFuturesRestAPI.KlineCandlestickDataIntervalEnum,
    limit: number,
  ) {
    return (
      await (
        await this.client.restAPI.klineCandlestickData({
          symbol,
          interval,
          limit,
        })
      ).data()
    ).map(this.parseKlineData);
  }
  private parseKlineData(data: (string | number)[]) {
    const object: KlineData = {
      openTime: new Date(data[0] as number),
      open: Number(data[1]),
      high: Number(data[2]),
      low: Number(data[3]),
      close: Number(data[4]),
      volume: Number(data[5]),
      closeTime: new Date(data[6] as number),
      pairVolume: Number(data[7]),
      numberOfTrades: data[8] as number,
      takerBuyBaseAssetVolume: Number(data[9]),
      takerBuyQuoteAssetVolume: Number(data[10]),
    };
    return object;
  }
  public async searchCoin(keyword: string) {
    if (keyword.toLowerCase().includes("gold")) return ["XAUUSDT"];
    else if (keyword.toLowerCase().includes("silver")) return ["XAGUSDT"];
    else if (keyword.toLowerCase().includes("oil")) return ["CLUSDT"];
    else if (
      keyword.toLowerCase().includes("bitcoin") ||
      keyword.toLowerCase().includes("btc")
    )
      return ["BTCUSDT"];
    else if (
      keyword.toLowerCase().includes("ethereum") ||
      keyword.toLowerCase().includes("eth")
    )
      return ["ETHUSDT"];
    const allCoins = await this.listCoins();
    const symbols = allCoins.map((c) => c.symbol || "").filter(Boolean);

    const query = keyword.toUpperCase().trim();

    const normalize = (q: string) => q.replace(/USDT$/, "").replace(/USD$/, "");

    const tryMatch = (q: string) => {
      const norm = normalize(q);

      return symbols.filter((symbol) => {
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
        matched.set(coin || "", coin);
      }
    }

    return Array.from(matched.values()); //.map((c) => c.symbol);
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
export const Interval =
  DerivativesTradingUsdsFuturesRestAPI.KlineCandlestickDataIntervalEnum;
export type Interval =
  DerivativesTradingUsdsFuturesRestAPI.KlineCandlestickDataIntervalEnum;
//run();
binance
  .getPriceHistory("LTCUSDT", Interval.INTERVAL_5m, 10)
  .then(console.log)
  .catch(console.error);
