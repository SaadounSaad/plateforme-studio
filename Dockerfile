FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY loopforge/ ./loopforge/

ENV PORT=8123
EXPOSE 8123

CMD ["sh", "-c", "uvicorn loopforge.api:app --host 0.0.0.0 --port ${PORT}"]
