/**
 * Automatically generated using LLM from elliotWave.ts. i dont think this works.
 */

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

interface ZigZagPoint {
  x: number;
  y: number;
  dir: number;
}

interface EWave {
  points: { x: number; y: number }[];
  labels: string[];
  isMotive: boolean;
  isValid: boolean;
  direction: number;
}

export class ElliottWaveIdentifier {
  private zzPoints: ZigZagPoint[] = [];
  private waves: EWave[] = [];

  constructor(private length: number) {}

  public update(data: KlineData[]) {
    // Ensure we have enough data for the lookback length
    for (let i = this.length * 2; i < data.length; i++) {
      const ph = this.getPivotHigh(data, i, this.length);
      const pl = this.getPivotLow(data, i, this.length);

      if (ph !== null) this.handlePivot(i - this.length, ph, 1);
      if (pl !== null) this.handlePivot(i - this.length, pl, -1);
    }
    return { zz: this.zzPoints, waves: this.waves };
  }

  private handlePivot(x: number, y: number, dir: number) {
    const last = this.zzPoints[0];

    if (!last || last.dir !== dir) {
      this.zzPoints.unshift({ x, y, dir });
      this.identifyMotiveWave();
    } else if ((dir === 1 && y > last.y) || (dir === -1 && y < last.y)) {
      this.zzPoints[0] = { x, y, dir };
      this.identifyMotiveWave();
    }

    if (this.zzPoints.length > 20) this.zzPoints.pop();
  }

  private identifyMotiveWave() {
    // Strict check for exactly 6 points to satisfy the compiler
    if (this.zzPoints.length < 6) return;

    // Use explicit indexing instead of destructuring to maintain type narrowing 
    // or use a non-null assertion if you've already checked the length.
    const p0 = this.zzPoints[0]!;
    const p1 = this.zzPoints[1]!;
    const p2 = this.zzPoints[2]!;
    const p3 = this.zzPoints[3]!;
    const p4 = this.zzPoints[4]!;
    const p5 = this.zzPoints[5]!;

    if (p0.dir === 1) {
      const w5 = p0.y - p1.y;
      const w3 = p2.y - p3.y;
      const w1 = p4.y - p5.y;
      const minW = Math.min(w1, w3, w5);

      const isWave = w3 !== minW && 
                     p0.y > p2.y && 
                     p3.y > p5.y && 
                     p1.y > p4.y;

      if (isWave) {
        this.waves.unshift({
          points: [
            { x: p5.x, y: p5.y },
            { x: p4.x, y: p4.y },
            { x: p3.x, y: p3.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p1.y },
            { x: p0.x, y: p0.y }
          ],
          labels: ['(1)', '(2)', '(3)', '(4)', '(5)'],
          isMotive: true,
          isValid: true,
          direction: 1
        });
      }
    } else {
      const w5 = p1.y - p0.y;
      const w3 = p3.y - p2.y;
      const w1 = p5.y - p4.y;
      const minW = Math.min(w1, w3, w5);

      const isWave = w3 !== minW && 
                     p0.y < p2.y && 
                     p3.y < p5.y && 
                     p1.y < p4.y;

      if (isWave) {
        this.waves.unshift({
          points: [
            { x: p5.x, y: p5.y },
            { x: p4.x, y: p4.y },
            { x: p3.x, y: p3.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p1.y },
            { x: p0.x, y: p0.y }
          ],
          labels: ['(1)', '(2)', '(3)', '(4)', '(5)'],
          isMotive: true,
          isValid: true,
          direction: -1
        });
      }
    }

    if (this.waves.length > 15) this.waves.pop();
  }

  private getPivotHigh(data: KlineData[], index: number, length: number): number | null {
    if (index < length || index >= data.length) return null;
    const val = data[index - length]!.high;
    
    for (let i = index - 2 * length; i <= index; i++) {
      if (i < 0 || i >= data.length || i === index - length) continue;
      if (data[i]!.high > val) return null;
    }
    return val;
  }

  private getPivotLow(data: KlineData[], index: number, length: number): number | null {
    if (index < length || index >= data.length) return null;
    const val = data[index - length]!.low;
    
    for (let i = index - 2 * length; i <= index; i++) {
      if (i < 0 || i >= data.length || i === index - length) continue;
      if (data[i]!.low < val) return null;
    }
    return val;
  }
}