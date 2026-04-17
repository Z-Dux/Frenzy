from fastapi import FastAPI, UploadFile, File
import cv2
import numpy as np
from paddleocr import PaddleOCR
from sklearn.linear_model import LinearRegression

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang='en')


def extract_price_labels(image):
    results = ocr.ocr(image, cls=True)
    price_points = []

    for line in results:
        for word in line:
            text = word[1][0]
            box = word[0]

            try:
                value = float(text.replace(",", ""))
                y = int(np.mean([p[1] for p in box]))
                price_points.append((y, value))
            except:
                continue

    return price_points


def detect_chart_line(gray):
    edges = cv2.Canny(gray, 50, 150)
    return edges


def extract_line_points(edges):
    h, w = edges.shape
    points = []

    for x in range(w):
        ys = np.where(edges[:, x] > 0)[0]
        if len(ys) > 0:
            y = int(np.mean(ys))
            points.append((x, y))

    return np.array(points)


def fit_mapping(price_points):
    ys = np.array([p[0] for p in price_points]).reshape(-1, 1)
    prices = np.array([p[1] for p in price_points])

    model = LinearRegression()
    model.fit(ys, prices)
    return model


@app.post("/parse-chart")
async def parse_chart(file: UploadFile = File(...)):
    contents = await file.read()

    npimg = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    price_labels = extract_price_labels(img)
    edges = detect_chart_line(gray)
    points = extract_line_points(edges)

    model = fit_mapping(price_labels)

    series = []
    for x, y in points:
        price = model.predict([[y]])[0]
        series.append({"x": int(x), "price": float(price)})

    return {"series": series}