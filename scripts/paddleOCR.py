import os
os.environ["FLAGS_use_mkldnn"] = "false"

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import numpy as np
import cv2
from paddleocr import PaddleOCR

app = FastAPI()


class ImageRequest(BaseModel):
    url: str


def load_image_from_url(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://discord.com"
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Failed to fetch image: {response.status_code}")

    content_type = response.headers.get("Content-Type", "")
    if "image" not in content_type:
        raise Exception(f"URL did not return an image. Got: {content_type}")

    img_array = np.frombuffer(response.content, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if img is None:
        raise Exception("OpenCV failed to decode image")

    return img


def to_serializable(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (list, tuple)):
        return [to_serializable(x) for x in obj]
    elif isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    else:
        return obj


ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)


@app.post("/parse-chart")
async def parse_chart(req: ImageRequest):
    try:
        img = load_image_from_url(req.url)

        results = ocr.predict(img)
        for res in results:
            res.save_to_img("output")

        raw_output = []

        for res in results:
            try:
                raw_output.append({
                    "rec_texts": to_serializable(res.get("rec_texts", [])),
                    "rec_scores": to_serializable(res.get("rec_scores", [])),
                    "rec_boxes": to_serializable(res.get("rec_boxes", [])),
                    "det_boxes": to_serializable(res.get("det_boxes", [])),
                })
            except Exception:
                continue

        return {
            "status": "success",
            "image_shape": {
                "height": img.shape[0],
                "width": img.shape[1]
            },
            "results": raw_output
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))