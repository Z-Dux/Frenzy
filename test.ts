import { binance } from "./src/binance";

console.log((await binance.getPrice("BTCUSDT")))