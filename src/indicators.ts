import { binance, type KlineData, type Interval } from "./binance";
import { BollingerBands, BollingerBandsWidth, EMA, MACD, MOM, RSI, SMA, StochasticOscillator } from 'trading-signals';

type PriceData = {
    symbol: string;
    timeframe: Interval;
    price: KlineData[];
    indicators: Indicators;
    
}
type Indicators = {
    rsi: RSI;
    momentum: MOM;
    macd: MACD;
    sma: SMA;
    ema: EMA;
    stochasticOscillator: StochasticOscillator;
    bollingerBands: BollingerBands;
    bollingerBandsWidth: BollingerBandsWidth;
}

export class MarketEngine {
    coin: string;
    binance = binance;
    priceHistory:KlineData[] = [];
    
    constructor(coin: string) {
        this.coin = coin;
    }
    

    
}