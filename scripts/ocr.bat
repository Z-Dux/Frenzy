echo "Starting PaddleOCR Server..."

uvicorn paddleOCR:app --reload --port 8000 --reload

pause