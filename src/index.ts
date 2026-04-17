import axios from "axios";
import { parseChartData, type OCRResult, type PaddleOCRData } from "./chartParser";

async function parseChart(url: string) {
  const res = await axios.post("http://127.0.0.1:8000/parse-chart", {
    url,
  });

  console.log(res.data);
  return res.data as PaddleOCRData;
} 

const res = await parseChart("https://cdn.discordapp.com/attachments/1490112835450048703/1494617243349418084/image.png?ex=69e34247&is=69e1f0c7&hm=6c3c565dbbbde9a2b9289b8d95ef0b0fc5137edca116701319c737d3aa7f5b3d");
const data = parseChartData(res);
console.log(data);
const rawData = res.results[0] as OCRResult;

const promptData = {
  processedData: data,
  rawData: {
    texts: rawData.rec_texts,
    boxes: rawData.rec_boxes,
  },
}