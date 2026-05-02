import { binance, Interval, type KlineData } from "./binance";
import {
  BollingerBands,
  BollingerBandsWidth,
  EMA,
  MACD,
  MOM,
  RSI,
  SMA,
  StochasticOscillator,
} from "trading-signals";

type PriceData = {
  symbol: string;
  timeframe: Interval;
  price: KlineData[];
  indicators: Indicators;
};
type Indicators = {
  rsi: RSI;
  momentum: MOM;
  macd: MACD;
  sma20: SMA;
  sma50: SMA;
  ema: EMA;
  stochasticOscillator: StochasticOscillator;
  bollingerBands: BollingerBands;
  bollingerBandsWidth: BollingerBandsWidth;
};
let last = new Date();
export class MarketEngine {
  coin: string;
  binance = binance;
  priceHistory: KlineData[] = [];
  indicators: Indicators = {
    rsi: new RSI(14),
    momentum: new MOM(14),

    macd: new MACD(new EMA(12), new EMA(26), new EMA(9)),
    sma20: new SMA(20),
    sma50: new SMA(50),
    ema: new EMA(20),
    stochasticOscillator: new StochasticOscillator(14, 3, 3),
    bollingerBands: new BollingerBands(20, 2),
    bollingerBandsWidth: new BollingerBandsWidth(new BollingerBands(20, 2)),
  };
  constructor(coin: string) {
    this.indicators.bollingerBandsWidth = new BollingerBandsWidth(
      this.indicators.bollingerBands,
    );
    this.coin = coin;
  }
  async start() {
    const history = await this.binance.getPriceHistory(
      this.coin,
      Interval.INTERVAL_1m,
      1000,
    );
    console.log("Initial price history loaded:", history.length, "candles");
    history.filter(Boolean).forEach(this.priceUpdate.bind(this));

    this.priceHistory = history;
    this.binance.on("kline", (data) => {
      if (data.interval == Interval.INTERVAL_1m) this.priceUpdate(data.kline);
    });
    this.binance.subscribeKline("BTCUSDT", Interval.INTERVAL_1m);
  }
  priceUpdate(price: KlineData) {
    console.log(
      this.priceHistory.length,
      "candles in history. New price:",
      price,
    );
    if (price.isClosed || this.priceHistory.length === 0)
      this.priceHistory.push(price);
    else {
      let last = this.priceHistory[this.priceHistory.length - 1];
      if (last && last.isClosed) {
        this.priceHistory.push(price);
      } else {
        this.priceHistory[this.priceHistory.length - 1] = price;
      }
    }
    this.updateIndicators(price);
  }
  updateIndicators(price: KlineData) {
    const { close, high, low, isClosed } = price;
    const stochData = { high, low, close };

    Object.keys(this.indicators).forEach((key) => {
      const indicator = this.indicators[key as keyof Indicators];
      const data = key === "stochasticOscillator" ? stochData : close;

      indicator.replace(data as never);
      if (isClosed) {
        indicator.add(data as never);
      }
    });
    this.displayIndicatorResults();
  }
  async displayIndicatorResults() {
    const rsi = this.indicators.rsi.getResult();
    const momentum = this.indicators.momentum.getResult();
    const macd = this.indicators.macd.getResult();
    const sma20 = this.indicators.sma20.getResult();
    const sma50 = this.indicators.sma50.getResult();
    const ema = this.indicators.ema.getResult();
    const stoch = this.indicators.stochasticOscillator.getResult();
    const bb = this.indicators.bollingerBands.getResult();
    const bbWidth = this.indicators.bollingerBandsWidth.getResult();
    /*console.log("RSI:", rsi);
    console.log("Momentum:", momentum);
    console.log("MACD:", macd);
    console.log("SMA20:", sma20);
    console.log("SMA50:", sma50);
    console.log("EMA:", ema);
    console.log("Stochastic Oscillator:", stoch);
    console.log("Bollinger Bands:", bb);
    console.log("Bollinger Bands Width:", bbWidth);*/
    console.log("------");

    const chartData = this.priceHistory.map((p) => ({
      time: p.openTime.getTime() / 1000,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${this.coin} Chart Export</title>
    <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
    <style>
        body { background: #131722; color: white; font-family: sans-serif; margin: 0; }
        #chart { width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        const chart = LightweightCharts.createChart(document.getElementById('chart'), {
            layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
        });
        const candleSeries = chart.addCandlestickSeries();
        const data = ${JSON.stringify(chartData)};
        candleSeries.setData(data);
        chart.timeScale().fitContent();
    </script>
</body>
</html>`;
    if (Math.abs(last.getTime() - new Date().getTime()) > 10000) {
      // Limit exports to once every 10 seconds
      last = new Date();

      await Bun.write("chart_export.html", htmlContent);
      console.log("📈 Chart saved to chart_export.html");
    }
  }
}
const engine = new MarketEngine("BTCUSDT");
engine.start();
