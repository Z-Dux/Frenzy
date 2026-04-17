export type OCRResult = {
  rec_texts: string[];
  rec_scores: number[];
  rec_boxes: number[][]; // [x_min, y_min, x_max, y_max]
  det_boxes: number[][];
};

export type PaddleOCRData = {
  status: "success" | "error";
  image_shape: {
    height: number;
    width: number;
  };
  results: OCRResult[];
};

export function parseChartData(data: PaddleOCRData) {
  if (data.status !== "success") {
    throw new Error("OCR processing failed");
  }

  const { width, height } = data.image_shape;
  const result = data.results[0] as OCRResult;

  const chartData = {
    priceAxisY: [] as number[],
    timeAxisX: [] as string[],
    currentMarketPrice: null as number | null,
    highlightedLevels: [] as number[],
    metadata: [] as string[],
  };

  const RIGHT_PANEL_BOUNDARY = width * 0.85; // Prices
  const BOTTOM_PANEL_BOUNDARY = height * 0.8; // Time

  result.rec_texts.forEach((text, index) => {
    const box = result.rec_boxes[index] as number[];
    const [xMin, yMin, xMax, yMax] = box;

    if ((yMin as number) > BOTTOM_PANEL_BOUNDARY && text.includes(":")) {
      chartData.timeAxisX.push(text);
      return;
    }

    if ((xMin as number) > RIGHT_PANEL_BOUNDARY) {
      const isTimer = text.includes(":");

      if (isTimer) {
        let foundPrice = false,
          i = 0;
        while (!foundPrice && i < 5 && index - i >= 0) {
          const potentialPriceText = result.rec_texts[index - i - 1];
          if (typeof potentialPriceText !== "string") {
            i++;
            continue;
          }
          const priceVal = parsePrice(potentialPriceText);

          if (priceVal && !isNaN(priceVal)) {
            chartData.currentMarketPrice = priceVal;
            foundPrice = true;
          }
          i++;
        }
      } else {
        const priceVal = parsePrice(text as string);
        if (priceVal && !isNaN(priceVal)) {
          if (!text.endsWith("00")) {
            chartData.highlightedLevels.push(priceVal);
          } else {
            chartData.priceAxisY.push(priceVal);
          }
        }
      }
      return;
    }

    if ((xMax as number) < width * 0.5 && (yMax as number) < height * 0.1) {
      chartData.metadata.push(text);
    }
  });

  chartData.priceAxisY.sort((a, b) => b - a);
  chartData.highlightedLevels = [...new Set(chartData.highlightedLevels)];

  return chartData;
}

function normalize(text: string) {
  return text.replace(/,/g, "").trim();
}

function parsePrice(text: string): number | null {
  const clean = normalize(text);

  if (!/^[0-9]+(\.[0-9]+)?$/.test(clean)) {
    return null;
  }

  return Number(clean);
}