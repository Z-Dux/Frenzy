import requests
import numpy as np
import cv2

def load_image_from_url(url):
    headers = {
        "User-Agent": "Mozilla/5.0"
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

from paddleocr import PaddleOCR

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)

url = "https://cdn.discordapp.com/attachments/1490117738872705235/1494458517447508140/image.png?ex=69e2ae74&is=69e15cf4&hm=8493f30cc6cbc43067d8bdc80212b45e8c3bff76cdf17209a5b238e64a12f68c"

img = load_image_from_url(url)

result = ocr.predict(img)

for res in result:
    res.print()
    res.save_to_img("output")  
    res.save_to_json("output")