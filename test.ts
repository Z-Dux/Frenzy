import { writeFileSync } from "fs";

export type KlineData = {
  openTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: Date;
};
export interface KeyZone {
  min: number;
  max: number;
  mid: number;
  score: number; // Based on number of pivots in cluster
}

class Day0Analyzer {
  /**
   * Agglomerative Clustering Logic:
   * 1. Extract all fractal pivots (Highs and Lows).
   * 2. Group pivots that are within 'mergePercent' of each other.
   * 3. Calculate the median price for each cluster to define the level.
   */
  public static findLevels(data: KlineData[], mergePercent: number = 0.002): KeyZone[] {
    const pivots: number[] = [];

    // 1. Identify Raw Pivots (Fractals)
    for (let i = 5; i < data.length - 5; i++) {
      const high = data[i].high;
      const low = data[i].low;
      if (data.slice(i - 3, i + 3).every(k => high >= k.high)) pivots.push(high);
      if (data.slice(i - 3, i + 3).every(k => low <= k.low)) pivots.push(low);
    }

    // 2. Simple Agglomerative Clustering
    const zones: KeyZone[] = [];
    pivots.sort((a, b) => a - b).forEach(price => {
      const lastZone = zones[zones.length - 1];
      // If price is within the merge percentage of the existing zone
      if (lastZone && (price - lastZone.mid) / lastZone.mid <= mergePercent) {
        lastZone.max = price;
        lastZone.mid = (lastZone.min + lastZone.max) / 2;
        lastZone.score++;
      } else {
        zones.push({ min: price, max: price, mid: price, score: 1 });
      }
    });

    // 3. Filter for 'Strong' levels (at least 3 pivots merged)
    return zones
      .filter(z => z.score >= 3)
      .sort((a, b) => b.score - a.score);
  }

  public static plot(data: KlineData[], zones: KeyZone[]) {
    const chartData = data.map(k => ({
      time: Math.floor(k.openTime.getTime() / 1000) as any,
      open: k.open, high: k.high, low: k.low, close: k.close
    }));

    const html = `<!DOCTYPE html>
    <html>
    <head>
        <title>Day0 S/R Clusters</title>
        <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
        <style>body { background: #0c0d10; margin: 0; padding: 0; }</style>
    </head>
    <body>
        <div id="chart" style="height: 100vh; width: 100vw;"></div>
        <script>
            const chart = LightweightCharts.createChart(document.getElementById('chart'), {
                layout: { background: { color: '#0c0d10' }, textColor: '#d1d4dc' },
                grid: { vertLines: { visible: false }, horzLines: { color: '#1f222d' } },
            });

            const candleSeries = chart.addCandlestickSeries({
                upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            });
            candleSeries.setData(${JSON.stringify(chartData)});

            const zones = ${JSON.stringify(zones)};
            const currentPrice = ${data[data.length - 1].close};

            zones.forEach((zone, i) => {
                const isSupply = zone.mid > currentPrice;
                const color = isSupply ? 'rgba(239, 83, 80, 0.4)' : 'rgba(38, 166, 154, 0.4)';
                
                // Draw the Box boundaries
                [zone.min, zone.max].forEach(p => {
                    candleSeries.createPriceLine({
                        price: p, color: color, lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
                    });
                });

                // Draw the actual trading level (Midline)
                candleSeries.createPriceLine({
                    price: zone.mid,
                    color: color.replace('0.4', '0.8'),
                    lineWidth: 2,
                    lineStyle: 0,
                    axisLabelVisible: true,
                    title: (isSupply ? 'RES' : 'SUP') + ' (Score: ' + zone.score + ')',
                });
            });
            chart.timeScale().fitContent();
        </script>
    </body>
    </html>`;

    writeFileSync("chart.html", html);
    console.log("✅ day0market logic applied! Ranges are color-highlighted.");
  }
}

// --- Run ---
import { binance, Interval } from "./src/binance";
const klines = await binance.getPriceHistory("BTCUSDT", Interval.INTERVAL_1m, 1000);
const levels = Day0Analyzer.findLevels(klines, 0.0015); // 0.15% merge distance
Day0Analyzer.plot(klines, levels.slice(0, 8));