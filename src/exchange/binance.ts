import {
  DerivativesTradingUsdsFutures,
  DerivativesTradingUsdsFuturesRestAPI,
} from "@binance/derivatives-trading-usds-futures";
import EventEmitter from "events";
import { dateToRelative } from "@shared/utils";

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
type KlineStreamMessage = {
  e: "kline";
  E: number;
  s: string;
  k: {
    t: number; // open time
    T: number; // close time
    s: string;
    i: string; // interval
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean; // is closed
    q: string;
    V: string;
    Q: string;
  };
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
  isClosed: boolean;
};
export type KlineDataStream = {
  symbol: string;
  interval: string;
  kline: KlineData;
};

interface BinanceEvents {
  price: (newPrice: {
    symbol: string;
    price: number;
    high: number;
    low: number;
    change: number;
  }) => void;
  kline: (data: KlineDataStream) => void;
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

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.on("price", (update) => {
      console.log(
        `[COIN-M] ${update.symbol} -> $${update.price} (${update.change}%)`,
      );
    });
  }

  private async ensureConnection() {
    if (!this.wsConnection) {
      this.wsConnectionPromise ??= this.client.websocketStreams
        .connect()
        .then((connection) => {
          this.wsConnection = connection;
          this.wsConnectionPromise = null;
          return connection;
        })
        .catch((err) => {
          console.error("Failed to connect to WebSocket:", err);
          this.wsConnectionPromise = null;
          throw err;
        });

      this.wsConnection = await this.wsConnectionPromise;
    }

    return this.wsConnection;
  }

  public async subscribe(coin: string) {
    try {
      const resolvedCoin = (await this.searchCoin(coin))[0] || coin;
      const symbol = resolvedCoin.toLowerCase();
      
      if (this.activeStreams.has(symbol)) {
        return;
      }

      console.log(`Subscribing to ${resolvedCoin}`);

      const connection = await this.ensureConnection();
      this.activeStreams.add(symbol);

      const stream = connection.individualSymbolTickerStreams({ symbol });
      this.streamHandles.set(symbol, stream);

      stream.on("message", (data: unknown) => {
        const ticker = data as TickerStreamMessage;
        this.coinPrices.set(ticker.s, Number(ticker.c));

        this.emit("price", {
          symbol: ticker.s,
          price: Number(ticker.c),
          high: Number(ticker.h),
          low: Number(ticker.l),
          change: Number(ticker.P),
        });
      });
    } catch (err) {
      console.error(`Failed to subscribe to ${coin}:`, err);
    }
  }

  public async subscribeKline(
    coin: string,
    interval: DerivativesTradingUsdsFuturesRestAPI.KlineCandlestickDataIntervalEnum,
  ) {
    try {
      const symbol = coin.toLowerCase();
      const streamKey = `${symbol}_${interval}`;

      if (this.activeStreams.has(streamKey)) {
        return;
      }

      console.log(`Subscribing to kline for ${coin} at interval ${interval}`);

      const connection = await this.ensureConnection();
      this.activeStreams.add(streamKey);

      const stream = connection.klineCandlestickStreams({
        symbol,
        interval,
      });

      this.streamHandles.set(streamKey, stream);

      stream.on("message", (data: unknown) => {
        const msg = data as KlineStreamMessage;
        const k = msg.k;

        const parsed: KlineData = {
          openTime: new Date(k.t),
          open: Number(k.o),
          high: Number(k.h),
          low: Number(k.l),
          close: Number(k.c),
          volume: Number(k.v),
          closeTime: new Date(k.T),
          pairVolume: Number(k.q),
          numberOfTrades: k.n,
          takerBuyBaseAssetVolume: Number(k.V),
          takerBuyQuoteAssetVolume: Number(k.Q),
          isClosed: k.x,
        };

        this.emit("kline", {
          symbol: msg.s,
          interval: k.i,
          kline: parsed,
        });
      });
    } catch (err) {
      console.error(`Failed to subscribe kline for ${coin}:`, err);
    }
  }
  public unsubscribe(coin: string) {
    try {
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
    } catch (err) {
      console.error(`Failed to unsubscribe from ${coin}:`, err);
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
      isClosed: true,
    };
    return object;
  }
  public async searchCoin(keyword: string) {
    try {
      const lowerKeyword = keyword.toLowerCase();

      // Handle common aliases
      const aliases: Record<string, string> = {
        gold: "XAUUSDT",
        silver: "XAGUSDT",
        oil: "CLUSDT",
        bitcoin: "BTCUSDT",
        btc: "BTCUSDT",
        ethereum: "ETHUSDT",
        eth: "ETHUSDT",
      };

      if (aliases[lowerKeyword]) {
        return [aliases[lowerKeyword]];
      }

      const allCoins = await this.listCoins();
      const symbols = allCoins
        .map((c) => c.symbol || "")
        .filter(Boolean)
        .sort();

      const query = keyword.toUpperCase().trim();
      const normalize = (q: string) =>
        q.replace(/USDT$/, "").replace(/USD$/, "");

      // Exact match
      if (symbols.includes(query)) return [query];

      // Prefix match
      const prefixMatch = symbols.filter((s) => s.startsWith(query));
      if (prefixMatch.length > 0) return prefixMatch;

      // Contains match
      const containsMatch = symbols.filter((s) => s.includes(query));
      if (containsMatch.length > 0) return containsMatch;

      // Partial token match
      const tokens = query.split(/[^A-Z0-9]+/).filter(Boolean);
      const matched = new Set<string>();

      for (const token of tokens) {
        symbols.forEach((symbol) => {
          if (symbol.includes(token) || normalize(symbol).includes(token)) {
            matched.add(symbol);
          }
        });
      }

      return Array.from(matched);
    } catch (err) {
      console.error(`Failed to search coin ${keyword}:`, err);
      return [];
    }
  }

  public async listCoins() {
    try {
      const response = await this.client.restAPI.exchangeInformation();
      const data = await response.data();
      if (!data?.symbols) return [];
      return data.symbols;
    } catch (err) {
      console.error("Failed to list coins:", err);
      return [];
    }
  }

  public async getPrice(symbol: string) {
    try {
      const response = await this.client.restAPI.markPrice({ symbol });
      const data = await response.data();
      //@ts-ignore
      return Number(data.markPrice);
    } catch (err) {
      console.error(`Failed to get price for ${symbol}:`, err);
      return this.coinPrices.get(symbol.toUpperCase()) || 0;
    }
  }
}

export const binance = new Binance();
export type Interval =
  DerivativesTradingUsdsFuturesRestAPI.KlineCandlestickDataIntervalEnum;
